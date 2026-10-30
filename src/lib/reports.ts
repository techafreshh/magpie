/**
 * Report write path (issues #8 + #9): the corpus half of the Magpie pipeline.
 *
 * `createReport(input)` embeds the pasted message on-device and posts the
 * vector + metadata to the same-origin backend (`POST /api/reports`), which
 * runs the dedupe lookup — top-1 of the same kNN the check flow uses — and
 * takes one of two branches server-side:
 *
 * - At or above the merge threshold: no new document. The existing top hit is
 *   folded into itself — its `report_count` increments — and the response is
 *   `outcome: 'merged'` with the new count ("merged — now 48 reports").
 * - Below it: a new point is created for the report.
 *
 * Reporting is anonymous: `reporterId` is a device-local random id
 * (`./reporter`), stamped on the stored document so `hideReport()` can prove
 * ownership — the app's only moderation (issue #13) soft-hides the reporter's
 * own submission (`outcome` of the hide is the document disappearing from
 * feed and search, vector untouched).
 *
 * Errors propagate raw (network/ApiError failures are rendered by the caller;
 * this module never swallows them). The optional `onStage` callback only
 * reports pipeline progress for UI loading lines and never changes behavior.
 *
 * Public surface: `createReport()`, `hideReport()` plus the
 * `CreateReportInput`, `CreateReportResult`, `CreateStage` types.
 */
import { embed } from './embedder';
import { apiFetch } from './api';
import type { Category, Channel } from './constants';

export interface CreateReportInput {
  text: string;
  category: Category;
  channel: Channel;
  /** Free text; stored trimmed, may be empty. */
  region?: string;
  /** Device-local reporter id (./reporter) — drives hide-own ownership. */
  reporterId: string;
}

/** Pipeline stages, mirrored to the caller (UI loading line) as they start. */
export type CreateStage = 'embedding' | 'searching' | 'saving';

export type CreateReportResult =
  | { outcome: 'created'; documentId: string }
  | { outcome: 'merged'; documentId: string; reportCount: number };

export async function createReport(
  input: CreateReportInput,
  onStage?: (stage: CreateStage) => void,
): Promise<CreateReportResult> {
  const text = input.text.trim();
  onStage?.('embedding');
  const vector = await embed(text);
  // Dedupe-before-write runs server-side: the backend kNN-searches the corpus
  // with this vector and merges into any hit at/above its merge threshold,
  // else creates a new document. The 'searching'/'saving' labels collapse —
  // one round-trip — so the UI shows 'saving' for the whole write phase.
  onStage?.('searching');
  onStage?.('saving');
  return apiFetch<CreateReportResult>('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ vector, ...input, text }),
  });
}

/**
 * Soft-hide one of the reporter's own documents (issue #13): the app's only
 * moderation. The backend verifies `reporterId` matches the stored document's
 * `reporter_id` (403 otherwise) and sets `hidden` — removing the report from
 * feed and search for everyone without touching the stored vector. Errors
 * propagate raw — the calling row stays visible with its error line.
 */
export async function hideReport(documentId: string, reporterId: string): Promise<void> {
  await apiFetch(`/api/reports/${encodeURIComponent(documentId)}/hide`, {
    method: 'POST',
    body: JSON.stringify({ reporterId }),
  });
}
