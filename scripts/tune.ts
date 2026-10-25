// Threshold tuner (issue #16) — run by the operator only (`npm run tune`).
// Reads data/seeds/corpus.jsonl, embeds every `variant_of` pair with the SAME
// transformers.js pipeline the browser and `scripts/seed.ts` use, and scores
// each reworded variant against its source with a local cosine. Key-free and
// fully offline by design: no .env.local, no dotenv, no Appwrite contact —
// for unit vectors Appwrite cosine distance is 1 − cos, so this dot product
// equals what `Query.vectorCosine` + `similarity()` (src/lib/search.ts) would
// report on the live service, while laps/CI (which never hold the API key)
// can still run the tuner. Pass semantics are pair-based on purpose: the
// acceptance bar (issue #16) is "≥ 80% of variants score ≥ 0.80 against their
// source", and a pair score is a lower bound on any corpus-wide top-1, so a
// passing pair is also caught by the live check flow a fortiori.
//
// Output contract (one line per `variant_of` line, then the report block):
//   variant <0-based corpus line index>: sim=<float> tier=<str>
//   summary: variants=<n> pass=<n> pass_rate=<float> tiers=HIGH_RISK=<n> SUSPICIOUS=<n> NO_REPORTS=<n>
// and a data-driven `suggest:` verdict on the THRESHOLDS (src/lib/constants.ts).
// No timestamps anywhere — two runs on one machine print byte-identical
// report lines (only first-run model-download progress may differ).
//
// Embedding contract (must match workers/embed.worker.ts and scripts/seed.ts):
// transformers.js `Xenova/all-MiniLM-L6-v2`, quantized (q8), mean pooling,
// L2-normalized, 384 dims — the minimal pipeline invoker is duplicated here
// instead of importing the browser module, because embeddings and queries must
// come from one model to stay comparable in the same cosine space (grep
// `all-MiniLM-L6-v2` in scripts/seed.ts and workers/embed.worker.ts, plus the
// header of src/lib/embedder.ts; the strings must be identical).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pipeline } from '@huggingface/transformers';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { THRESHOLDS, verdictTier } from '../src/lib/constants';
import type { VerdictTier } from '../src/lib/constants';

const DIMENSION = 384;
// MUST stay byte-identical to MODEL_ID in workers/embed.worker.ts and
// scripts/seed.ts (and the header of src/lib/embedder.ts): seed vectors and
// browser-embedded query vectors are only comparable when both sides run the
// same quantized model.
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
/** The committed corpus (#14); its `variant_of` pairs are the held-out set. */
const CORPUS_PATH = fileURLToPath(new URL('../data/seeds/corpus.jsonl', import.meta.url));
/** The acceptance bar of issue #16 (pass_rate ≥ 0.8, counted at the SUSPICIOUS boundary) — not a THRESHOLDS value. */
const PASS_RATE_BAR = 0.8;
/** Suggestion mechanics (quantize to 0.05 steps). */
const SUGGEST_STEP = 0.05;

/** One measured `variant_of` pair — only the fields this script consumes. */
interface VariantPair {
  readonly index: number; // 0-based corpus line index of the VARIANT line (printed as the id)
  readonly text: string; // trimmed — the value embedded
  readonly parentIndex: number; // 0-based corpus line index of the source (the `variant_of` value)
  readonly parentText: string; // trimmed — the value embedded
}

/**
 * Load + validate the corpus, return the variant pairs in corpus order plus
 * the raw line count. Failures are collected with 1-based line numbers
 * (build-corpus.ts `check()` style — seed.ts `loadCorpus()` shape) and exit 1
 * BEFORE any model download or embedding work. Variant rules mirror the
 * corpus builder's own contract: `variant_of` is a 0-based index to an
 * EARLIER, non-variant base line with a usable (non-empty, trimmed) text.
 */
