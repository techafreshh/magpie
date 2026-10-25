// Seed-corpus loader — run by the operator only (`npm run seed`).
// Reads data/seeds/corpus.jsonl (issue #14), embeds every line on-device with
// the SAME transformers.js pipeline the browser uses, and inserts one VectorsDB
// document per line into database `magpie` → collection `reports`, with
// `$createdAt` overridden to the line's `first_seen` (backdating: the /browse
// feed sorts on that system field). Needs an API key with scopes `vectorsdb`
// and `documents` in `.env.local` (see README → "Database setup"). Idempotent
// through a gitignored checkpoint (`.seed-checkpoint.json`) plus deterministic
// document IDs — re-running is safe and can never duplicate a document.
//
// Embedding contract (must match workers/embed.worker.ts): transformers.js
// `Xenova/all-MiniLM-L6-v2`, quantized (q8), mean pooling, L2-normalized,
// 384 dims — the minimal pipeline invoker is duplicated here instead of
// importing the browser module, because embeddings and queries must come from
// one model to stay comparable in the same cosine space (grep both files for
// `all-MiniLM-L6-v2`; the strings must be identical).
import { config } from 'dotenv';
config({ path: '.env.local' }); // operator secrets live in gitignored .env.local; the committed .env holds client values only
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pipeline } from '@huggingface/transformers';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { AppwriteException, Client, VectorsDB } from 'node-appwrite';
import { CATEGORIES, CHANNELS } from '../src/lib/constants';
import type { Category, Channel } from '../src/lib/constants';

// Fixed repo vocabulary (PRD): one VectorsDB database `magpie` → collection `reports`.
// Mirrors src/lib/appwrite.ts, which this script must not import — that module
// reads import.meta.env (a Vite surface, unavailable in Node). Same idiom as
// scripts/setup-db.ts.
const DATABASE_ID = 'magpie';
const COLLECTION_ID = 'reports';
const DIMENSION = 384;
// MUST stay byte-identical to MODEL_ID in workers/embed.worker.ts (and the
// header of src/lib/embedder.ts): seed vectors and browser-embedded query
// vectors are only comparable when both sides run the same quantized model.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** The committed corpus (#14); everything else in this script is derived from it. */
const CORPUS_PATH = fileURLToPath(new URL('../data/seeds/corpus.jsonl', import.meta.url));
// Issue-fixed checkpoint name, at repo root — resolved off this script file so
// `npm run seed` behaves identically from any cwd. Gitignored (operator-local).
const CHECKPOINT_PATH = fileURLToPath(new URL('../.seed-checkpoint.json', import.meta.url));
/** Seeds have no real reporter; a fixed sentinel keeps `metadata.reporter_id` honest. */
const SEED_REPORTER_ID = 'seed-corpus';
/** Deterministic-ID prefix — see `documentIdFor`. */
const DOC_ID_PREFIX = 'seed-';
/** Same text cap the corpus builder enforces (scripts/build-corpus.ts MAX_TEXT_LEN). */
const MAX_TEXT_LEN = 990;
/** Full ISO-8601 UTC timestamp, the exact shape corpus lines carry
 * (scripts/build-corpus.ts FIRST_SEEN_RE). */
const FIRST_SEEN_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** One validated corpus line — only the fields this script consumes. The
 * corpus's `source`/`variant_of` bookkeeping keys are read past, never stored. */
interface SeedLine {
  readonly text: string; // trimmed — the value stored and embedded
  readonly category: Category;
  readonly channel: Channel;
  readonly region: string;
  readonly first_seen: string; // ISO-8601 UTC; becomes the document's $createdAt override
  readonly report_count: number;
}

/**
 * Metadata stored on each document — mirrors `ReportMetadata`
 * (src/lib/search.ts, a browser module this script must not import) and the
 * shape `createReport` writes (src/lib/reports.ts): `hidden: false` at
 * creation, `report_count` from the corpus, sentinel reporter.
 */
interface SeedMetadata {
  text: string;
  category: Category;
  channel: Channel;
  region: string;
  first_seen: string;
  reporter_id: string;
  hidden: boolean;
  report_count: number;
}

/**
 * Operator-local checkpoint: which corpus lines are already known-seeded.
 * Keys are the FULL sha256 hex of the trimmed text — the issue disallows the
 * "first 5 chars" prefix shortcut. `line` is the 0-based corpus line index.
 */
interface Checkpoint {
  version: 1;
  seeded: Record<string, { documentId: string; line: number }>;
}

