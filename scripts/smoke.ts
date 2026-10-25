// Smoke check (issue #20) — the operator's end-to-end probe of the live
// corpus. Two phases:
//
//   1. Offline (always, no key): loads/validates data/seeds/corpus.jsonl and
//      re-derives the corpus's STRONGEST `variant_of` pair via local cosine —
//      exactly the `npm run tune` procedure — asserting it clears the issue's
//      0.80 retrieval bar BEFORE any network contact. `--local` stops here and
//      prints `SMOKE LOCAL OK` (laps/CI never hold the API key — repo key
//      discipline, README → "Database setup" — so offline remains their only
//      runnable slice).
//
//   2. Online (operator, no `--local`): needs `.env.local` (APPWRITE_ENDPOINT,
//      APPWRITE_PROJECT_ID, APPWRITE_API_KEY — scopes `vectorsdb`, `documents`)
//      and runs four probes against the live VectorsDB project:
//        a  known scam text (corpus line 1) retrieves its OWN document
//          (`seed-<hash20>`, the deterministic ID of scripts/seed.ts) with
//          similarity ≥ THRESHOLDS.HIGH (0.90);
//        b  the strongest variant text retrieves its SOURCE document in the
//          top-10 with similarity ≥ 0.80;
//        *  a benign non-scam text's top-1 similarity stays below
//          THRESHOLDS.SUSPICIOUS (0.65) — the false-verdict guard;
//        c  the non-hidden feed total (`Query.notEqual('metadata.hidden',
//          'true')`, verbatim from src/lib/feed.ts) is ≥ 300.
//      All three kNN texts plus the feed total together prove the issue's
//      "kNN sane for 3 texts, thresholds recorded, feed ≥ 300" narrative; each
//      probe line prints its measured value and the bar it cleared.
//
// Transport split (mirrors src/lib/search.ts vs src/lib/feed.ts): the kNN
// probes ride the POST route `vectors.createQuery` — `listDocuments` fetches
// GET with the queries URL-embedded, and one 384-dim vectorCosine query is
// ~3.5k chars, which Appwrite rejects with HTTP 414 before the API is reached
// (verified against fra.cloud.appwrite.io, see src/lib/search.ts). The
// issue's "(a)/(b)/(c) via listDocuments" is therefore implemented as
// "listDocuments for the vector-free feed total (c), createQuery for the
// vector probes (a)/(b) and the benign control" — a smoke that shipped the
// vector probes over GET `listDocuments` could never exit 0. README → "Smoke
// check" documents this split for the operator.
//
// Output contract: deterministic `probe …` lines with measured values and
// bars, a thresholds echo read LIVE from src/lib/constants.ts (ranges are
// recorded from the running service, never restated), and a final
// `SMOKE OK` (online) / `SMOKE LOCAL OK` (offline) — exit 0 only when every
// run probe passed; any failure exits 1 with the measured values and an
// actionable hint.
//
// Embedding contract (must match workers/embed.worker.ts and scripts/seed.ts):
// transformers.js `Xenova/all-MiniLM-L6-v2`, quantized (q8), mean pooling,
// L2-normalized, 384 dims — the minimal pipeline invoker is duplicated here
// instead of importing the browser module, because probe vectors and seed
// vectors must come from one model to stay comparable in the same cosine
// space (grep `all-MiniLM-L6-v2` across those files; the strings must be
// identical). The offline phase caches all embeddings from `.cache/`, so a
// re-run without corpus/model changes costs zero downloads.
import { config } from 'dotenv';
config({ path: '.env.local' }); // operator secrets live in gitignored .env.local; offline phase never reads them
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pipeline } from '@huggingface/transformers';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { AppwriteException, Client, Query, VectorsDB } from 'node-appwrite';
import type { Models } from 'node-appwrite';
import { similarity, THRESHOLDS, verdictTier } from '../src/lib/constants';

// Fixed repo vocabulary — mirrors scripts/seed.ts (`:1-16` loadConfig idiom),
// which this script must not import: importing seed.ts would execute its
// top-level `main()` and seed the live project as a side effect.
const DATABASE_ID = 'magpie';
const COLLECTION_ID = 'reports';
const DIMENSION = 384;
// MUST stay byte-identical to MODEL_ID in workers/embed.worker.ts and
// scripts/seed.ts (and the header of src/lib/embedder.ts): probe vectors and
// seed vectors are only comparable when both sides run the same quantized model.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** The committed corpus (#14); every probe text is a corpus line. */
const CORPUS_PATH = fileURLToPath(new URL('../data/seeds/corpus.jsonl', import.meta.url));
/** Retrieval bar for the strongest `variant_of` pair (issue #20) — pinned here, not a THRESHOLDS value. */
const VARIANT_SIM_BAR = 0.8;
/** Non-hidden feed-total bar (issue #20) — pinned here, not a THRESHOLDS value. */
const FEED_TOTAL_BAR = 300;
/** Probe (a)'s text: corpus line 1 (1-based) — the README's own first-line example. */
const PROBE_A_LINE = 1;
/** kNN query width — mirrors the app's k=10 (src/lib/search.ts). */
const KNN_K = 10;
/** Benign negative control: a plain everyday message that must NOT trip the corpus. */
const BENIGN_TEXT =
  'Hi, running about ten minutes late for lunch. Order my usual and I will meet you at the office cafe.';

