/**
 * kNN search boundary (PRD §"Check pipeline"): the check flow's one vector query.
 *
 * `search(queryVec)` runs a single `Query.vectorCosine` nearest-neighbour call
 * (k=10) against the VectorsDB corpus (database `magpie` → collection
 * `reports`) and projects each hit's `$distance` into a similarity with
 * `similarity()` from `./constants` (1 − distance; no rounding, no clamping —
 * the returned float is used as-is). `verdict(queryVec)` maps the best match's
 * similarity to a tier; an empty corpus falls out as `NO_REPORTS` because
 * `verdictTier`'s bottom tier is exactly that. Errors propagate raw so
 * consumers (check UI, report flow) see unreachable-database failures instead
 * of a misleading empty corpus.
 *
 * Public surface: `search()`, `verdict()` plus the `SearchResult`, `Verdict`,
 * `ReportDocument` and `ReportMetadata` types.
 */
import { Query } from 'appwrite';
import type { Models } from 'appwrite';
import { COLLECTION_ID, DATABASE_ID, VECTOR_FIELD } from './appwrite';
import { getVectorsDB } from './appwrite';
import { similarity } from './constants';
import { verdictTier } from './constants';
import type { VerdictTier } from './constants';

/**
 * Report metadata as stored on each document (snake_case wire shape, see
 * scripts/setup-db.ts `DOC_FIELDS`). VectorsDB collections are schemaless, so
 * every field stays optional.
 */
export interface ReportMetadata {
  text?: string;
  category?: string;
  channel?: string;
  region?: string;
  /** ISO timestamp of the earliest report for this scam. */
  first_seen?: string;
  reporter_id?: string;
  hidden?: boolean;
  report_count?: number;
}

/** A corpus document as returned by `createQuery` — `$distance` comes with kNN queries only. */
export interface ReportDocument extends Models.Document {
  metadata?: ReportMetadata;
  /** Cosine distance to the query vector; present because the query is a vector query. */
  $distance: number;
}

/** One search hit, mapped for consumption by the check UI / report flow. */
export interface SearchResult {
  id: string;
  text: string;
  category: string;
  channel: string;
  region: string;
  reportCount: number;
  /** 1 − cosine distance; higher is closer (see `similarity()` in `./constants`). */
  similarity: number;
  /** ISO timestamp, passed through unchanged from `metadata.first_seen`. */
  firstSeen: string;
}

/** The check-flow verdict: the mapped tier plus the underlying matches. */
export interface Verdict {
  tier: VerdictTier;
  matches: SearchResult[];
}

/**
 * Cosine nearest-neighbour search on the report corpus. One `createQuery` call
 * with `Query.vectorCosine(VECTOR_FIELD, queryVec)` + `Query.limit(10)`
 * (kNN width k=10, PRD §7.1); results are explicitly sorted by similarity descending (HNSW order is not
 * relied upon). Throws Appwrite/SDK errors untouched.
 */
export async function search(queryVec: number[]): Promise<SearchResult[]> {
  const vectors = getVectorsDB();
  // POST body form (`createQuery`), not `listDocuments`: the latter fetches GET
  // with the queries URL-embedded, and one 384-dim vector query is ~3.5k chars
  // — Appwrite rejects such URIs with HTTP 414 before the API is reached
  // (verified against fra.cloud.appwrite.io). Same query strings, same
  // DocumentList response, so only the transport differs.
  const list: Models.DocumentList<ReportDocument> = await vectors.createQuery<ReportDocument>({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    queries: [Query.vectorCosine(VECTOR_FIELD, queryVec), Query.limit(10)], // kNN width k=10 (PRD §7.1)
  });
  const matches = list.documents.map((doc) => ({
    id: doc.$id,
    text: doc.metadata?.text ?? '',
    category: doc.metadata?.category ?? '',
    channel: doc.metadata?.channel ?? '',
    region: doc.metadata?.region ?? '',
    reportCount: doc.metadata?.report_count ?? 0,
    similarity: similarity(doc.$distance),
    firstSeen: doc.metadata?.first_seen ?? '',
  }));
  matches.sort((a, b) => b.similarity - a.similarity);
  return matches;
}

/** Search the corpus and map the best match's similarity to a verdict tier. */
export async function verdict(queryVec: number[]): Promise<Verdict> {
  const matches = await search(queryVec);
  // Empty corpus → similarity 0 → verdictTier's bottom tier `NO_REPORTS`.
  return { tier: verdictTier(matches[0]?.similarity ?? 0), matches };
}
