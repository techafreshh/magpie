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
 * numbered feed with Prev/Next. Above the feed sits the issue-#12 stats
 * strip (`StatsStrip` over `getCorpusStats()`, fetched once per mount with
 * its own `cancelled` guard) — independent of the feed fetch, so a stats
 * failure degrades to its own amber line without ever blanking the feed.
 *
 * Issue #13: the device-local reporter id resolves once per mount
 * (`useReporterId`) and travels down as `currentReporterId`; rows this browser
 * authored get a Hide chip whose `handleHide` soft-hides the document
 * (`hideReport`) and drops the row from local state — gone immediately, and
 * every later refetch stays consistent because the server filter excludes
 * hidden documents. A failed hide leaves the row with FeedItem's inline error
 * line. The fetch effect stays keyed on `page` only — identity resolution
 * must not refetch the feed.
 *
 * Public surface: default `Browse`.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FEED_PAGE_SIZE, listRecentReports } from '../lib/feed';
import type { FeedItemData } from '../lib/feed';
import { getCorpusStats } from '../lib/stats';
import type { CorpusStats } from '../lib/stats';
import { hideReport } from '../lib/reports';
import { useReporterId } from '../lib/reporter';
import { StatsStrip } from '../components/stats-strip';
import { FeedItem } from '../components/feed-item';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { GlassSkeleton } from '../components/glassyui/glass-skeleton';

/** Parse the 1-based `?page=` value; non-numeric, fractional or < 1 falls back to page 1. */
function parsePage(raw: string | null): number {
  const n = Number(raw ?? '1');
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  // Resolved once (report.tsx idiom): the device-local reporter id — rows this
  // browser authored get a Hide button. Not a fetch dependency.
  const currentReporterId = useReporterId();
  const [items, setItems] = useState<FeedItemData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stats-strip state, fetched independently of the feed: a stats failure
  // renders its own amber line and must never blank the feed (issue #12).
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

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

  // Corpus stats fetch once per mount — no polling (issue #12 out of scope).
  // Same `cancelled` guard as the feed effect, so StrictMode's double mount
  // and slow first responses can never land stale counts.
  useEffect(() => {
    let cancelled = false;
    getCorpusStats()
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((err) => {
        if (!cancelled) setStatsError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A page change (button click or back/forward) restarts the read from the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  function goto(next: number) {
    setSearchParams({ page: String(next) });
  }

  // Soft-hide (issue #13): the library call does the patch (ownership is the
  // device-local reporter id); dropping the id from local state makes the row
  // vanish with no refetch. No try/catch — a rejection propagates to
  // FeedItem's inline error line and the row stays.
  async function handleHide(id: string): Promise<void> {
    await hideReport(id, currentReporterId);
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
  }

  const hasNext = (items?.length ?? 0) === FEED_PAGE_SIZE;

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Browse recent reports</h1>
        <p className="mt-3 text-slate-400">
          The newest scam messages reported by the community — 25 per page, hidden reports
          excluded. Paste any of these into the check screen to see how the radar scores it.
        </p>
      </header>

      <StatsStrip stats={stats} error={statsError} />

      {error && (
        <p role="alert" data-testid="browse-error" className="font-mono text-sm text-amber-400">
          {error}
        </p>
      )}

      {items === null && !error && (
        <GlassPanel data-testid="browse-loading" role="status" aria-busy="true">
          <GlassSkeleton className="h-4 w-1/3" variant="block" />
          <GlassSkeleton className="mt-3 w-full" variant="text" lines={3} />
          <p className="mt-4 font-mono text-sm text-slate-400">loading the feed…</p>
        </GlassPanel>
      )}

      {items !== null && !error && items.length === 0 && (
        <GlassPanel data-testid="browse-empty">
          {/* Empty-state copy: "No reports yet" is the issue-#17 acceptance pin — keep verbatim. */}
          <p>No reports yet — be the first to report a scam.</p>
          <Link
            to="/report"
            className="mt-3 inline-block text-sky-400 underline-offset-4 hover:underline"
          >
            Report a scam →
          </Link>
        </GlassPanel>
      )}

      {items !== null && !error && items.length > 0 && (
        <>
          <ol className="space-y-4">
            {items.map((item) => (
              <FeedItem key={item.id} item={item} currentReporterId={currentReporterId} onHide={handleHide} />
            ))}
          </ol>
          <nav aria-label="Feed pagination" className="flex items-center justify-between gap-4">
            <GlassButton
              type="button"
              lens={false}
              data-testid="feed-prev"
              disabled={page <= 1}
              onClick={() => goto(page - 1)}
              className="min-h-[44px] min-w-[44px]"
            >
              Prev
            </GlassButton>
            <span data-testid="browse-page" className="font-mono text-sm text-slate-400">
              Page {page}
            </span>
            <GlassButton
              type="button"
              lens={false}
              data-testid="feed-next"
              disabled={!hasNext}
              onClick={() => goto(page + 1)}
              className="min-h-[44px] min-w-[44px]"
            >
              Next
            </GlassButton>
          </nav>
        </>
      )}
    </main>
  );
}