/** One validated `variant_of` pair — the tune.ts fields this script consumes. */
interface VariantPair {
  readonly index: number; // 0-based corpus line index of the VARIANT line
  readonly text: string; // trimmed — the value embedded
  readonly parentIndex: number; // 0-based corpus line index of the source
  readonly parentText: string; // trimmed — the value embedded
}

/** `$distance` rides kNN responses only — the query-probe document shape. */
type ProbeDocument = Models.Document & { $distance: number };

/**
 * Corpus document for the feed-total probe — only the response `total` is
 * read, never the documents (src/lib/stats.ts `countTotal()` idiom).
 */
type CountDocument = Models.DefaultDocument;

function fail(message: string, hint?: string): never {
  console.error(message);
  if (hint) console.error(hint);
  process.exit(1);
}

/**
 * Load + validate the corpus and return the trimmed texts (record index ==
 * line index) plus the `variant_of` pairs. Variant rules mirror tune.ts's
 * loader: `variant_of` is a 0-based index to an EARLIER, non-variant base
 * line with a usable (non-empty, trimmed) text. Failures exit 1 BEFORE any
 * model download or network contact.
 */
function loadCorpus(): { total: number; texts: (string | null)[]; pairs: VariantPair[] } {
  let raw: string;
  try {
    raw = readFileSync(CORPUS_PATH, 'utf8');
  } catch {
    fail('data/seeds/corpus.jsonl is missing — run `npm run corpus:build` first.');
  }
  const rawLines = raw!.endsWith('\n') ? raw!.slice(0, -1).split('\n') : raw!.split('\n');
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();

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
      return null;
    }
  });

  // Trimmed text per line — identical discipline to seed.ts and embed(): trim
  // once here, embed the trimmed value. Null marks a line without usable text.
  const texts: (string | null)[] = records.map((record, index) => {
    if (record === null) return null; // already noted by the parser
    const text = record['text'];
    if (typeof text !== 'string') {
      note(`line ${index + 1}: "text" is not a string`);
      return null;
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      note(`line ${index + 1}: "text" is empty after trimming`);
      return null;
    }
    return trimmed;
  });

  const pairs: VariantPair[] = [];
  records.forEach((record, index) => {
    if (record === null || !('variant_of' in record)) return;
    const at = `line ${index + 1}`;
    const text = texts[index];
    if (text === null) return; // already noted in pass 1
    const variantOf = record['variant_of'];
    if (!Number.isInteger(variantOf) || (variantOf as number) < 0 || (variantOf as number) >= index) {
      note(`${at}: variant_of is not a valid earlier line index (got ${String(variantOf)})`);
      return;
    }
    const parentIndex = variantOf as number;
    if (records[parentIndex] !== null && 'variant_of' in (records[parentIndex] as Record<string, unknown>)) {
      note(`${at}: variant_of ${parentIndex} points at another variant, not a base line`);
      return;
    }
    const parentText = texts[parentIndex];
    if (parentText === null) {
      note(`${at}: variant_of ${parentIndex} points at a line without a usable text`);
      return;
    }
    pairs.push({ index, text, parentIndex, parentText });
  });

  if (failures.length > 0) {
    for (const failure of failures) console.error(`  - ${failure}`);
    fail('Fix the corpus (`npm run corpus:build`) — nothing was embedded or probed.');
  }
  return { total: rawLines.length, texts, pairs };
}

// `pipeline()`'s public signature returns Promise<AllTasks[T]> over a ~30-member task union,
// which blows past TypeScript's union-complexity limit during resolution (TS2590). Narrow
// the call to the one task we use via a minimal local signature — same cast as
// workers/embed.worker.ts and scripts/seed.ts.
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
  // A wrong-dimension vector would poison the cosine math silently — refuse
  // loudly (same guard as scripts/seed.ts).
  if (vector.length !== DIMENSION) {
    throw new Error(`Embedding has ${vector.length} dimensions, expected ${DIMENSION} — the model/dtype/pooling contract is broken.`);
  }
  return vector;
}

