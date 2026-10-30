/**
 * Corpus-stats boundary (PRD §7.3, issue #12): the /browse stats strip's one
 * read. One `GET /api/stats` — the backend counts non-hidden documents
 * server-side (exact counts against the whole corpus: total, rolling-7-day,
 * one per category) and derives the top-category callout with the same
 * deterministic tie rule (category list order decides), so the same corpus
 * always yields the same winner.
 *
 * Errors propagate raw so the /browse UI can degrade the strip to its own
 * amber line while the feed keeps rendering.
 *
 * Public surface: `getCorpusStats()` plus the `CorpusStats` type.
 */
import { apiFetch } from './api';
import type { Category } from './constants';

/** Stats about the visible corpus, as rendered by the /browse strip. */
export interface CorpusStats {
  /** All non-hidden documents. */
  total: number;
  /** Non-hidden documents created inside the rolling last 7×24h. */
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

/** Corpus stats for the /browse strip (issue #12). Throws errors untouched. */
export async function getCorpusStats(): Promise<CorpusStats> {
  return apiFetch<CorpusStats>('/api/stats');
}