/** 409 = the deterministic ID already exists on the server → "already seeded". */
function isConflict(err: unknown): boolean {
  return err instanceof AppwriteException && err.code === 409;
}

/** Read the three operator vars; exit 1 with an actionable message if any is missing. */
function loadConfig(): { endpoint: string; projectId: string; apiKey: string } {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const missing = [
    ['APPWRITE_ENDPOINT', endpoint],
    ['APPWRITE_PROJECT_ID', projectId],
    ['APPWRITE_API_KEY', apiKey],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error(`Missing required .env.local variable(s): ${missing.join(', ')}`);
    console.error('Add them to .env.local (gitignored) — see README → "Database setup".');
    process.exit(1);
  }
  // Keys are non-empty here (filter above), yet TS still sees optional strings — assert.
  return { endpoint: endpoint!, projectId: projectId!, apiKey: apiKey! };
}

/** Never print the key itself — mask it down to its last 4 characters. */
function maskKey(apiKey: string): string {
  return apiKey.length <= 4 ? '••••' : `••••${apiKey.slice(-4)}`;
}

/** FULL sha256 hex of the (already trimmed) text: the checkpoint key. */
function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Deterministic document ID: `seed-` + first 20 hex chars of the text hash
 * (25 chars, within Appwrite's 36-char ID limit). Same text → same ID on every
 * machine and run, so even a rerun that lost its checkpoint hits the server's
 * 409 conflict instead of creating a duplicate.
 */
function documentIdFor(hash: string): string {
  return `${DOC_ID_PREFIX}${hash.slice(0, 20)}`;
}

/**
 * Load the checkpoint, tolerating absence and corruption: a missing or
 * unparsable file starts fresh — deterministic IDs make that safe (already
 * seeded lines 409 and are re-recorded). A foreign version is refused so a
 * future format change cannot silently misread old checkpoints.
 */
function loadCheckpoint(): Checkpoint {
  let raw: string;
  try {
    raw = readFileSync(CHECKPOINT_PATH, 'utf8');
  } catch {
    return { version: 1, seeded: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('Warning: .seed-checkpoint.json is corrupt — starting a fresh checkpoint (deterministic document IDs keep the re-run safe).');
    return { version: 1, seeded: {} };
  }
  const asCp = parsed as Partial<Checkpoint> | null;
  if (
    asCp !== null && typeof asCp === 'object' && !Array.isArray(asCp) &&
    asCp.version === 1 && asCp.seeded !== null && typeof asCp.seeded === 'object'
  ) {
    return asCp as Checkpoint;
  }
  if (asCp !== null && typeof asCp === 'object' && !Array.isArray(asCp) && asCp.version !== undefined && asCp.version !== 1) {
    console.error(`.seed-checkpoint.json was written by checkpoint version ${String(asCp.version)}, this script reads version 1 — delete the file and re-run \`npm run seed\`.`);
    process.exit(1);
  }
  console.error('Warning: .seed-checkpoint.json is malformed — starting a fresh checkpoint (deterministic document IDs keep the re-run safe).');
  return { version: 1, seeded: {} };
}

/** Persist after EVERY insert/skip, so an interrupt (yes/ctrl-c) never loses more than one line. */
function saveCheckpoint(checkpoint: Checkpoint): void {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2) + '\n');
}

/**
 * Read + parse + validate the corpus. Any schema failure is collected, printed
 * with its line number (style of scripts/build-corpus.ts `check()`) and exits 1
 * BEFORE any Appwrite contact or embedding work. Returns pure validated lines.
 */
