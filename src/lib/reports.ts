/**
 * Report write path (issues #8 + #9): the corpus half of the Magpie pipeline.
 *
 * `createReport(input)` embeds the pasted message on-device, runs the dedupe
 * lookup — top-1 of the same kNN `search()` the check flow uses — and then
 * takes one of two branches:
 *
 * - Below `THRESHOLDS.MERGE`: a new VectorsDB document is created, carrying
 *   the vector plus the report metadata and a doc-level delete permission for
 *   the reporter (so only the author can delete their own report).
 * - At or above MERGE (issue #9): no new document. The existing top hit is
 *   folded into itself — `mergeIntoExisting()` reads the full document,
 *   increments `metadata.report_count` and patches it back, preserving every
 *   other metadata field, the stored vector and the doc-level permissions.
 * - On demand (issue #13): the reporter hides their own submission —
 *   `hideReport()` is the same read-modify-write of `metadata`, setting
 *   `hidden` to the string `'true'` (the exact shape the feed's server-side
 *   `notEqual` excludes), again preserving vector and permissions.
 *
 * Errors propagate raw (Appwrite/SDK failures are rendered by the caller;
 * this module never swallows them). The optional `onStage` callback only
 * reports pipeline progress for UI loading lines and never changes behavior.
 *
 * Public surface: `createReport()`, `hideReport()` plus the
 * `CreateReportInput`, `CreateReportResult`, `CreateStage` types.
 */
import { ID, Permission, Role } from 'appwrite';
import type { Models } from 'appwrite';
import { COLLECTION_ID, DATABASE_ID, getVectorsDB } from './appwrite';
import { embed } from './embedder';
import { search } from './search';
import type { ReportMetadata, SearchResult } from './search';
import { THRESHOLDS } from './constants';
import type { Category, Channel } from './constants';

export interface CreateReportInput {
  text: string;
  category: Category;
  channel: Channel;
  /** Free text; stored trimmed, may be empty. */
  region?: string;
  /** Appwrite `$id` of the signed-in reporter. */
  reporterId: string;
}

/** Pipeline stages, mirrored to the caller (UI loading line) as they start. */
export type CreateStage = 'embedding' | 'searching' | 'saving';

export type CreateReportResult =
  | { outcome: 'created'; documentId: string }
  | { outcome: 'merged'; documentId: string; reportCount: number };

/**
 * Full stored document shape — `search()` hits drop fields the merge must
 * preserve. `hidden` is widened to `boolean | string` (the `FeedMetadata`
 * widening in `./feed.ts`): creation stores the boolean `false` while the
 * hide patch (issue #13) writes the string `'true'`, so both shapes must be
 * readable back here before the recompose recomposes them.
 */
type HideMetadata = Omit<ReportMetadata, 'hidden'> & { hidden?: boolean | string };
type StoredReportDoc = Models.Document & { metadata?: HideMetadata };

/**
 * Fold a near-duplicate report into an existing corpus document (issue #9):
 * read-modify-write of `metadata`, bumping only `report_count` by one. The
 * read-first step is required — `updateDocument` is a field-level patch, so
 * sending `metadata` replaces the whole object; recomposing it from the
 * stored document keeps text/category/channel/region/first_seen/reporter_id/
 * hidden (a plain `search()` hit is not enough: it drops `reporter_id` and
 * `hidden`). Neither `embeddings` (the stored vector stays canonical) nor
 * `permissions` (inherited by default) are passed to the patch. Errors
 * propagate raw.
 */
async function mergeIntoExisting(hit: SearchResult): Promise<number> {
  const vectors = getVectorsDB();
  const doc = await vectors.getDocument<StoredReportDoc>({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    documentId: hit.id,
  });
  const nextCount = (doc.metadata?.report_count ?? 0) + 1;
  await vectors.updateDocument<StoredReportDoc>({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    documentId: hit.id,
    data: { metadata: { ...(doc.metadata ?? {}), report_count: nextCount } },
  });
  return nextCount;
}

/**
 * Soft-hide one of the reporter's own documents (issue #13): the app's only
 * moderation. Same full-doc read-modify-write of `metadata` that
 * `mergeIntoExisting` proves — `getDocument` first, recompose the whole
 * object, patch just `metadata` — setting `hidden` to the string `'true'`.
 * String, not boolean: the feed's server-side `notEqual('metadata.hidden',
 * 'true')` and client filter exclude exactly that shape, and the issue's
 * acceptance pins `metadata.hidden === "true"` on the raw document. No
 * `embeddings` (the stored vector stays canonical) and no `permissions` (the
 * doc-level `delete:user:<uid>` survives the patch). Errors propagate raw —
 * the calling row stays visible with its error line.
 */
export async function hideReport(documentId: string): Promise<void> {
  const vectors = getVectorsDB();
  const doc = await vectors.getDocument<StoredReportDoc>({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    documentId,
  });
  await vectors.updateDocument<StoredReportDoc>({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    documentId,
    data: { metadata: { ...(doc.metadata ?? {}), hidden: 'true' } },
  });
}

export async function createReport(
  input: CreateReportInput,
  onStage?: (stage: CreateStage) => void,
): Promise<CreateReportResult> {
  const text = input.text.trim();
  onStage?.('embedding');
  const vector = await embed(text);
  // Dedupe-before-write: top-1 of the kNN search (k=10 width, read as one
  // nearest hit). ≥ MERGE means the same scam is already on file — merge
  // into it (issue #9) instead of storing a near-duplicate document.
  onStage?.('searching');
  const [top] = await search(vector);
  if (top && top.similarity >= THRESHOLDS.MERGE) {
    // The existing 'saving' phase label covers the merge write too.
    onStage?.('saving');
    const reportCount = await mergeIntoExisting(top);
    return { outcome: 'merged', documentId: top.id, reportCount };
  }
  const metadata: ReportMetadata = {
    text,
    category: input.category,
    channel: input.channel,
    region: (input.region ?? '').trim(),
    first_seen: new Date().toISOString(),
    reporter_id: input.reporterId,
    hidden: false,
    report_count: 1,
  };
  onStage?.('saving');
  const doc = await getVectorsDB().createDocument({
    databaseId: DATABASE_ID,
    collectionId: COLLECTION_ID,
    documentId: ID.unique(),
    data: { embeddings: vector, metadata },
    // Doc-level ownership (setup-db.ts printPermissions wire form: delete("user:<uid>")).
    permissions: [Permission.delete(Role.user(input.reporterId))],
  });
  return { outcome: 'created', documentId: doc.$id };
}
