// One-time Qdrant bootstrap — run by the operator only (`npm run setup:db`).
// Provisions the exact shape the app expects: collection `magpie_reports` with
// a 384-dim cosine vector config plus the payload indexes the feed and stats
// depend on. Idempotent: every resource is get-first, created only when
// missing, so re-running is safe. No API key needed for a stock Qdrant
// instance — set QDRANT_API_KEY in .env.local only if your instance requires one.
// Point it at the instance with QDRANT_URL (default http://qdrant:6333, the
// compose-network alias; on the host use the container's IP). .env.local is
// loaded by ./qdrant (import order note there).
import {
  collectionExists,
  DIMENSION,
  QDRANT_COLLECTION,
  qdrant,
} from './qdrant';
import type { QdrantCollectionInfo } from './qdrant';

/**
 * Payload indexes the app depends on:
 * - `category` (keyword): per-category stats counts;
 * - `hidden` (bool): the feed/stats/hidden filter and the check-flow exclusion;
 * - `created_at` (datetime): the feed's `order_by` sort (backdated for seeds to
 *   the line's `first_seen` — the replacement for the old $createdAt override).
 */
const PAYLOAD_INDEXES: { field: string; schema: string; why: string }[] = [
  { field: 'category', schema: 'keyword', why: 'per-category stats counts' },
  { field: 'hidden', schema: 'bool', why: 'the hidden filter on feed/stats/search' },
  { field: 'created_at', schema: 'datetime', why: "the feed's order_by sort" },
];

/** Document payload fields (server.mjs toFeedItem/toMatch + seed.ts) — printed for reference. */
const DOC_FIELDS = [
  'text',
  'category',
  'channel',
  'region',
  'first_seen',
  'reporter_id',
  'hidden',
  'report_count',
  'created_at',
] as const;

async function ensureCollection(): Promise<'created' | 'exists'> {
  if (await collectionExists()) return 'exists';
  await qdrant('PUT', `/collections/${QDRANT_COLLECTION}`, {
    vectors: { size: DIMENSION, distance: 'Cosine' },
  });
  return 'created';
}

/** Verify the vector config of an existing collection — a wrong dimension/distance
 * would make every kNN search silently wrong — fail loudly instead. */
function assertVectorConfig(info: QdrantCollectionInfo): void {
  const vectors = info.config?.params?.vectors as { size?: number; distance?: string };
  if (typeof vectors?.size !== 'number') return; // named-vectors config: leave it alone
  if (vectors.size !== DIMENSION || vectors.distance !== 'Cosine') {
    throw new Error(
      `Collection "${QDRANT_COLLECTION}" exists with size=${vectors.size} distance=${vectors.distance}, ` +
        `expected size=${DIMENSION} distance=Cosine. Recreate the collection before continuing.`,
    );
  }
}

async function ensurePayloadIndexes(): Promise<{ field: string; status: 'created' | 'exists' }[]> {
  const info = await qdrant<QdrantCollectionInfo>('GET', `/collections/${QDRANT_COLLECTION}`);
  assertVectorConfig(info);
  const existing = new Set(Object.keys(info.payload_schema ?? {}));
  const results: { field: string; status: 'created' | 'exists' }[] = [];
  for (const { field, schema } of PAYLOAD_INDEXES) {
    if (existing.has(field)) {
      results.push({ field, status: 'exists' });
      continue;
    }
    // Index creation is asynchronous (the answer is `acknowledged`, the
    // optimizer builds it in the background) — upserts need no index, and
    // only the feed's order_by consumes the datetime one at query time.
    await qdrant('PUT', `/collections/${QDRANT_COLLECTION}/index`, {
      field_name: field,
      field_schema: schema,
    });
    results.push({ field, status: 'created' });
  }
  return results;
}

async function main(): Promise<void> {
  console.log('Magpie Qdrant bootstrap');
  console.log(`  collection: ${QDRANT_COLLECTION} (vectors: ${DIMENSION} dims, Cosine)`);

  const colStatus = await ensureCollection();
  console.log(`\nCollection "${QDRANT_COLLECTION}" — ${colStatus}`);
  console.log(`  document fields (free-form payload): ${DOC_FIELDS.join(', ')}`);

  console.log('Payload indexes:');
  for (const { field, status } of await ensurePayloadIndexes()) {
    const why = PAYLOAD_INDEXES.find((i) => i.field === field)?.why;
    console.log(`  ${field} — ${status}${why ? ` (${why})` : ''}`);
  }

  console.log('\nDone. Re-running is safe — existing resources are detected and left untouched.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
