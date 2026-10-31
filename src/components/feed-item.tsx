/**
 * One /browse feed row (issue #11): text snippet (first 120 chars), category
 * / channel / region chips, report count, and a relative age for the
 * report's `createdAt` — plus, since issue #13, a Hide button on rows the
 * current browser authored (`reporterId` match against the device-local id).
 * Hide is the app's only moderation: a `window.confirm` guard, then the
 * parent's `onHide` (soft-hide via `./lib/reports.ts`) runs; a failure
 * renders inline as `feed-hide-error` and leaves the row untouched.
 *
 * Issue #46: the category chip picks up its per-category CSS variable from
 * the token layer (`src/index.css`); on narrow viewports (under 640px) rows
 * the current reporter authored become swipeable via beUI `SwipeableList` —
 * swiping reveals the Hide action, which runs the exact same `handleHide`
 * flow as the desktop button (the inline button is omitted only there; on
 * desktop it stays a plain button). Under reduced motion the swipe path is
 * off and every row renders the plain button.
 *
 * All user-sourced content — snippet, chip labels, count — renders through
 * `{expr}` text children only; React escapes `<`, `>` and `&`, so a seeded
 * report containing `<img src=x>` displays as literal text and no `<a>`,
 * `<img>` or `<script>` tag can ever be attributed to it. The `snippet()` and
 * `reports()` helpers are deliberate twins of the reviewed `verdict-card.tsx`
 * idioms (kept private rather than refactoring that card — see issue #11's
 * plan); the chip styling itself moved to GlassBadge in issue #17.
 *
 * Public surface: `FeedItem`.
 */
import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { EyeOff } from 'lucide-react';
import type { FeedItemData } from '../lib/feed';
import { CATEGORIES } from '../lib/constants';
import { GlassBadge } from './glassyui/glass-badge';
import type { GlassBadgeTone } from './glassyui/glass-badge';
import { useIsNarrow } from '../lib/hooks/use-is-narrow';
import { SwipeableList } from './motion/swipeable-list';

/** Snippet length per feed item: first 120 chars of the stored text (verdict-card convention). */
const SNIPPET_CHARS = 120;

/** Chip tones shared with `verdict-card.tsx` (issue #17 mapping). */
const CHIP_TONES: Record<string, GlassBadgeTone> = {
  category: 'purple',
  channel: 'blue',
  region: 'green',
  reports: 'orange',
};

/** Per-category CSS variable (issue #46): the category chip reads its token
 * from the palette in `src/index.css` (`var(--color-category-<key>)`);
 * unknown values stay unstyled on the default tone. */
function categoryToken(category: string): string | undefined {
  return (CATEGORIES as readonly string[]).includes(category)
    ? `var(--color-category-${category})`
    : undefined;
}

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

/** The row's glass-card classes — token surface (issue #50), so the light
 * theme flips the row with the rest; the desktop `<li>` and the mobile
 * swipeable surface both read them, so the row looks identical either way. */
const ROW_CLASSES = 'rounded-2xl border border-border bg-card/60 p-4 shadow-lg backdrop-blur';

export function FeedItem({
  item,
  currentReporterId,
  onHide,
}: {
  item: FeedItemData;
  currentReporterId?: string;
  onHide?: (id: string) => Promise<void>;
}) {
  const snippetText = snippet(item.text);
  const reportsText = reports(item.reportCount);
  const [hiding, setHiding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Narrow-viewport swipe path (issue #46): static import, conditional render —
  // the swipeable list mounts only on small screens, without reduced motion,
  // and only on rows the current reporter can hide.
  const isNarrow = useIsNarrow();
  const reduce = useReducedMotion() ?? false;
  const canHide = Boolean(currentReporterId && onHide && item.reporterId === currentReporterId);
  const swipeable = isNarrow && !reduce && canHide;
  const categoryColor = item.category ? categoryToken(item.category) : undefined;

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

  // Shared row body: snippet, chips, age, inline error. The plain Hide button
  // renders inline only on the desktop path — on the swipeable path the same
  // `handleHide` runs from the revealed swipe action instead.
  const rowBody = (
    <>
      {snippetText && (
        <p data-testid="feed-snippet" className="break-words text-sm text-slate-200">
          {snippetText}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.category && (
          <GlassBadge
            data-testid="feed-category"
            tone={CHIP_TONES.category}
            style={categoryColor ? { color: categoryColor } : undefined}
          >
            {item.category}
          </GlassBadge>
        )}
        {item.channel && (
          <GlassBadge data-testid="feed-channel" tone={CHIP_TONES.channel}>
            {item.channel}
          </GlassBadge>
        )}
        {item.region && (
          <GlassBadge data-testid="feed-region" tone={CHIP_TONES.region}>
            {item.region}
          </GlassBadge>
        )}
        {reportsText && (
          <GlassBadge data-testid="feed-reports" tone={CHIP_TONES.reports}>
            {reportsText}
          </GlassBadge>
        )}
        {item.createdAt && (
          <span data-testid="feed-created" className="font-mono text-xs text-slate-500">
            {formatRelative(item.createdAt)}
          </span>
        )}
        {!swipeable && canHide && (
          <button
            type="button"
            data-testid="feed-hide"
            aria-label="Hide this report"
            disabled={hiding}
            onClick={() => {
              void handleHide();
            }}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
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
    </>
  );

  // Mobile: the row wraps a single-item swipeable list — swiping reveals the
  // Hide action running the same `handleHide` flow; a failed hide leaves the
  // row mounted with the inline error line above.
  if (swipeable) {
    return (
      <li data-testid="feed-item">
        <SwipeableList
          items={[
            {
              id: item.id,
              content: rowBody,
              rightActions: [
                {
                  id: 'hide',
                  label: <span data-testid="feed-hide">Hide</span>,
                  icon: <EyeOff aria-hidden className="h-4 w-4" />,
                  tone: 'danger',
                  disabled: hiding,
                  onClick: () => {
                    void handleHide();
                  },
                },
              ],
            },
          ]}
          classNames={{ surface: ROW_CLASSES }}
        />
      </li>
    );
  }

  return (
    <li data-testid="feed-item" className={ROW_CLASSES}>
      {rowBody}
    </li>
  );
}
