// Seed-corpus assembler + acceptance validator (issue #14) — runs with tsx,
// no network, no database contact (`npm run corpus:build` / `npm run corpus:check`).
// `build` assembles data/seeds/sources/*.ts into data/seeds/corpus.jsonl with
// seeded-synthetic timestamps, regions and report_counts (deterministic within
// a UTC day). `check` regenerates the corpus in memory, byte-compares every
// deterministic field via a whole-day shift, and re-runs the full issue #14
// acceptance contract as a local gate. Sources are authored originals — this
// script only samples, writes and validates; it never fetches anything.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, CHANNELS } from '../src/lib/constants';
import type { Category, Channel } from '../src/lib/constants';
import { DATASET_POOLS, type DatasetPool, type SeedText } from '../data/seeds/sources/datasets';
import { HANDWRITTEN, HANDWRITTEN_SOURCE, VARIANTS, type HandwrittenText } from '../data/seeds/sources/handwritten';

/** Fixed PRNG seed so any two runs on the same UTC day produce identical bytes. */
const SEED = 20261024;
/** The committed artifact; everything else in this script is derived from it. */
const CORPUS_PATH = fileURLToPath(new URL('../data/seeds/corpus.jsonl', import.meta.url));

/** `first_seen` window: every line is 32–220 days old at generation —
 * 20 days of headroom under the 240-day acceptance bound so probes that run
 * days later still read the whole corpus inside the contract. */
const MIN_AGE_DAYS = 32;
const MAX_AGE_DAYS = 220;
/** Variant `first_seen` = parent date + 1–20 days, capped at the 32-day floor. */
const MIN_VARIANT_OFFSET_DAYS = 1;
const MAX_VARIANT_OFFSET_DAYS = 20;
/** Acceptance hard floor for any committed line at check time (age only ever
 * grows, so a ≥ 32d generation can never violate it). */
const HARD_MIN_AGE_DAYS = 30;
/** Drift-proof upper bound for the committed file: ages grow ~1 day/day, so
 * beyond 400 days the artifact was never backdated properly — rebuild, never edit. */
const HARD_MAX_AGE_DAYS = 400;
/** Issue contract: at least 60 lines must carry a `variant_of` back-reference. */
const MIN_VARIANTS = 60;
/** Issue contract: text cap (checked) and minimum authored length (defensive). */
const MAX_TEXT_LEN = 990;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Expected per-pool counts (PRD source table) and hand-written staples. These
 * counters keep the authored prose honest: an authoring or refactor slip fails
 * here, before anything is committed. */
const EXPECTED_POOL_COUNTS: Readonly<Record<string, { total: number; categories: Partial<Record<Category, number>> }>> = {
  uci: { total: 75, categories: { other: 67, phishing: 8 } },
  spamassassin: { total: 42, categories: { phishing: 12, investment: 12, advance_fee: 10, other: 8 } },
  nigerian_fraud: { total: 26, categories: { advance_fee: 26 } },
  nazario: { total: 16, categories: { phishing: 16 } },
  africa_smishing: { total: 21, categories: { phishing: 14, other: 7 } },
};
const EXPECTED_POOL_TOTAL = 180; // 75 UCI + 42 SpamAssassin + 26 Nigerian_Fraud + 16 Nazario + 21 africa-smishing
const EXPECTED_HANDWRITTEN: Partial<Record<Category, number>> = {
  phishing: 30, delivery: 20, romance: 20, investment: 15, job_offer: 15,
};
const EXPECTED_DATASET_CHANNELS: Partial<Record<Channel, number>> = { sms: 96, email: 84 }; // uci+af sms / sa+nf+naz email
const EXPECTED_HANDWRITTEN_CHANNELS: Partial<Record<Channel, number>> = { sms: 33, whatsapp: 49, email: 18 };
const EXPECTED_VARIANTS = 80; // 40 hand-written parents + 40 dataset parents

