/**
 * Corpus-stats boundary (PRD §7.3, issue #12): the /browse stats strip's one
 * read. Nine tiny `listDocuments` counts batched with `Promise.all` —
 * document `total` comes back on every list response even at `limit(1)`, so
 * the counts are server-exact against the whole corpus (no pagination, no
 * client-side tally) and cheap to boot.
 *
 * Query families, all carrying the corpus-wide hidden filter
 * `Query.notEqual('metadata.hidden','true')` copied verbatim from
 * `./feed.ts` — every number on the strip derives from non-hidden
 * documents only:
 * - corpus total: hidden filter + `limit(1)`;
 * - this-week: hidden filter + `Query.createdAfter(now − 7d)` (the issue
 *   pins a rolling 7×24h window, not a calendar week) + `limit(1)`;
 * - per category: hidden filter + `Query.equal('metadata.category', c)` +
 *   `limit(1)` for every `CATEGORIES` entry — the strip iterates the shared
 *   constant, so a taxonomy change never leaves the strip stale.
 *
 * Transport is `listDocuments` (GET): as `./search.ts` documents, POST
 * `createQuery` buys nothing for tiny non-vector query strings, and
 * `checkAppwrite` in `./appwrite.ts` already proves this exact route.
 * Errors propagate raw so the /browse UI can degrade the strip to its own
 * amber line while the feed keeps rendering.
 *
 * Public surface: `getCorpusStats()` plus the `CorpusStats` type.
 */
import { Query } from 'appwrite';
import type { Models } from 'appwrite';
import { COLLECTION_ID, DATABASE_ID, getVectorsDB } from './appwrite';
import { CATEGORIES } from './constants';
import type { Category } from './constants';

/** Stats about the visible corpus, as rendered by the /browse strip. */
export interface CorpusStats {
  /** All non-hidden documents — the issue's `limit(1) → total`. */
  total: number;
  /** Non-hidden documents with `$createdAt` inside the rolling last 7×24h. */
  thisWeek: number;
  /** One count per `CATEGORIES` entry, in `CATEGORIES` order. */
  perCategory: { category: Category; count: number }[];
  /**
   * Highest per-category count, ties broken by first position in
   * `CATEGORIES` (deterministic); `null` only when every count is 0 — an
   * empty corpus must not invent a top category.
   */
  top: { category: Category; count: number } | null;
}

/** Rolling window for "this week": 7 × 24h ending now (issue-pinned semantics). */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Run one count query: the corpus hidden filter, then the caller's queries,
 * always capped at `limit(1)` — only the response's server-side `total` is
 * read, never the documents. Throws Appwrite/SDK errors untouched.
 */
async function countTotal(extraQueries: string[]): Promise<number> {
  const vectors = getVectorsDB();
  const list: Models.DocumentList<Models.DefaultDocument> = await vectors.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    queries: [Query.notEqual('metadata.hidden', 'true'), ...extraQueries, Query.limit(1)],
  });
  return list.total;
}

/**
 * Corpus stats for the /browse strip (issue #12): total, rolling-7-day, and
 * one count per `CATEGORIES` entry, batched in parallel. Throws
 * Appwrite/SDK errors untouched.
 */
export async function getCorpusStats(): Promise<CorpusStats> {
  const [total, thisWeek, ...categoryCounts] = await Promise.all([
    countTotal([]),
    countTotal([Query.createdAfter(new Date(Date.now() - WEEK_MS).toISOString())]),
    ...CATEGORIES.map((category) => countTotal([Query.equal('metadata.category', category)])),
  ]);
  const perCategory = CATEGORIES.map((category, i) => ({ category, count: categoryCounts[i] }));
  // Max with the deterministic tie rule: `CATEGORIES` order decides, so the
  // same corpus always yields the same winner.
  const topEntry = perCategory.reduce<{ category: Category; count: number } | null>(
    (best, entry) => (best === null || entry.count > best.count ? entry : best),
    null,
  );
  const top = topEntry !== null && topEntry.count > 0 ? topEntry : null;
  return { total, thisWeek, perCategory, top };
}
