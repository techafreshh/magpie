/**
 * Recent-reports feed boundary (PRD §7.3, issue #11): the /browse page's one
 * list read.
 *
 * `listRecentReports(page)` (0-based page) fetches the same-origin backend
 * (`GET /api/feed?page=N`), which serves the 25 newest non-hidden reports —
 * the sort rides the stored `created_at` payload (newest first), and hidden
 * documents are excluded server-side. The server clamps a negative page to
 * the first page instead of blowing up the offset.
 *
 * Errors propagate raw so the /browse UI surfaces unreachable-backend
 * failures instead of a misleading empty feed.
 *
 * Public surface: `FEED_PAGE_SIZE`, `listRecentReports()` plus the
 * `FeedItemData` type.
 */
import { apiFetch } from './api';

/** Page width pinned by the issue: 25 feed items per page. */
export const FEED_PAGE_SIZE = 25;

/** One feed item, mapped for consumption by the /browse UI. */
export interface FeedItemData {
  id: string;
  text: string;
  category: string;
  channel: string;
  region: string;
  reportCount: number;
  /** Reporter id of the report's author (drives the Hide button, issue #13). */
  reporterId: string;
  /** ISO timestamp of the report's creation — the feed's sort key. */
  createdAt: string;
}

/**
 * One page of the newest non-hidden reports, newest first. Zero-based `page`
 * (the /browse UI keeps 1-based numbers in the URL and subtracts 1 here); a
 * negative page is clamped to the first page server-side. Throws
 * network/ApiError errors untouched.
 */
export async function listRecentReports(page: number): Promise<FeedItemData[]> {
  const body = await apiFetch<{ items: FeedItemData[] }>(
    `/api/feed?page=${encodeURIComponent(String(Math.max(0, page)))}`,
  );
  return body.items;
}