/**
 * Cosine similarity with explicit norms: dot(a,b) / (‖a‖·‖b‖). Vectors are
 * L2-normalized by the pipeline, but re-deriving the norms keeps the value
 * exactly `1 − Appwrite cosine distance` regardless of fp noise (see
 * `similarity()` in src/lib/constants.ts).
 */
function cosineSim(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const norm = Math.sqrt(normA) * Math.sqrt(normB);
  if (norm === 0) throw new Error('zero-length embedding vector — the model/normalization contract is broken.');
  return dot / norm;
}

/** FULL sha256 hex of the (already trimmed) text — keys the deterministic document ID. */
function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Deterministic document ID: `seed-` + first 20 hex chars of the text hash.
 * Duplicated from scripts/seed.ts (`documentIdFor`) because importing that
 * module would execute its top-level seeding `main()` — this copy must stay
 * in sync with its source, since probe (a) locates its own document by this ID.
 */
function documentIdFor(hash: string): string {
  return `seed-${hash.slice(0, 20)}`;
}

/** Operator-friendly short id for probe lines. */
const short = (text: string): string => `${text.slice(0, 60)}${text.length > 60 ? '…' : ''}`;
const f4 = (x: number): string => x.toFixed(4);

/**
 * Run one server kNN query with the app's transport (POST `createQuery`) and
 * return the matches sorted by similarity descending — the server's HNSW
 * order is not relied upon (same discipline as src/lib/search.ts).
 */
async function knn(vectors: VectorsDB, vector: number[]): Promise<{ id: string; $distance: number }[]> {
  const list: Models.DocumentList<ProbeDocument> = await vectors.createQuery<ProbeDocument>({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    queries: [Query.vectorCosine('embeddings', vector), Query.limit(KNN_K)],
  });
  return list.documents
    .map((doc) => ({ id: doc.$id, $distance: doc.$distance }))
    .sort((a, b) => a.$distance - b.$distance); // ascending distance == descending similarity
}

const NOT_SEEDED_HINT = 'The corpus looks unseeded or incomplete — seed first: `npm run seed` (README → "Database setup").';

