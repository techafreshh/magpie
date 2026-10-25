// One-time VectorsDB bootstrap — run by the operator only (`npm run setup:db`).
// Provisions the exact shape the app expects: database `magpie` → collection
// `reports` with a 384-dim `embeddings` vector field and an HNSW cosine index,
// plus the PRD §9 permission model. Needs an API key with scopes `vectorsdb`
// and `documents` in `.env.local` (see README → "Database setup"). Idempotent:
// every resource is get-first, created only on 404, so re-running is safe.
// Data model reference: .agents/PRDs/PRD.md ("Data model").
import { config } from 'dotenv';
config({ path: '.env.local' }); // operator secrets live in gitignored .env.local; the committed .env holds client values only
import { AppwriteException, Client, Permission, Role, VectorsDB, VectorsDBIndexType } from 'node-appwrite';

// Fixed repo vocabulary (PRD): one VectorsDB database `magpie` → collection `reports`.
// Mirrors src/lib/appwrite.ts, which this script must not import — that module
// reads import.meta.env (a Vite surface, unavailable in Node).
const DATABASE_ID = 'magpie';
const COLLECTION_ID = 'reports';
/** Human-readable names (Console display). */
const DATABASE_NAME = 'Magpie report corpus';
const COLLECTION_NAME = 'Scam reports';
/** The vector field; VectorsDB collections are schemaless — the HNSW index below declares it. */
const VECTOR_FIELD = 'embeddings';
// Embedding model all-MiniLM-L6-v2 → 384 dims (PRD "Data model"). Like
// src/lib/constants.ts, the number lives here and nowhere else.
const DIMENSION = 384;
/** Index metric must match how `$distance` is consumed (cosine distance, PRD data model). */
const METRIC = 'cosine';
/** Arbitrary readable index ID; VectorsDB does not require it to equal the attribute name. */
const VECTOR_INDEX_KEY = 'embeddings_hnsw';
/**
 * Report metadata per the PRD data model, stored on each document as free-form
 * JSON (VectorsDB collections are schemaless — there is nothing to provision
 * here; listed so the expected document shape is visible in one place).
 */
const DOC_FIELDS = ['text', 'category', 'channel', 'region', 'first_seen', 'reporter_id', 'hidden', 'report_count'] as const;

function isNotFound(err: unknown): boolean {
  return err instanceof AppwriteException && err.code === 404;
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

async function ensureDatabase(vectors: VectorsDB): Promise<'created' | 'exists'> {
  try {
    await vectors.get({ databaseId: DATABASE_ID });
    return 'exists';
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await vectors.create({ databaseId: DATABASE_ID, name: DATABASE_NAME });
    return 'created';
  }
}

async function ensureCollection(vectors: VectorsDB): Promise<'created' | 'exists'> {
  try {
    const existing = await vectors.getCollection({
      databaseId: DATABASE_ID,
      collectionId: COLLECTION_ID,
    });
    if (existing.dimension !== DIMENSION) {
      // A wrong dimension would make every kNN search silently wrong — fail loudly.
      throw new Error(
        `Collection "${COLLECTION_ID}" exists with dimension ${existing.dimension}, expected ${DIMENSION}. ` +
          'Fix it in the Console (or recreate the collection) before continuing.',
      );
    }
    return 'exists';
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await vectors.createCollection({
      databaseId: DATABASE_ID,
      collectionId: COLLECTION_ID,
      name: COLLECTION_NAME,
      dimension: DIMENSION, // Custom dimension — not the Console's model binding (PRD milestone 1)
      permissions: [
        Permission.read(Role.any()),
        Permission.create(Role.users()),
        Permission.update(Role.users()),
      ],
      // Doc-level permissions (delete per document) require this to be on.
      documentSecurity: true,
      enabled: true,
      description: `Community scam reports; vector field "${VECTOR_FIELD}" (${DIMENSION}d, ${METRIC})`,
    });
    return 'created';
  }
}

async function ensureVectorIndex(vectors: VectorsDB): Promise<'created' | 'exists'> {
  try {
    await vectors.getIndex({
      databaseId: DATABASE_ID,
      collectionId: COLLECTION_ID,
      key: VECTOR_INDEX_KEY,
    });
    return 'exists';
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await vectors.createIndex({
      databaseId: DATABASE_ID,
      collectionId: COLLECTION_ID,
      key: VECTOR_INDEX_KEY,
      type: VectorsDBIndexType.HnswCosine,
      attributes: [VECTOR_FIELD],
    });
    return 'created';
  }
}

/**
 * Permission boilerplate: collection-level permissions were applied by
 * `ensureCollection` above; doc-level delete cannot be applied here — it is
 * set per document at write time (report flow / seed script). Print both so
 * the operator sees the exact wire strings.
 */
function printPermissions(): void {
  console.log('\nPermissions:');
  console.log(`  ${Permission.read(Role.any())} — anyone can read the corpus (public radar)`);
  console.log(`  ${Permission.create(Role.users())} — signed-in users can report (PRD §9)`);
  console.log(`  ${Permission.update(Role.users())} — signed-in users can merge-duplicate (report_count++)`);
  console.log('  document-level (applied per document at write time, not by this script):');
  console.log(`    ${Permission.delete('user:<uid>')} — replace <uid> with the reporter's user id`);
  console.log('    so only the author can delete their own report');
}

async function main(): Promise<void> {
  const { endpoint, projectId, apiKey } = loadConfig();
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const vectors = new VectorsDB(client);

  console.log('Magpie VectorsDB bootstrap');
  console.log(`  endpoint : ${endpoint}`);
  console.log(`  project  : ${projectId}`);
  console.log(`  api key  : ${maskKey(apiKey)} (needs scopes: vectorsdb, documents)`);

  const dbStatus = await ensureDatabase(vectors);
  console.log(`\nDatabase "${DATABASE_ID}" — ${dbStatus}`);
  if (dbStatus === 'created') console.log(`  name: "${DATABASE_NAME}"`);

  const colStatus = await ensureCollection(vectors);
  console.log(
    `Collection "${COLLECTION_ID}" — ${colStatus}` +
      (colStatus === 'created' ? ` (dimension ${DIMENSION}, doc-level permissions on)` : ''),
  );
  console.log(`  document fields (PRD data model, free-form JSON): ${DOC_FIELDS.join(', ')}`);

  const idxStatus = await ensureVectorIndex(vectors);
  console.log(
    `Index "${VECTOR_INDEX_KEY}" — ${idxStatus}` +
      (idxStatus === 'created' ? ` (HNSW ${METRIC} on "${VECTOR_FIELD}")` : ''),
  );

  printPermissions();

  console.log('\nDone. Re-running is safe — existing resources are detected and left untouched.');
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
