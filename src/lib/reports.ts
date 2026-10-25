/**
 * Report create path (issue #8): the write half of the Magpie pipeline.
 *
 * `createReport(input)` embeds the pasted message on-device, runs the dedupe
 * lookup — top-1 of the same kNN `search()` the check flow uses — and, when
 * the best prior report is below `THRESHOLDS.MERGE`, stores a new VectorsDB
 * document carrying the vector plus the report metadata and a doc-level
 * delete permission for the reporter (so only the author can delete their own
 * report). A hit at or above MERGE means this scam is already on file: the
 * call aborts with outcome `duplicate` and creates nothing — folding the
 * report into the existing document (`report_count++`) is the merge path,
 * a separate issue.
 *
 * Errors propagate raw (Appwrite/SDK failures are rendered by the caller;
 * this module never swallows them). The optional `onStage` callback only
 * reports pipeline progress for UI loading lines and never changes behavior.
 *
 * Public surface: `createReport()` plus the `CreateReportInput`,
 * `CreateReportResult`, `CreateStage` types.
 */
import { ID, Permission, Role } from 'appwrite';
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
  | { outcome: 'duplicate'; matched: SearchResult; similarity: number };

export async function createReport(
  input: CreateReportInput,
  onStage?: (stage: CreateStage) => void,
): Promise<CreateReportResult> {
  const text = input.text.trim();
  onStage?.('embedding');
  const vector = await embed(text);
  // Dedupe-before-write: top-1 of the kNN search (k=10 width, read as one
  // nearest hit). ≥ MERGE means the same scam is already on file.
  onStage?.('searching');
  const [top] = await search(vector);
  if (top && top.similarity >= THRESHOLDS.MERGE) {
    return { outcome: 'duplicate', matched: top, similarity: top.similarity };
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
