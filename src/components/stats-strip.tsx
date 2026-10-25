/**
 * The /browse stats strip (issue #12, PRD §7.3): corpus total, rolling
 * 7-day count, one chip per category, and the top-category callout — the
 * anonymous visitor's evidence layer above the feed.
 *
 * Presentational only: every number comes in via the `stats` prop (the
 * `getCorpusStats()` fetch lives in `browse.tsx`, the route's mount idiom).
 * Three states, mirroring `browse.tsx`'s state blocks: skeleton pulse while
 * the counts load, amber mono error when the fetch failed, and the strip
 * itself. All strings render through `{expr}` text children only (React
 * escapes them — same idiom as `feed-item.tsx`), and counts are plain
 * template-literal integers with no separators, so black-box probes can
 * parse them.
 *
 * Public surface: `StatsStrip`.
 */
import type { CorpusStats } from '../lib/stats';

/** Mirror of `browse.tsx`'s glass-panel styling. */
const GLASS_PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur';

/** Mirror of `feed-item.tsx`'s chip pill styling. */
const CHIP_CLASSES =
  'rounded-full border border-slate-700/70 bg-slate-800/60 px-2 py-0.5 text-xs text-slate-300';

/** `1 report` (singular) / `N reports` — plain integer, no separators. */
function reports(count: number): string {
  return count === 1 ? '1 report' : `${count} reports`;
}

export function StatsStrip({ stats, error }: { stats: CorpusStats | null; error: string | null }) {
  if (error) {
    return (
      <p role="alert" data-testid="stats-error" className="font-mono text-sm text-amber-400">
        {error}
      </p>
    );
  }

  if (stats === null) {
    return (
      <div data-testid="stats-loading" role="status" className={GLASS_PANEL}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/3 rounded bg-slate-800" />
          <div className="h-2 w-3/4 rounded-full bg-slate-800/80" />
          <div className="h-2 w-2/3 rounded-full bg-slate-800/80" />
        </div>
        <p className="mt-4 font-mono text-sm text-slate-400">counting the corpus…</p>
      </div>
    );
  }

  return (
    <section data-testid="stats-strip" className={GLASS_PANEL}>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <p data-testid="stats-total" className="text-lg font-semibold text-slate-100">
          {reports(stats.total)}
        </p>
        <p data-testid="stats-week" className="font-mono text-sm text-slate-400">
          {`${stats.thisWeek} this week`}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {stats.perCategory.map(({ category, count }) => (
          <span key={category} data-testid="stats-category" data-category={category} className={CHIP_CLASSES}>
            {`${category} ${count}`}
          </span>
        ))}
      </div>
      {stats.top && (
        <p data-testid="stats-top" className="mt-4 text-sm text-slate-300">
          {`${stats.top.category} is the most reported category this week in the corpus`}
        </p>
      )}
    </section>
  );
}