async function main(): Promise<void> {
  const local = process.argv.includes('--local');
  const { total: corpusTotal, texts, pairs } = loadCorpus();

  console.log('Magpie smoke check (issue #20)');
  console.log(`  corpus     : data/seeds/corpus.jsonl (${corpusTotal} lines, ${pairs.length} variant_of pairs)`);
  console.log(`  model      : ${MODEL_ID} (q8, ${DIMENSION} dims — same as the browser embedder)`);
  console.log(`  thresholds : HIGH=${THRESHOLDS.HIGH.toFixed(2)} SUSPICIOUS=${THRESHOLDS.SUSPICIOUS.toFixed(2)} MERGE=${THRESHOLDS.MERGE.toFixed(2)} (read live from src/lib/constants.ts)`);
  console.log(`  mode       : ${local ? 'local (offline only; add the Appwrite probes by running without --local)' : 'online (.env.local + live Appwrite probes)'}`);

  // ---- Phase 1/2: offline — validate + embed locally, no network. -------------

  // Probe (a)'s text is corpus line 1 (README's own first-line example); its
  // embedding doubles as the online kNN query vector.
  const probeAText = texts[PROBE_A_LINE - 1];
  if (probeAText === null) fail(`corpus line ${PROBE_A_LINE} has no usable text — run \`npm run corpus:build\`.`);
  const probeAVector = await embedOne(probeAText!);
  const benignVector = await embedOne(BENIGN_TEXT);

  // Embed every distinct parent once (Map keeps it linear in distinct parents),
  // then each variant — the tune.ts procedure, sequential on purpose (the
  // transformers.js pipeline is stateful — never parallelize).
  const parentVectors = new Map<number, number[]>();
  for (const pair of pairs) {
    if (parentVectors.has(pair.parentIndex)) continue;
    parentVectors.set(pair.parentIndex, await embedOne(pair.parentText));
  }
  let best: { pair: VariantPair; sim: number } | null = null;
  for (const pair of pairs) {
    const variantVector = await embedOne(pair.text);
    const sim = cosineSim(variantVector, parentVectors.get(pair.parentIndex)!);
    // Argmax with the deterministic tie rule: keep the FIRST (lowest corpus
    // line index) on ties — corpus-refresh-proof probe selection.
    if (best === null || sim > best.sim) best = { pair, sim };
  }
  if (best === null) fail('no `variant_of` pairs in the corpus — nothing to certify (run `npm run corpus:build`).');
  const strongest = best!;
  console.log(`offline: strongest variant_of pair line ${strongest.pair.index + 1} → ${strongest.pair.parentIndex + 1}: local sim ${f4(strongest.sim)}`);
  if (strongest.sim < VARIANT_SIM_BAR) {
    fail(
      `offline gate failed: strongest pair sim ${f4(strongest.sim)} < ${VARIANT_SIM_BAR} — ` +
      'the corpus itself no longer certifies a ≥ 0.80 paraphrase pair; rebuild it (`npm run corpus:build`) and re-tune.',
    );
  }
  // The 0.80 retrieval bar for probe (b) is certified by the corpus's own
  // strongest pair — the live probe can never be asked to clear a bar the
  // corpus itself misses.
  const variantVector = await embedOne(strongest.pair.text);

  if (local) {
    console.log('SMOKE LOCAL OK');
    return;
  }

  // ---- Phase 2/2: online — the live Appwrite probes. --------------------------

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
    fail(
      `online mode needs .env.local variable(s): ${missing.join(', ')}`,
      'Add them to .env.local (gitignored), or run the offline gate only: `npm run smoke -- --local` (README → "Database setup").',
    );
  }
  const client = new Client().setEndpoint(endpoint!).setProject(projectId!).setKey(apiKey!);
  const vectors = new VectorsDB(client);

  const benignTop1 = (await knn(vectors, benignVector))[0];
  // The negative control FIRST: a false HIGH verdict on an everyday message
  // would poison every green line printed after it.
  if (benignTop1 === undefined || benignTop1.$distance === undefined) {
    fail(`benign control: kNN returned no matches (k=${KNN_K}).`, NOT_SEEDED_HINT);
  }
  const benignSim = similarity(benignTop1!.$distance);
  const benignOk = benignSim < THRESHOLDS.SUSPICIOUS;
  console.log(`probe benign-control : top-1 sim ${f4(benignSim)} tier=${verdictTier(benignSim)} — must stay < SUSPICIOUS=${THRESHOLDS.SUSPICIOUS.toFixed(2)} — ${benignOk ? 'PASS' : 'FAIL'}`);

  const probeADocId = documentIdFor(hashText(probeAText!));
  const probeAMatches = await knn(vectors, probeAVector);
  const probeAHit = probeAMatches.find((m) => m.id === probeADocId);
  const probeASim = probeAHit ? similarity(probeAHit.$distance) : null;
  const probeAOk = probeASim !== null && probeASim >= THRESHOLDS.HIGH;
  console.log(
    `probe a (seed line ${PROBE_A_LINE}, "${short(probeAText!)}") → doc ${probeADocId}: sim ` +
    `${probeASim === null ? 'MISSING from top-10' : f4(probeASim)} tier=${probeASim === null ? '—' : verdictTier(probeASim)} — must be ≥ HIGH=${THRESHOLDS.HIGH.toFixed(2)} — ${probeAOk ? 'PASS' : 'FAIL'}`,
  );

  const probeBDocId = documentIdFor(hashText(strongest.pair.parentText));
  const probeBMatches = await knn(vectors, variantVector);
  const probeBRank = probeBMatches.findIndex((m) => m.id === probeBDocId);
  const probeBSim = probeBRank >= 0 ? similarity(probeBMatches[probeBRank]!.$distance) : null;
  const probeBOk = probeBSim !== null && probeBSim >= VARIANT_SIM_BAR;
  console.log(
    `probe b (variant line ${strongest.pair.index + 1} → source line ${strongest.pair.parentIndex + 1}) → doc ${probeBDocId}: ` +
    `rank ${probeBRank >= 0 ? probeBRank + 1 : 'MISSING from top-10'}, sim ${probeBSim === null ? '—' : f4(probeBSim)} — must be ≥ ${VARIANT_SIM_BAR} — ${probeBOk ? 'PASS' : 'FAIL'}`,
  );

  // Feed total rides GET `listDocuments` (vector-free, tiny queries) with the
  // verbatim hidden filter from src/lib/feed.ts.
  const feedList: Models.DocumentList<CountDocument> = await vectors.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    queries: [Query.notEqual('metadata.hidden', 'true'), Query.limit(1)],
  });
  const feedTotal = feedList.total;
  const probeCOk = feedTotal >= FEED_TOTAL_BAR;
  console.log(`probe c (feed total, notEqual(metadata.hidden,'true')): ${feedTotal} — must be ≥ ${FEED_TOTAL_BAR} — ${probeCOk ? 'PASS' : 'FAIL'}`);

  if (!benignOk || !probeAOk || !probeBOk || !probeCOk) {
    fail('SMOKE FAILED — one or more probes above printed FAIL; fix the corpus/service and re-run.');
  }
  console.log('SMOKE OK');
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
