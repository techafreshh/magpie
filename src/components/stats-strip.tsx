/**
 * The /browse stats strip (issue 12, PRD 7.3; rebuilt in issue 45): corpus
 * total and rolling 7-day count as large count-up numbers, the per-category
 * distribution as a beUI donut chart, and the top-category callout — the
 * anonymous visitor's evidence layer above the feed.
 *
 * Presentational only: every number comes in via the `stats` prop (the
 * `getCorpusStats()` fetch lives in `browse.tsx`, the route's mount idiom).
 * Three states, mirroring `browse.tsx`'s state blocks: skeleton pulse while
 * the counts load, amber mono error when the fetch failed, and the strip
 * itself. All strings render through `{expr}` text children only (React
 * escapes them — same idiom as `feed-item.tsx`), and counts are plain
 * integers with no separators, so black-box probes can parse them.
 *
 * The donut derives all seven segments by iterating `CATEGORIES` (the single
 * vocabulary source in `../lib/constants`) with colors as
 * `var(--color-category-<name>)` strings — no hardcoded category list, no
 * color literals. An all-zeros corpus renders an empty-chart placeholder
 * instead of mounting the donut, so no zero-total path math runs.
 *
 * Public surface: `StatsStrip`.
 */
import { CATEGORIES } from '../lib/constants';
import type { CorpusStats } from '../lib/stats';
import { AnimatedNumber } from './motion/animated-number';
import {
  DonutChart,
  DonutChartCenter,
  DonutChartLegend,
  DonutChartPlot,
  type DonutSegment,
} from './motion/donut-chart';

/** Mirror of `browse.tsx`'s glass-panel styling. */
const GLASS_PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur';

/** Plain-integer formatting (no separators) so probes can parse counts. */
function formatCount(n: number): string {
  return String(Math.round(n));
}

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

  const counts = new Map(stats.perCategory.map(({ category, count }) => [category, count] as const));
  const segments: DonutSegment[] = CATEGORIES.map((category) => ({
    id: category,
    name: category,
    color: `var(--color-category-${category})`,
    value: counts.get(category) ?? 0,
  }));
  const empty = stats.total === 0;

  return (
    <section data-testid="stats-strip" className={GLASS_PANEL}>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
        <div>
          <p data-testid="stats-total" className="text-5xl font-bold tracking-tight text-slate-100">
            <AnimatedNumber value={stats.total} format={formatCount} startOnView={false} />
          </p>
          <p className="mt-1 font-mono text-sm text-slate-400">{reports(stats.total)}</p>
        </div>
        <div>
          <p data-testid="stats-week" className="text-5xl font-bold tracking-tight text-slate-100">
            <AnimatedNumber value={stats.thisWeek} format={formatCount} startOnView={false} />
          </p>
          <p className="mt-1 font-mono text-sm text-slate-400">{`${stats.thisWeek} this week`}</p>
        </div>
      </div>
      {empty ? (
        <p data-testid="stats-empty" className="mt-6 text-sm text-slate-400">
          {`No category data yet`}
        </p>
      ) : (
        <DonutChart
          segments={segments}
          label="Category share"
          formatValue={formatCount}
          className="mt-6"
        >
          <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,16rem)_1fr]">
            <DonutChartPlot>
              <DonutChartCenter totalLabel="reports" />
            </DonutChartPlot>
            <DonutChartLegend />
          </div>
        </DonutChart>
      )}
      {stats.top && (
        <p data-testid="stats-top" className="mt-4 text-sm text-slate-300">
          {`${stats.top.category} is the most reported category this week in the corpus`}
        </p>
      )}
    </section>
  );
}