/**
 * Region vocabulary (PRD report flow): a Nigerian city or `National` for texts
 * without a local flavor. The big-four cities carry ~66% of hand-written lines
 * to mirror where reported scams concentrate.
 */
const NATIONAL = 'National';
const REGION_SET: ReadonlySet<string> = new Set([NATIONAL, 'Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Benin City', 'Aba', 'Kaduna', 'Jos']);
const CITY_WEIGHTS: readonly (readonly [string, number])[] = [
  ['Lagos', 0.26], ['Abuja', 0.19], ['Port Harcourt', 0.12], ['Ibadan', 0.09],
  ['Kano', 0.08], ['Enugu', 0.06], ['Benin City', 0.06], ['Aba', 0.05], ['Kaduna', 0.05], ['Jos', 0.04],
];

/** One emitted corpus line. Property order here is the JSON key order on disk. */
interface EmittedLine {
  readonly text: string;
  readonly category: Category;
  readonly channel: Channel;
  readonly region: string;
  readonly first_seen: string;
  readonly report_count: number;
  readonly source: string;
  readonly variant_of?: number;
}

function fail(message: string): never {
  throw new Error(message);
}

/** mulberry32 — tiny deterministic PRNG; enough spread for sampling. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer sampler on `[from, to]`. */
function sampleDays(rand: () => number, from: number, to: number): number {
  return from + Math.floor(rand() * (to - from + 1));
}

/** Weighted draw; weights must sum to ~1 (last entry is the fallback bucket). */
function pickWeighted(rand: () => number, table: readonly (readonly [string, number])[]): string {
  let roll = rand();
  for (const [value, weight] of table) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return table[table.length - 1][0];
}

