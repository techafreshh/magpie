/**
 * Recent-reports feed boundary (PRD §7.3, issue #11): the /browse page's one
 * list query.
 *
 * `listRecentReports(page)` (0-based page) issues exactly the issue-pinned
 * query array against the VectorsDB corpus (database `magpie` → collection
 * `reports`): `Query.orderDesc('$createdAt')` — metadata JSON cannot be
 * ordered on VectorsDB, so the sort rides the system `$createdAt` field —
 * `Query.notEqual('metadata.hidden','true')`, `Query.limit(25)` and
 * `Query.offset(page * 25)`. Transport is `listDocuments` (GET), not
 * `createQuery` (POST): the 414-URI problem documented in `./search.ts` is
 * vector-specific (~3.5k-char query strings) — these four tiny query strings
 * fit any URL, and `checkAppwrite` in `./appwrite.ts` already proves this
 * exact route against this collection.
 *
 * Defence in depth on hidden: the write path (`./reports.ts`) stores a
 * boolean `hidden: false`, while the issue's acceptance hides a document via
 * the *string* `"true"` — so after the server-side `notEqual`, any doc whose
 * `metadata.hidden` slipped through as either shape is dropped before
 * mapping, never rendered on any page.
 *
 * Errors propagate raw so the /browse UI surfaces unreachable-database
 * failures instead of a misleading empty feed.
 *
 * Public surface: `FEED_PAGE_SIZE`, `listRecentReports()` plus the
 * `FeedItemData` type.
 */
import { Query } from 'appwrite';
import type { Models } from 'appwrite';
import { COLLECTION_ID, DATABASE_ID, getVectorsDB } from './appwrite';
import type { ReportMetadata } from './search';

/** Page width pinned by the issue: 25 feed items per page. */
export const FEED_PAGE_SIZE = 25;

/**
 * Report metadata as stored on each document — the `./search.ts` shape with
 * `hidden` widened to `boolean | string`: the write path stores `false`, the
 * operator's seed/Console path can store `"true"`, and both must read as
 * hidden.
 */
type FeedMetadata = Omit<ReportMetadata, 'hidden'> & { hidden?: boolean | string };

/** A corpus document as returned by `listDocuments`. */
type FeedDocument = Models.Document & { metadata?: FeedMetadata };

/** One feed item, mapped for consumption by the /browse UI. */
export interface FeedItemData {
  id: string;
  text: string;
  category: string;
  channel: string;
  region: string;
  reportCount: number;
  /** Appwrite `$id` of the reporter who created this report (drives the Hide button, issue #13). */
  reporterId: string;
  /** ISO timestamp of the document's `$createdAt` — the feed's sort key. */
  createdAt: string;
}

/**
 * One page of the newest non-hidden reports, newest first. Zero-based `page`
 * (the /browse UI keeps 1-based numbers in the URL and subtracts 1 here); a
 * negative page is clamped to the first page instead of blowing up the
 * offset query. Throws Appwrite/SDK errors untouched.
 */
export async function listRecentReports(page: number): Promise<FeedItemData[]> {
  const vectors = getVectorsDB();
  const list: Models.DocumentList<FeedDocument> = await vectors.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    // Query array pinned verbatim by the issue — order included.
    queries: [
      Query.orderDesc('$createdAt'),
      Query.notEqual('metadata.hidden', 'true'),
      Query.limit(FEED_PAGE_SIZE),
      Query.offset(Math.max(0, page) * FEED_PAGE_SIZE),
    ],
  });
  // Belt alongside the server-side notEqual: hidden must vanish even when it
  // lands as a boolean or a "true" string (see module comment). Non-hidden
  // loses nothing — `hidden: false` / absent both pass.
  return list.documents
    .filter((doc) => doc.metadata?.hidden !== true && doc.metadata?.hidden !== 'true')
    .map((doc) => ({
      id: doc.$id,
      text: doc.metadata?.text ?? '',
      category: doc.metadata?.category ?? '',
      channel: doc.metadata?.channel ?? '',
      region: doc.metadata?.region ?? '',
      reportCount: doc.metadata?.report_count ?? 0,
      reporterId: doc.metadata?.reporter_id ?? '',
      createdAt: doc.$createdAt,
    }));
}