function loadCorpus(): { total: number; pairs: VariantPair[] } {
  let raw: string;
  try {
    raw = readFileSync(CORPUS_PATH, 'utf8');
  } catch {
    console.error('data/seeds/corpus.jsonl is missing — run `npm run corpus:build` first.');
    process.exit(1);
  }
  const rawLines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n');
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();

  const failures: string[] = [];
  const note = (message: string): void => {
    failures.push(message);
  };

  // Pass 1: JSON-parse every line; a placeholder keeps record index == line
  // index so `variant_of` can be resolved against the right line.
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

  // Pass 2: collect the pairs this script measures, in corpus order.
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
    console.error(`corpus validation: ${failures.length} failure(s) in data/seeds/corpus.jsonl:`);
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error('Fix the corpus (`npm run corpus:build`) — nothing was embedded.');
    process.exit(1);
  }
  if (pairs.length === 0) {
    console.error('no `variant_of` lines in data/seeds/corpus.jsonl — nothing to tune (run `npm run corpus:build`).');
    process.exit(1);
  }
  return { total: rawLines.length, pairs };
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

/** Nearest-rank percentile over an ascending-sorted array: rank = ⌈q·n⌉ (1-based). */
function percentile(sorted: readonly number[], q: number): number {
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil(q * sorted.length)));
  return sorted[rank - 1]!;
}

/** 2-/4-decimal fixed formatting for the report block (deterministic output). */
const f2 = (x: number): string => x.toFixed(2);
const f4 = (x: number): string => x.toFixed(4);

/**
 * The `suggest:` verdict on the thresholds. Keep them when the measured
 * pass_rate already clears the acceptance bar; otherwise suggest SUSPICIOUS →
 * the largest 0.05-step value the distribution supports (find the measured
 * p20 — the boundary that keeps at least 80% of pairs — and floor it to the
 * 0.05 step), leaving HIGH and MERGE untouched — the tier histogram and
 * merge-band lines report those bands, but SUSPICIOUS is the only lever this
 * rule turns, because the acceptance contract lives exactly at its boundary.
 * When even the suggested value cannot reach the bar, the line says so — a
 * corpus-quality fact reported honestly, never massaged away.
 */
function suggestLine(sorted: readonly number[], passRate: number): string {
  const current = `HIGH=${f2(THRESHOLDS.HIGH)} SUSPICIOUS=${f2(THRESHOLDS.SUSPICIOUS)} MERGE=${f2(THRESHOLDS.MERGE)}`;
  if (passRate >= PASS_RATE_BAR) {
    return `suggest: keep thresholds (${current}) — no adjustment justified`;
  }
  const suggested = Math.round(Math.floor(percentile(sorted, 0.2) / SUGGEST_STEP) * SUGGEST_STEP * 100) / 100;
  const passAtSuggested = sorted.filter((s) => s >= suggested).length / sorted.length;
  const at = `pass_rate=${f4(passAtSuggested)} at SUSPICIOUS=${f2(suggested)}`;
  if (passAtSuggested >= PASS_RATE_BAR) {
    return `suggest: SUSPICIOUS ${f2(THRESHOLDS.SUSPICIOUS)} → ${f2(suggested)} (HIGH=${f2(THRESHOLDS.HIGH)} MERGE=${f2(THRESHOLDS.MERGE)} unchanged) — ${at}`;
  }
  if (suggested === THRESHOLDS.SUSPICIOUS) {
    // The p20 rule lands exactly on the current value: there is no 0.05 step
    // to move to — say so instead of printing a no-op "X → X".
    return `suggest: SUSPICIOUS stays ${f2(THRESHOLDS.SUSPICIOUS)} (HIGH=${f2(THRESHOLDS.HIGH)} MERGE=${f2(THRESHOLDS.MERGE)} unchanged) — ${at}, still below the ${f2(PASS_RATE_BAR)} bar: the corpus sim ceiling is the limiting factor (see distribution)`;
  }
  // Even the suggested value cannot reach the bar — report the corpus-quality
  // fact honestly (no silent massaging of sims or thresholds).
  return `suggest: SUSPICIOUS ${f2(THRESHOLDS.SUSPICIOUS)} → ${f2(suggested)} (HIGH=${f2(THRESHOLDS.HIGH)} MERGE=${f2(THRESHOLDS.MERGE)} unchanged) — ${at}, still below the ${f2(PASS_RATE_BAR)} bar: the corpus sim ceiling is the limiting factor (see distribution)`;
}

