// Seed-corpus loader — run by the operator only (`npm run seed`).
// Reads data/seeds/corpus.jsonl (issue #14), embeds every line on-device with
// the SAME transformers.js pipeline the browser uses, and upserts one Qdrant
// point per line into collection `magpie_reports`. Backdating: the payload's
// `created_at` (the feed's order_by key) is set to the line's `first_seen` —
// the replacement for the old backend's $createdAt override.
//
// Idempotent by construction: point IDs are deterministic UUIDs derived from
// the text's SHA-256 (see `uuidFromText`), and upsert overwrites — re-running
// rewrites the same points, never duplicating them. No checkpoint file. No
// API key is needed for a stock Qdrant instance; point the script at it with
// QDRANT_URL (.env.local is loaded by ./qdrant — import order note there).
//
// Embedding contract (must match workers/embed.worker.ts): transformers.js
// `Xenova/all-MiniLM-L6-v2`, quantized (q8), mean pooling, L2-normalized,
// 384 dims — the minimal pipeline invoker is duplicated here instead of
// importing the browser module, because embeddings and queries must come from
// one model to stay comparable in the same cosine space (grep both files for
// `all-MiniLM-L6-v2`; the strings must be identical).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pipeline } from '@huggingface/transformers';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { CATEGORIES, CHANNELS } from '../src/lib/constants';
import type { Category, Channel } from '../src/lib/constants';
import { DIMENSION, QDRANT_COLLECTION, qdrant, uuidFromText } from './qdrant';

// MUST stay byte-identical to MODEL_ID in workers/embed.worker.ts (and the
// header of src/lib/embedder.ts): seed vectors and browser-embedded query
// vectors are only comparable when both sides run the same quantized model.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** The committed corpus (#14); everything else in this script is derived from it. */
const CORPUS_PATH = fileURLToPath(new URL('../data/seeds/corpus.jsonl', import.meta.url));
/** Seeds have no real reporter; a fixed sentinel keeps `reporter_id` honest
 * (server.mjs rejects reporterId === 'seed' on the write path, so no user
 * report can collide with the seeded corpus). */
const SEED_REPORTER_ID = 'seed';
/** Same text cap the corpus builder enforces (scripts/build-corpus.ts MAX_TEXT_LEN). */
const MAX_TEXT_LEN = 990;
/** Full ISO-8601 UTC timestamp, the exact shape corpus lines carry
 * (scripts/build-corpus.ts FIRST_SEEN_RE). */
const FIRST_SEEN_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** Upsert batch size — one HTTP call per batch, wait=true (visible immediately). */
const BATCH_SIZE = 64;

/** One validated corpus line — only the fields this script consumes. The
 * corpus's `source`/`variant_of` bookkeeping keys are read past, never stored. */
interface SeedLine {
  readonly text: string; // trimmed — the value stored and embedded
  readonly category: Category;
  readonly channel: Channel;
  readonly region: string;
  readonly first_seen: string; // ISO-8601 UTC; becomes the point's created_at (backdating)
  readonly report_count: number;
}

/**
 * Payload stored on each point — mirrors what the server's create path writes
 * (server.mjs handleCreateReport) and what setup-db.ts prints as DOC_FIELDS:
 * `hidden: false` at creation, `report_count` from the corpus, sentinel
 * reporter, `created_at` = `first_seen` (backdating: the /browse feed sorts on
 * it, newest first).
 */
interface SeedPayload {
  text: string;
  category: Category;
  channel: Channel;
  region: string;
  first_seen: string;
  reporter_id: string;
  hidden: boolean;
  report_count: number;
  created_at: string;
}

/**
 * Read + parse + validate the corpus. Any schema failure is collected, printed
 * with its line number (style of scripts/build-corpus.ts `check()`) and exits 1
 * BEFORE any Qdrant contact or embedding work. Returns pure validated lines.
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
    // Duplicate texts would collide on the deterministic UUID — a corpus-level
    // failure the corpus builder already prevents; re-checked here because the
    // point ID keys on the full text hash.
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
  // ethic as setup-db.ts's vector-config guard).
  if (vector.length !== DIMENSION) {
    throw new Error(`Embedding has ${vector.length} dimensions, expected ${DIMENSION} — the model/dtype/pooling contract is broken.`);
  }
  return vector;
}

async function main(): Promise<void> {
  // Validate before anything expensive: a bad corpus must cost zero embeddings
  // and zero network calls.
  const lines = loadCorpus();

  console.log('Magpie seed-corpus loader');
  console.log(`  collection : ${QDRANT_COLLECTION} (${DIMENSION} dims, Cosine)`);
  console.log(`  corpus     : data/seeds/corpus.jsonl (${lines.length} lines)`);
  console.log(`  model      : ${MODEL_ID} (q8, ${DIMENSION} dims — same as the browser embedder)`);
  console.log('  ids        : deterministic UUIDs from the text hash — re-runs overwrite, never duplicate');

  let embedded = 0;
  let upserted = 0;
  let batch: { id: string; vector: number[]; payload: SeedPayload }[] = [];

  async function flush(): Promise<void> {
    if (batch.length === 0) return;
    await qdrant('PUT', `/collections/${QDRANT_COLLECTION}/points?wait=true`, { points: batch });
    upserted += batch.length;
    console.log(`  upserted ${upserted}/${lines.length} points`);
    batch = [];
  }

  // Sequential on purpose: the transformers.js pipeline is stateful — never
  // parallelize embeds. Points accumulate into batches for the upsert.
  for (const [index, line] of lines.entries()) {
    const vector = await embedOne(line.text);
    embedded += 1;
    const payload: SeedPayload = {
      text: line.text,
      category: line.category,
      channel: line.channel,
      region: line.region,
      first_seen: line.first_seen,
      reporter_id: SEED_REPORTER_ID,
      hidden: false, // matches the server's create path; hiding is the reporter's own action
      report_count: line.report_count,
      created_at: line.first_seen, // backdating: the feed's order_by key
    };
    batch.push({ id: uuidFromText(line.text), vector, payload });
    process.stdout.write(`\r#${index + 1}/${lines.length} embedded`);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  process.stdout.write('\n');
  await flush();

  console.log(`\nDone: embedded ${embedded}, upserted ${upserted} points into "${QDRANT_COLLECTION}".`);
  console.log('Re-running is safe — deterministic IDs make every insert an overwrite.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