function loadCorpus(): SeedLine[] {
  let raw: string;
  try {
    raw = readFileSync(CORPUS_PATH, 'utf8');
  } catch {
    console.error('data/seeds/corpus.jsonl is missing — run `npm run corpus:build` first.');
    process.exit(1);
  }
  const rawLines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n');
  if (rawLines[rawLines.length - 1] === '') rawLines.pop();

  const failures: string[] = [];
  const note = (message: string): void => {
    failures.push(message);
  };

  const records: (Record<string, unknown> | null)[] = rawLines.map((lineText, index) => {
    try {
      const value: unknown = JSON.parse(lineText);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not a JSON object');
      return value as Record<string, unknown>;
    } catch (err) {
      note(`line ${index + 1} is not a JSON object (${err instanceof Error ? err.message : 'parse error'})`);
      return null; // placeholder keeps record index == line index
    }
  });

  const lines: SeedLine[] = [];
  const seenTexts = new Set<string>();
  records.forEach((record, index) => {
    if (record === null) return; // already noted by the parser
    const at = `line ${index + 1}`;
    if (
      !('text' in record) || !('category' in record) || !('channel' in record) ||
      !('region' in record) || !('first_seen' in record) || !('report_count' in record)
    ) {
      note(`${at}: missing one of the required keys text/category/channel/region/first_seen/report_count`);
      return;
    }
    const { text, category, channel, region, first_seen, report_count } = record;
    if (typeof text !== 'string' || typeof category !== 'string' || typeof channel !== 'string' ||
      typeof region !== 'string' || typeof first_seen !== 'string' || typeof report_count !== 'number') {
      note(`${at}: a field has the wrong JSON type`);
      return;
    }
    // Trim once here — the trimmed value is what gets stored and embedded
    // (identical discipline to the browser: embed() embeds text.trim()).
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      note(`${at}: text is empty after trimming`);
      return;
    }
    if (trimmed.length > MAX_TEXT_LEN) {
      note(`${at}: text length ${trimmed.length} > ${MAX_TEXT_LEN}`);
      return;
    }
    if (!CATEGORIES.includes(category as Category)) note(`${at}: category "${category}" not in src/lib/constants.ts CATEGORIES`);
    if (!CHANNELS.includes(channel as Channel)) note(`${at}: channel "${channel}" not in src/lib/constants.ts CHANNELS`);
    if (!FIRST_SEEN_RE.test(first_seen) || Number.isNaN(Date.parse(first_seen))) {
      note(`${at}: first_seen "${first_seen}" is not a full ISO-8601 UTC timestamp`);
    }
    if (!Number.isInteger(report_count) || report_count < 1 || report_count > 90) {
      note(`${at}: report_count ${report_count} outside 1–90`);
    }
    // Duplicate texts would collide on the deterministic ID — a corpus-level
    // failure the corpus builder already prevents; re-checked here because the
    // checkpoint keys on the full text hash.
    if (seenTexts.has(trimmed)) note(`${at}: duplicate text (deterministic IDs would collide): "${trimmed.slice(0, 60)}…"`);
    seenTexts.add(trimmed);

    if (!CATEGORIES.includes(category as Category) || !CHANNELS.includes(channel as Channel)) return;
    lines.push({
      text: trimmed,
      category: category as Category,
      channel: channel as Channel,
      region,
      first_seen,
      report_count,
    });
  });

  if (failures.length > 0) {
    console.error(`corpus validation: ${failures.length} failure(s) in ${CORPUS_PATH}:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('Fix the corpus (`npm run corpus:build`) — nothing was embedded or inserted.');
    process.exit(1);
  }
  return lines;
}

// `pipeline()`'s public signature returns Promise<AllTasks[T]> over a ~30-member task union,
// which blows past TypeScript's union-complexity limit during resolution (TS2590). Narrow
// the call to the one task we use via a minimal local signature — same cast as
// workers/embed.worker.ts.
const createPipeline = pipeline as unknown as (
  task: 'feature-extraction',
  model?: string,
  options?: {
    dtype?: 'q8';
    progress_callback?: (e: { status?: string; file?: string; progress?: number }) => void;
  },
) => Promise<FeatureExtractionPipeline>;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

/** Create the pipeline once per run; only download-progress lines are printed. */
function loadExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = createPipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8', // same quantization as the browser worker — one shared vector space
      progress_callback: (e: { status?: string; file?: string; progress?: number }) => {
        if (e.status === 'progress') {
          console.log(`download ${e.file ?? '?'}: ${Math.round(e.progress ?? 0)}%`);
        }
      },
    });
  }
  return extractorPromise;
}

/**
 * Embed one (already trimmed) text exactly like workers/embed.worker.ts does:
 * mean pooling + L2 normalization over the q8 model → a unit vector of
 * DIMENSION components. First call downloads the model (~23 MB q8) into
 * transformers.js HTTP cache; later calls (and reruns) load from cache.
 */
async function embedOne(text: string): Promise<number[]> {
  const extractor = await loadExtractor();
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data as Float32Array);
  // A wrong-dimension vector would poison kNN silently — refuse loudly (same
  // ethic as setup-db.ts's dimension guard).
  if (vector.length !== DIMENSION) {
    throw new Error(`Embedding has ${vector.length} dimensions, expected ${DIMENSION} — the model/dtype/pooling contract is broken.`);
  }
  return vector;
}

async function main(): Promise<void> {
  const { endpoint, projectId, apiKey } = loadConfig();
  // Validate before anything expensive: a bad corpus must cost zero embeddings
  // and zero network calls.
  const lines = loadCorpus();
  const checkpoint = loadCheckpoint();
  const checkpointed = lines.filter((line) => checkpoint.seeded[hashText(line.text)] !== undefined).length;

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const vectors = new VectorsDB(client);

  console.log('Magpie seed-corpus loader');
  console.log(`  endpoint   : ${endpoint}`);
  console.log(`  project    : ${projectId}`);
  console.log(`  api key    : ${maskKey(apiKey)} (needs scopes: vectorsdb, documents)`);
  console.log(`  corpus     : data/seeds/corpus.jsonl (${lines.length} lines, ${checkpointed} already checkpointed)`);
  console.log(`  model      : ${MODEL_ID} (q8, ${DIMENSION} dims — same as the browser embedder)`);
  console.log(`  checkpoint : .seed-checkpoint.json (gitignored)`);

  let created = 0;
  let checkpointSkipped = 0;
  let serverSkipped = 0;
  let checkedTimestampOverride = false;

  // Sequential on purpose: one line = embed → create → checkpoint, fully
  // resumable. (The bulk `createDocuments` route gives no per-line resumability
  // and its per-element timestamp/documentId shape is not typed in the SDK.)
  for (const [index, line] of lines.entries()) {
    const hash = hashText(line.text);
    const known = checkpoint.seeded[hash];
    if (known !== undefined) {
      console.log(`#${index + 1} skip (checkpointed as ${known.documentId})`);
      checkpointSkipped += 1;
      continue;
    }
    const documentId = documentIdFor(hash);
    const metadata: SeedMetadata = {
      text: line.text,
      category: line.category,
      channel: line.channel,
      region: line.region,
      first_seen: line.first_seen,
      reporter_id: SEED_REPORTER_ID,
      hidden: false, // matches createReport's ReportMetadata; hiding is the reporter's own action
      report_count: line.report_count,
    };
    try {
      const vector = await embedOne(line.text);
      // `$createdAt` rides inside `data`: Appwrite honors system attributes in the
      // payload when the call is authenticated with an API key (the SDK exposes
      // no dedicated override parameter). This is the backdating contract the
      // feed's sort depends on.
      // No result-type annotation here: annotating as Models.Document would make TS infer the
      // route's Document generic as Models.Document (strict data branch) instead of the default
      // Models.DefaultDocument (index-signature data). The raw return already has $createdAt.
      const doc = await vectors.createDocument({
        databaseId: DATABASE_ID,
        collectionId: COLLECTION_ID,
        documentId,
        data: { embeddings: vector, metadata, $createdAt: line.first_seen },
      });
      if (!checkedTimestampOverride) {
        checkedTimestampOverride = true;
        // Fail fast, before 360 docs are written, if the server ignored the override.
        if (Date.parse(doc.$createdAt) !== Date.parse(line.first_seen)) {
          console.error(
            `Timestamp override was NOT honored: sent $createdAt "${line.first_seen}", ` +
            `server stored "${doc.$createdAt}". Backdating requires an API key ` +
            '(scopes vectorsdb, documents); aborting before writing the rest of the corpus.',
          );
          process.exit(1);
        }
        console.log(`Timestamp override verified: server stored \$createdAt as "${doc.$createdAt}".`);
      }
      created += 1;
      console.log(`#${index + 1} created ${documentId} ($createdAt ${doc.$createdAt})`);
    } catch (err) {
      if (!isConflict(err)) throw err;
      // Deterministic-ID backstop: the text is already on the server (e.g. the
      // checkpoint was lost between runs) — record it, never duplicate.
      console.log(`#${index + 1} skip (already on server: ${documentId})`);
      serverSkipped += 1;
    }
    checkpoint.seeded[hash] = { documentId, line: index };
    saveCheckpoint(checkpoint);
  }

  console.log(`\nDone: created ${created}, skipped ${checkpointSkipped + serverSkipped} (${checkpointSkipped} checkpointed, ${serverSkipped} already on server).`);
  console.log('Re-running is safe — checkpointed and server-known lines are skipped, never duplicated.');
}

main().catch((err: unknown) => {
  if (err instanceof AppwriteException) {
    console.error(`[${err.code}/${err.type}] ${err.message}`);
    if (err.code === 401) {
      console.error('Auth failed — check the key\u2019s scopes: vectorsdb, documents (README → "Database setup").');
    }
  } else {
    console.error(err instanceof Error ? err.message : String(err));
  }
  process.exit(1);
});