async function main(): Promise<void> {
  // Validate before anything expensive: a bad corpus must cost zero embeddings
  // and zero model downloads.
  const { total, pairs } = loadCorpus();

  console.log('Magpie threshold tuner');
  console.log(`  corpus     : data/seeds/corpus.jsonl (${total} lines, ${pairs.length} variant_of pairs)`);
  console.log(`  model      : ${MODEL_ID} (q8, ${DIMENSION} dims — same as the browser embedder)`);
  console.log(`  thresholds : HIGH=${f2(THRESHOLDS.HIGH)} SUSPICIOUS=${f2(THRESHOLDS.SUSPICIOUS)} MERGE=${f2(THRESHOLDS.MERGE)} (read live from src/lib/constants.ts)`);
  console.log('  ids        : `variant` ids below are 0-based corpus line indices; each variant\u2019s `variant_of` value names its source line');

  // Phase 1/2 — embed every distinct parent line once (a Map keeps it linear
  // in distinct parents even if two variants shared a source). Sequential on
  // purpose: the transformers.js pipeline is stateful — never parallelize.
  const parentVectors = new Map<number, number[]>();
  for (const pair of pairs) {
    if (parentVectors.has(pair.parentIndex)) continue;
    parentVectors.set(pair.parentIndex, await embedOne(pair.parentText));
  }
  console.log(`\nembedded ${parentVectors.size} distinct parent line(s); scoring ${pairs.length} variant(s):\n`);

  // Phase 2/2 — embed each variant and print its contract line in corpus order.
  const sims: number[] = [];
  for (const pair of pairs) {
    const variantVector = await embedOne(pair.text);
    const sim = cosineSim(variantVector, parentVectors.get(pair.parentIndex)!);
    sims.push(sim);
    console.log(`variant ${pair.index}: sim=${f4(sim)} tier=${verdictTier(sim)}`);
  }

  // Report block: summary (the acceptance assertion), nearest-rank
  // distribution, MERGE band size, and the threshold suggestion.
  const sorted = [...sims].sort((a, b) => a - b);
  const pass = sims.filter((s) => s >= THRESHOLDS.SUSPICIOUS).length;
  const passRate = pass / sims.length;
  const tiers: Record<VerdictTier, number> = { HIGH_RISK: 0, SUSPICIOUS: 0, NO_REPORTS: 0 };
  for (const sim of sims) tiers[verdictTier(sim)] += 1;
  const mergeBand = sims.filter((s) => s >= THRESHOLDS.MERGE).length;

  console.log('');
  console.log(`summary: variants=${sims.length} pass=${pass} pass_rate=${f4(passRate)} tiers=HIGH_RISK=${tiers.HIGH_RISK} SUSPICIOUS=${tiers.SUSPICIOUS} NO_REPORTS=${tiers.NO_REPORTS}`);
  console.log(`distribution: min=${f4(sorted[0]!)} p05=${f4(percentile(sorted, 0.05))} p25=${f4(percentile(sorted, 0.25))} median=${f4(percentile(sorted, 0.5))} p75=${f4(percentile(sorted, 0.75))} p95=${f4(percentile(sorted, 0.95))} max=${f4(sorted[sorted.length - 1]!)}`);
  console.log(`merge-band: ${mergeBand} pairs >= MERGE=${f2(THRESHOLDS.MERGE)} (would take the dedupe-merge path)`);
  console.log(suggestLine(sorted, passRate));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