/** UTC-midnight alignment keeps timestamps byte-identical across a UTC day. */
function utcMidnightToday(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** A base text joined with its attribution line and origin flag (the region
 * synthesizer treats pool text and hand-written text differently). */
interface AssembledBase {
  readonly seed: SeedText | HandwrittenText;
  readonly handwritten: boolean;
  readonly source: string;
}

/** Concatenate the six source groups in fixed order; verify every quota, key
 * uniqueness, category split and variant parent so an authoring slip fails
 * before anything reaches the committed JSONL. */
function assemble(): { base: readonly AssembledBase[]; keyToIndex: ReadonlyMap<string, number> } {
  const base: AssembledBase[] = [];
  for (const pool of DATASET_POOLS as readonly DatasetPool[]) {
    const expected = EXPECTED_POOL_COUNTS[pool.id];
    if (expected === undefined) fail(`Unknown dataset pool id "${pool.id}"`);
    if (pool.texts.length !== expected.total) {
      fail(`Pool "${pool.id}" has ${pool.texts.length} texts, expected ${expected.total}`);
    }
    for (const [category, count] of Object.entries(expected.categories) as [Category, number][]) {
      const actual = pool.texts.filter((seed) => seed.category === category).length;
      if (actual !== count) fail(`Pool "${pool.id}" has ${actual} "${category}" texts, expected ${count}`);
    }
    base.push(...pool.texts.map((seed) => ({ seed, handwritten: false, source: pool.source })));
  }
  if (base.length !== EXPECTED_POOL_TOTAL) fail(`Dataset pools total ${base.length}, expected ${EXPECTED_POOL_TOTAL}`);
  const datasetChannels: Partial<Record<Channel, number>> = {};
  for (const entry of base) datasetChannels[entry.seed.channel] = (datasetChannels[entry.seed.channel] ?? 0) + 1;
  for (const [channel, count] of Object.entries(EXPECTED_DATASET_CHANNELS) as [Channel, number][]) {
    if (datasetChannels[channel] !== count) fail(`Dataset "${channel}" count is ${datasetChannels[channel]}, expected ${count}`);
  }

  for (const seed of HANDWRITTEN as readonly HandwrittenText[]) {
    base.push({ seed, handwritten: true, source: HANDWRITTEN_SOURCE });
  }
  const handwritten = base.slice(EXPECTED_POOL_TOTAL);
  const hwCategories: Partial<Record<Category, number>> = {};
  const hwChannels: Partial<Record<Channel, number>> = {};
  for (const entry of handwritten) {
    hwCategories[entry.seed.category] = (hwCategories[entry.seed.category] ?? 0) + 1;
    hwChannels[entry.seed.channel] = (hwChannels[entry.seed.channel] ?? 0) + 1;
  }
  for (const [category, count] of Object.entries(EXPECTED_HANDWRITTEN) as [Category, number][]) {
    if (hwCategories[category] !== count) fail(`Hand-written "${category}" count is ${hwCategories[category] ?? 0}, expected ${count}`);
  }
  for (const [channel, count] of Object.entries(EXPECTED_HANDWRITTEN_CHANNELS) as [Channel, number][]) {
    if (hwChannels[channel] !== count) fail(`Hand-written "${channel}" count is ${hwChannels[channel]}, expected ${count}`);
  }

  // Keys are unique corpus-wide; hand-written parents are all keyed (variants
  // reference them); dataset parents/popular entries are keyed at authoring.
  const keyToIndex = new Map<string, number>();
  base.forEach((entry, index) => {
    const key = (entry.seed as SeedText & HandwrittenText).key;
    if (key !== undefined) {
      if (keyToIndex.has(key)) fail(`Duplicate seed key "${key}" (indices ${keyToIndex.get(key)} and ${index})`);
      keyToIndex.set(key, index);
    }
  });
  handwritten.forEach((entry, hwIndex) => {
    if ((entry.seed as HandwrittenText).key === undefined) fail(`Hand-written text hw#${hwIndex + 1} lacks a key (variants reference keys)`);
  });
  if ((VARIANTS as readonly { parentKey: string; text: string }[]).length !== EXPECTED_VARIANTS) {
    fail(`Variant templates: ${(VARIANTS as readonly { parentKey: string; text: string }[]).length}, expected ${EXPECTED_VARIANTS}`);
  }
  for (const variant of VARIANTS as readonly { parentKey: string; text: string }[]) {
    if (!keyToIndex.has(variant.parentKey)) fail(`Variant references unknown parentKey "${variant.parentKey}"`);
  }
  return { base, keyToIndex };
}

/** Per-text report-count mix (PRD: 1–90 concentrated on popular scams):
 * popular seeds sample 25–90, everything else 1–14 with a low skew. */
function parentReportCount(rand: () => number, popular: boolean): number {
  if (popular) return Math.min(90, 25 + Math.round(rand() * 65));
  return 1 + Math.floor(14 * rand() * rand());
}

/** Deterministic emission order: the 6 base groups, then all variants — so
 * every `variant_of` points at an earlier (stable) line index. */
function synthesize(): readonly EmittedLine[] {
  const { base, keyToIndex } = assemble();
  const rand = mulberry32(SEED);
  const t0 = utcMidnightToday();

  const lines: EmittedLine[] = [];
  const tsOfIndex: number[] = [];
  for (const entry of base) {
    const ageDays = sampleDays(rand, MIN_AGE_DAYS, MAX_AGE_DAYS);
    const ts = t0 - ageDays * DAY_MS;
    tsOfIndex.push(ts);
    lines.push({
      text: entry.seed.text,
      category: entry.seed.category,
      channel: entry.seed.channel,
      region: entry.handwritten ? pickWeighted(rand, CITY_WEIGHTS) : NATIONAL,
      first_seen: new Date(ts).toISOString(),
      report_count: parentReportCount(rand, (entry.seed as SeedText).popular === true),
      source: entry.source,
    });
  }

  for (const variant of VARIANTS as readonly { parentKey: string; text: string }[]) {
    const parentIndex = keyToIndex.get(variant.parentKey) ?? fail(`Variant references unknown parentKey "${variant.parentKey}"`);
    const parent = lines[parentIndex];
    if (parent === undefined) fail(`ParentKey "${variant.parentKey}" resolves past the base section (line ${parentIndex})`);
    const offsetDays = sampleDays(rand, MIN_VARIANT_OFFSET_DAYS, MAX_VARIANT_OFFSET_DAYS);
    const ts = Math.min(tsOfIndex[parentIndex] + offsetDays * DAY_MS, t0 - MIN_AGE_DAYS * DAY_MS);
    lines.push({
      text: variant.text,
      category: parent.category,
      channel: parent.channel === 'sms' && rand() < 0.15 ? 'whatsapp' : parent.channel,
      region: parent.region,
      first_seen: new Date(ts).toISOString(),
      report_count: 1 + Math.floor(rand() * 10),
      source: parent.source,
      variant_of: parentIndex,
    });
  }
  return lines;
}

/** Fixed key order (`variant_of` last, only on variant lines) — the byte layout
 * of every committed line. `check` re-serializes and compares against this. */
function serialize(line: EmittedLine): string {
  const out: Record<string, unknown> = {
    text: line.text,
    category: line.category,
    channel: line.channel,
    region: line.region,
    first_seen: line.first_seen,
    report_count: line.report_count,
    source: line.source,
  };
  if (line.variant_of !== undefined) out.variant_of = line.variant_of;
  return JSON.stringify(out);
}

function build(): void {
  const lines = synthesize().map(serialize);
  writeFileSync(CORPUS_PATH, lines.join('\n') + '\n');
  console.log(`Wrote ${lines.length} seed lines to data/seeds/corpus.jsonl`);
}

const BASE_KEYS: readonly string[] = ['text', 'category', 'channel', 'region', 'first_seen', 'report_count', 'source'];
const EMAIL_RE = /[^@\s]+@[^@\s]+\.[^@\s]+/g;
const FIRST_SEEN_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** Only example.com addresses may appear; terminal prose punctuation after the
 * address is tolerated (the acceptance regex is greedy over `.`/`,`), anything
 * else — subdomains, other domains — fails. */
const SAFE_EMAIL_RE = /^[^@\s]+@example\.com[.,;:!?)'\]]*$/;

/** Run the full issue-#14 acceptance contract against the committed JSONL,
 * plus the deterministic regeneration diff. Prints a per-check verdict and
 * exits non-zero naming the offending line numbers on any failure. */
function check(): void {
  const failures: string[] = [];
  const note = (message: string): void => {
    failures.push(message);
  };

  let rawFile: string;
  try {
    rawFile = readFileSync(CORPUS_PATH, 'utf8');
  } catch {
    console.error('data/seeds/corpus.jsonl is missing — run `npm run corpus:build` first.');
    process.exit(1);
  }
  const rawLines = rawFile.endsWith('\n') ? rawFile.slice(0, -1).split('\n') : rawFile.split('\n');
  if (rawLines[rawLines.length - 1] === '') rawLines.pop();
  const total = rawLines.length;
  console.log(total < 300 ? `FAIL  line count ${total} < 300` : `ok    line count ${total}`);
  if (total < 300) note(`line count ${total} < 300`);

  const parsed: (Record<string, unknown> | null)[] = rawLines.map((raw, index) => {
    try {
      const value: unknown = JSON.parse(raw);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not a JSON object');
      return value as Record<string, unknown>;
    } catch (err) {
      note(`line ${index + 1} is not a JSON object (${err instanceof Error ? err.message : 'parse error'})`);
      return null;
    }
  });

  // Key-set + scalar checks; unknown[] fields validated through guards.
  const texts: string[] = [];
  const variantIndices: number[] = [];
  parsed.forEach((line, index) => {
    if (line === null) return;
    const hasVariant = 'variant_of' in line;
    const expectedKeys = hasVariant ? [...BASE_KEYS, 'variant_of'] : [...BASE_KEYS];
    const actualKeys = Object.keys(line);
    if (actualKeys.length !== expectedKeys.length || !expectedKeys.every((key) => actualKeys.includes(key))) {
      note(`line ${index + 1}: key set ${JSON.stringify(actualKeys)} != expected ${JSON.stringify(expectedKeys)}`);
      return;
    }
    const text = line.text;
    const category = line.category;
    const channel = line.channel;
    const region = line.region;
    const firstSeen = line.first_seen;
    const source = line.source;
    const reportCount = line.report_count;
    const variantOf = line.variant_of;
    if (typeof text !== 'string' || typeof category !== 'string' || typeof channel !== 'string' ||
      typeof region !== 'string' || typeof firstSeen !== 'string' || typeof source !== 'string' ||
      typeof reportCount !== 'number' || (hasVariant && typeof variantOf !== 'number')) {
      note(`line ${index + 1}: a field has the wrong JSON type`);
      return;
    }
    if (!CATEGORIES.includes(category as Category)) note(`line ${index + 1}: category "${category}" not in the 7 constants`);
    if (!CHANNELS.includes(channel as Channel)) note(`line ${index + 1}: channel "${channel}" not in {sms, whatsapp, email}`);
    if (!REGION_SET.has(region)) note(`line ${index + 1}: region "${region}" outside the vocabulary`);
    if (!Number.isInteger(reportCount) || reportCount < 1 || reportCount > 90) {
      note(`line ${index + 1}: report_count ${reportCount} outside 1–90`);
    }
    if (!FIRST_SEEN_RE.test(firstSeen) || Number.isNaN(Date.parse(firstSeen))) {
      note(`line ${index + 1}: first_seen "${firstSeen}" is not a full ISO-8601 UTC timestamp`);
    } else {
      if (Date.parse(firstSeen) % DAY_MS !== 0) note(`line ${index + 1}: first_seen is not UTC-midnight aligned`);
      const ageDays = (Date.now() - Date.parse(firstSeen)) / DAY_MS;
      if (ageDays < HARD_MIN_AGE_DAYS) note(`line ${index + 1}: first_seen is only ${ageDays.toFixed(1)} days old (< ${HARD_MIN_AGE_DAYS})`);
      if (ageDays > HARD_MAX_AGE_DAYS) note(`line ${index + 1}: first_seen is ${ageDays.toFixed(0)} days old (> ${HARD_MAX_AGE_DAYS}) — rebuild the corpus`);
    }
    if (text.length > MAX_TEXT_LEN) note(`line ${index + 1}: text length ${text.length} > ${MAX_TEXT_LEN}`);
    if (text.startsWith('>')) note(`line ${index + 1}: text starts with a quoted-header remnant`);
    if (/[0-9]{11}/.test(text)) note(`line ${index + 1}: digit run longer than 10 characters`);
    // Separator-stripped variant of the digit-run rule catches spaced-out keys.
    if (/[0-9]{11}/.test(text.replace(/[\s.,\-–—/()]/g, ''))) note(`line ${index + 1}: phone-like digit run survives separator stripping`);
    for (const match of text.matchAll(EMAIL_RE)) {
      if (!SAFE_EMAIL_RE.test(match[0])) note(`line ${index + 1}: non-anonymized email "${match[0]}"`);
    }
    texts.push(text);
    if (hasVariant && typeof variantOf === 'number') {
      variantIndices.push(index);
      if (!Number.isInteger(variantOf) || variantOf < 0 || variantOf >= index) {
        note(`line ${index + 1}: variant_of ${variantOf} is not a valid earlier line index`);
      } else {
        const parentLine = parsed[variantOf];
        if (parentLine === null) note(`line ${index + 1}: variant_of ${variantOf} points at an unparsable line`);
        else if (parentLine !== null && 'variant_of' in parentLine) note(`line ${index + 1}: variant_of ${variantOf} points at another variant, not a base line`);
      }
    }
  });

  console.log(variantIndices.length >= MIN_VARIANTS
    ? `ok    variant_of lines: ${variantIndices.length} (>= ${MIN_VARIANTS})`
    : `FAIL  variant_of lines: ${variantIndices.length} < ${MIN_VARIANTS}`);
  if (variantIndices.length < MIN_VARIANTS) note(`only ${variantIndices.length} variant_of lines, need >= ${MIN_VARIANTS}`);

  const unique = new Set<string>();
  let dupAt = -1;
  texts.forEach((text, i) => {
    if (unique.has(text)) {
      if (dupAt < 0) {
        dupAt = i;
        note(`duplicate text first at line ${i + 1}: "${text.slice(0, 60)}…"`);
      }
    } else {
      unique.add(text);
    }
  });
  console.log(dupAt < 0 ? `ok    no duplicate texts` : `FAIL  duplicate texts (first at line ${dupAt + 1})`);

  // Deterministic regeneration: byte-compare against the committed file via a
  // whole-day shift Δ (committed first_seen = regenerated + Δ days for a file
  // generated on an earlier UTC day), so `check` survives day-boundary drift.
  const regenerated = synthesize();
  if (parsed.some((line) => line === null) || total !== regenerated.length) {
    console.error('FAIL  structural errors above — deterministic diff skipped');
    printSummaryAndExit(failures);
    process.exit(1);
  }
  const committed0 = parsed[0];
  if (committed0 === undefined || committed0 === null || typeof committed0.first_seen !== 'string') {
    note('cannot infer day shift: first line lacks first_seen');
  } else {
    const deltaMs = Date.parse(committed0.first_seen) - Date.parse(regenerated[0]!.first_seen);
    if (deltaMs < 0 || deltaMs % DAY_MS !== 0) {
      note(`deterministic diff: first_seen drift ${deltaMs}ms is not a whole-day regen shift — rebuild the corpus`);
    } else {
      let mismatches = 0;
      regenerated.forEach((line, index) => {
        const committedLine = parsed[index];
        if (committedLine === null) return;
        const shifted: EmittedLine = {
          ...line,
          first_seen: new Date(Date.parse(line.first_seen) + deltaMs).toISOString(),
        };
        if (JSON.stringify(committedLine) !== serialize(shifted)) {
          if (mismatches === 0) note(`line ${index + 1} differs from deterministic regeneration (other than the ${deltaMs / DAY_MS}-day storage shift)`);
          mismatches += 1;
        }
      });
      console.log(mismatches === 0
        ? `ok    all ${total} lines byte-match deterministic regeneration (Δ ${deltaMs / DAY_MS}d)`
        : `FAIL  ${mismatches} line(s) differ from deterministic regeneration`);
      // Stats for the operator: distribution shape of the committed artifact.
      const categoryCounts = new Map<string, number>();
      let highCount = 0;
      const ages: number[] = [];
      for (const line of parsed) {
        if (line === null) continue;
        const category = String(line.category);
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
        if (Number(line.report_count) >= 25) highCount += 1;
        if (typeof line.first_seen === 'string') ages.push((Date.now() - Date.parse(line.first_seen)) / DAY_MS);
      }
      const order = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' ');
      console.log(`stats lines=${total} high-count(>=25)=${highCount} age=[${Math.round(Math.min(...ages))}d..${Math.round(Math.max(...ages))}d] ${order}`);
    }
  }

  printSummaryAndExit(failures);
}

function printSummaryAndExit(failures: readonly string[]): void {
  if (failures.length === 0) {
    console.log('\ncorpus check: all acceptance probes passed.');
    return;
  }
  console.error(`\ncorpus check: ${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

function main(): void {
  const command = process.argv[2];
  if (command === 'build') {
    build();
  } else if (command === 'check') {
    check();
  } else {
    console.error('Usage: tsx scripts/build-corpus.ts <build|check>');
    console.error('  build  assemble + synthesize data/seeds/corpus.jsonl');
    console.error('  check  re-run the issue acceptance contract against the committed file');
    process.exit(1);
  }
}

main();
