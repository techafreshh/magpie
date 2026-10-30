/**
 * kNN search boundary (PRD §"Check pipeline"): the check flow's one vector query.
 *
 * `search(queryVec)` posts the client-embedded vector to the same-origin
 * backend (`POST /api/check`), which runs the nearest-neighbour query (k=10)
 * against the Qdrant collection's cosine index and returns matches sorted by
 * similarity descending — the server's index order is not relied upon (same
 * discipline as before: the backend sorts explicitly). `verdict(queryVec)`
 * maps the best match's similarity to a tier; an empty corpus falls out as
 * `NO_REPORTS` because `verdictTier`'s bottom tier is exactly that. Errors
 * propagate raw so consumers (check UI, report flow) see unreachable-backend
 * failures instead of a misleading empty corpus.
 *
 * The embedding boundary is unchanged: the vector is computed on-device in
 * `./embedder` — the message text itself never travels anywhere.
 *
 * Public surface: `search()`, `verdict()` plus the `SearchResult`, `Verdict`,
 * types.
 */
import { verdictTier } from './constants';
import type { VerdictTier } from './constants';
import { apiFetch } from './api';

/** One search hit, mapped for consumption by the check UI / report flow. */
export interface SearchResult {
  id: string;
  text: string;
  category: string;
  channel: string;
  region: string;
  reportCount: number;
  /** Cosine similarity (Qdrant score); higher is closer. */
  similarity: number;
  /** ISO timestamp, passed through unchanged from the stored `first_seen`. */
  firstSeen: string;
}

/** The check-flow verdict: the mapped tier plus the underlying matches. */
export interface Verdict {
  tier: VerdictTier;
  matches: SearchResult[];
}

/**
 * Cosine nearest-neighbour search on the report corpus: one `POST /api/check`
 * with the client-embedded vector (kNN width k=10 lives server-side, PRD
 * §7.1). Results arrive sorted by similarity descending. Throws
 * ApiError/network errors untouched.
 */
export async function search(queryVec: number[]): Promise<SearchResult[]> {
  const body = await apiFetch<{ matches: SearchResult[] }>('/api/check', {
    method: 'POST',
    body: JSON.stringify({ vector: queryVec }),
  });
  return body.matches;
}

/** Search the corpus and map the best match's similarity to a verdict tier. */
export async function verdict(queryVec: number[]): Promise<Verdict> {
  const matches = await search(queryVec);
  // Empty corpus → similarity 0 → verdictTier's bottom tier `NO_REPORTS`.
  return { tier: verdictTier(matches[0]?.similarity ?? 0), matches };
}
