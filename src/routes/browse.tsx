/**
 * /browse — the anonymous recent-reports feed (issue #11, PRD §7.3).
 *
 * Reads one page of the corpus per render: 25 newest non-hidden reports
 * (`listRecentReports` in `../lib/feed` carries the pinned query), each row a
 * `FeedItem` rendered as escaped plain text. Page number lives in the URL
 * (`?page=`, 1-based; the library call converts to the 0-based offset) so page
 * changes are deep-linkable and survive reload; the fetch re-runs keyed on
 * `page` with a `cancelled` guard (home.tsx idiom) so a slow earlier fetch
 * can never land a stale page. "Next" enables exactly when a full 25 came
 * back — the response's `total` counts all pages and would wrongly enable it
 * on the last partial page.
 *
 * States: skeleton (loading), amber mono error (propagated raw), a short
 * empty line when the corpus (page) has no visible reports, otherwise the
 * numbered feed with Prev/Next.
 *
 * Public surface: default `Browse`.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FEED_PAGE_SIZE, listRecentReports } from '../lib/feed';
import type { FeedItemData } from '../lib/feed';
import { FeedItem } from '../components/feed-item';

const GLASS_PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur';

const BUTTON_CLASSES =
  'rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:hover:bg-sky-600';

/** Parse the 1-based `?page=` value; non-numeric, fractional or < 1 falls back to page 1. */
function parsePage(raw: string | null): number {
  const n = Number(raw ?? '1');
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const [items, setItems] = useState<FeedItemData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch on every page change. `items === null` is the loading state — set
  // synchronously so a mid-pagination render never shows the previous page's
  // rows. The `cancelled` flag mirrors home.tsx's stale-response guard.
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    listRecentReports(page - 1)
      .then((docs) => {
        if (!cancelled) setItems(docs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  // A page change (button click or back/forward) restarts the read from the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  function goto(next: number) {
    setSearchParams({ page: String(next) });
  }

  const hasNext = (items?.length ?? 0) === FEED_PAGE_SIZE;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Browse recent reports</h1>
        <p className="mt-3 text-slate-400">
          The newest scam messages reported by the community — 25 per page, hidden reports
          excluded. Paste any of these into the check screen to see how the radar scores it.
        </p>
      </header>

      {error && (
        <p role="alert" data-testid="browse-error" className="font-mono text-sm text-amber-400">
          {error}
        </p>
      )}

      {items === null && !error && (
        <div data-testid="browse-loading" role="status" className={GLASS_PANEL}>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-slate-800" />
            <div className="h-2 w-3/4 rounded-full bg-slate-800/80" />
            <div className="h-2 w-2/3 rounded-full bg-slate-800/80" />
            <div className="h-2 w-full rounded-full bg-slate-800/80" />
          </div>
          <p className="mt-4 font-mono text-sm text-slate-400">loading the feed…</p>
        </div>
      )}

      {items !== null && !error && items.length === 0 && (
        <p data-testid="browse-empty" className={GLASS_PANEL}>
          No reports on this page yet — the feed fills up as the community reports scams.
        </p>
      )}

      {items !== null && !error && items.length > 0 && (
        <>
          <ol className="space-y-4">
            {items.map((item) => (
              <FeedItem key={item.id} item={item} />
            ))}
          </ol>
          <nav aria-label="Feed pagination" className="flex items-center justify-between gap-4">
            <button
              type="button"
              data-testid="feed-prev"
              disabled={page <= 1}
              onClick={() => goto(page - 1)}
              className={BUTTON_CLASSES}
            >
              Prev
            </button>
            <span data-testid="browse-page" className="font-mono text-sm text-slate-400">
              Page {page}
            </span>
            <button
              type="button"
              data-testid="feed-next"
              disabled={!hasNext}
              onClick={() => goto(page + 1)}
              className={BUTTON_CLASSES}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </main>
  );
}
