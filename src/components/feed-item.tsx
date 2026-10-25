/**
 * One /browse feed row (issue #11): text snippet (first 120 chars), category
 * / channel / region chips, report count, and a relative age for the
 * document's `$createdAt` — plus, since issue #13, a Hide button on rows the
 * current session user authored (`metadata.reporter_id` match). Hide is the
 * app's only moderation: a `window.confirm` guard, then the parent's
 * `onHide` (soft-hide via `./lib/reports.ts`) runs; a failure renders inline
 * as `feed-hide-error` and leaves the row untouched.
 *
 * All user-sourced content — snippet, chip labels, count — renders through
 * `{expr}` text children only; React escapes `<`, `>` and `&`, so a seeded
 * report containing `<img src=x>` displays as literal text and no `<a>`,
 * `<img>` or `<script>` tag can ever be attributed to it. The `snippet()`,
 * `reports()` and `CHIP_CLASSES` helpers are deliberate twins of the reviewed
 * `verdict-card.tsx` idioms (kept private rather than refactoring that card —
 * see issue #11's plan); the only new logic is `formatRelative()` and the
 * Hide interaction.
 *
 * Public surface: `FeedItem`.
 */
import { useState } from 'react';
import type { FeedItemData } from '../lib/feed';

/** Snippet length per feed item: first 120 chars of the stored text (verdict-card convention). */
const SNIPPET_CHARS = 120;

/** Mirror of `verdict-card.tsx`'s chip pill styling. */
const CHIP_CLASSES =
  'rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300';

/** First 120 chars, with an ellipsis when the stored text runs longer. */
function snippet(text: string): string | null {
  if (!text) return null;
  return text.length > SNIPPET_CHARS ? `${text.slice(0, SNIPPET_CHARS)}…` : text;
}

/** `1 report` (singular) / `N reports`; renders nothing for non-numeric counts. */
function reports(count: number): string | null {
  if (!Number.isFinite(count)) return null;
  return count === 1 ? '1 report' : `${count} reports`;
}

/**
 * Relative age of an ISO timestamp: `just now`, then minute/hour/day tiers,
 * 30-day month blocks, 365-day year blocks. Unparseable input falls back to
 * the raw string rather than inventing a fake age.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return pluralAgo(minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return pluralAgo(hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 30) return pluralAgo(days, 'day');
  const months = Math.floor(days / 30);
  if (months < 12) return pluralAgo(months, 'month');
  return pluralAgo(Math.floor(days / 365), 'year');
}

/** `N unit(s) ago`, e.g. `1 minute ago` / `3 hours ago`. */
function pluralAgo(n: number, unit: string): string {
  const count = n === 1 ? `1 ${unit}` : `${n} ${unit}s`;
  return `${count} ago`;
}

export function FeedItem({
  item,
  currentUserId,
  onHide,
}: {
  item: FeedItemData;
  currentUserId?: string;
  onHide?: (id: string) => Promise<void>;
}) {
  const snippetText = snippet(item.text);
  const reportsText = reports(item.reportCount);
  const [hiding, setHiding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Hide chip click (issue #13): confirm, run the parent's soft-hide, surface failures inline. */
  async function handleHide() {
    if (!onHide || hiding) return;
    if (!window.confirm('Hide this report? It will disappear from the feed for everyone.')) return;
    setHiding(true);
    setError(null);
    try {
      await onHide(item.id);
      // Success: the parent drops the row — leave `hiding` up, the item unmounts.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setHiding(false);
    }
  }
  return (
    <li
      data-testid="feed-item"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg backdrop-blur"
    >
      {snippetText && (
        <p data-testid="feed-snippet" className="break-words text-sm text-slate-200">
          {snippetText}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.category && (
          <span data-testid="feed-category" className={CHIP_CLASSES}>
            {item.category}
          </span>
        )}
        {item.channel && (
          <span data-testid="feed-channel" className={CHIP_CLASSES}>
            {item.channel}
          </span>
        )}
        {item.region && (
          <span data-testid="feed-region" className={CHIP_CLASSES}>
            {item.region}
          </span>
        )}
        {reportsText && (
          <span data-testid="feed-reports" className={CHIP_CLASSES}>
            {reportsText}
          </span>
        )}
        {item.createdAt && (
          <span data-testid="feed-created" className="font-mono text-xs text-slate-500">
            {formatRelative(item.createdAt)}
          </span>
        )}
        {currentUserId && onHide && item.reporterId === currentUserId && (
          <button
            type="button"
            data-testid="feed-hide"
            aria-label="Hide this report"
            disabled={hiding}
            onClick={() => {
              void handleHide();
            }}
            className="rounded-xl border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {hiding ? 'Hiding…' : 'Hide'}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" data-testid="feed-hide-error" className="mt-2 font-mono text-sm text-amber-400">
          {error}
        </p>
      )}
    </li>
  );
}
