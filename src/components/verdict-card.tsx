/**
 * Verdict card (PRD §7.1): the check flow's answer surface.
 *
 * The card surface wraps in beUI `TiltCard` (3D tilt + glare), the tier badge
 * is beUI `AnimatedBadge` (HIGH RISK pulses red, SUSPICIOUS steady amber,
 * NO REPORTS steady neutral), and each match's similarity percentage
 * counts up via beUI `AnimatedNumber` — over the existing `GlassPanel` /
 * `GlassBadge` / similarity-bar visual base. For `NO_REPORTS` only the exact
 * no-prior-reports copy renders — listing sub-threshold neighbours under "no
 * prior reports" would contradict the wording (it gates on the SUSPICIOUS
 * threshold, retuned to 0.65 in issue #16 — the value lives in `THRESHOLDS`,
 * never duplicated here), so the match list is hidden in that tier — plus
 * the "Report this message" CTA linking to `/report?text=<urlencoded checked
 * text>` (issue #10) so a no-match check feeds the corpus; the report page
 * applies the session gate itself.
 *
 * Tilt safety (touch + reduced motion) lives inside `TiltCard` itself — its
 * internal `useReducedMotion` + `useHoverCapable` gate disables tilt and
 * glare on touch devices and under reduced motion — so this card adds no
 * second guard of its own.
 *
 * Contract strings (`HIGH RISK`, `SUSPICIOUS`, `NO_REPORTS_COPY`) are pinned
 * by the issue's acceptance — keep them verbatim; thresholds stay in
 * `THRESHOLDS` (`../lib/constants`) and are never retuned here.
 *
 * Public surface: `NO_REPORTS_COPY`, `MAX_DISPLAY_MATCHES`, `VerdictCard`.
 */
import { Link } from 'react-router';
import type { SearchResult, Verdict } from '../lib/search';
import { CATEGORIES, THRESHOLDS } from '../lib/constants';
import type { VerdictTier } from '../lib/constants';
import { SimilarityBar } from './similarity-bar';
import type { SimilarityTone } from './similarity-bar';
import { GlassBadge } from './glassyui/glass-badge';
import type { GlassBadgeTone } from './glassyui/glass-badge';
import { GlassPanel } from './glassyui/glass-panel';
import { TiltCard } from './motion/tilt-card';
import { AnimatedBadge } from './motion/animated-badge';
import type { AnimatedBadgeStatus } from './motion/animated-badge';
import { AnimatedNumber } from './motion/animated-number';

/** Exact copy for the no-reports tier — pinned verbatim by the issue. */
export const NO_REPORTS_COPY = 'no prior reports — unseen is not safe, stay sharp';

/** At most this many matches render on the card (issue: "top 3–5 matches"). */
export const MAX_DISPLAY_MATCHES = 5;

/** Snippet length per match: first 120 chars of the stored text. */
const SNIPPET_CHARS = 120;

const TIER_BADGE: Record<VerdictTier, { label: string; status: AnimatedBadgeStatus; pulse: boolean }> = {
  HIGH_RISK: {
    label: 'HIGH RISK',
    status: 'danger',
    pulse: true,
  },
  SUSPICIOUS: {
    label: 'SUSPICIOUS',
    status: 'warning',
    pulse: false,
  },
  NO_REPORTS: {
    label: 'NO REPORTS',
    status: 'neutral',
    pulse: false,
  },
};

const TIER_HEADLINE: Record<VerdictTier, string> = {
  HIGH_RISK: 'This message closely matches known reported scams.',
  SUSPICIOUS: 'This message resembles reported scams — treat it with care.',
  NO_REPORTS: 'Nothing in the corpus resembles this message.',
};

const CHIP_TONES: Record<string, GlassBadgeTone> = {
  category: 'purple',
  channel: 'blue',
  region: 'green',
  reports: 'orange',
};

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

function barTone(similarity: number): SimilarityTone {
  if (similarity >= THRESHOLDS.HIGH) return 'high';
  if (similarity >= THRESHOLDS.SUSPICIOUS) return 'suspicious';
  return 'neutral';
}

/** One corpus hit: snippet, chips, report count, similarity bar + count-up. */
function MatchRow({ match }: { match: SearchResult }) {
  const snippetText = snippet(match.text);
  const reportsText = reports(match.reportCount);
  const clamped = Math.min(1, Math.max(0, match.similarity));
  // The category chip picks up its per-category CSS variable (issue #41
  // palette) as inline text color; unknown values keep the default tone.
  const categoryStyle = (CATEGORIES as readonly string[]).includes(match.category)
    ? { color: `var(--color-category-${match.category})` }
    : undefined;
  return (
    <li
      data-testid="match-row"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg backdrop-blur"
    >
      {snippetText && (
        <p data-testid="match-snippet" className="break-words text-sm text-slate-200">
          {snippetText}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {match.category && (
          <GlassBadge
            data-testid="match-category"
            tone={CHIP_TONES.category}
            data-category={match.category}
            style={categoryStyle}
          >
            {match.category}
          </GlassBadge>
        )}
        {match.channel && (
          <GlassBadge data-testid="match-channel" tone={CHIP_TONES.channel}>
            {match.channel}
          </GlassBadge>
        )}
        {match.region && (
          <GlassBadge data-testid="match-region" tone={CHIP_TONES.region}>
            {match.region}
          </GlassBadge>
        )}
        {reportsText && (
          <GlassBadge data-testid="match-reports" tone={CHIP_TONES.reports}>
            {reportsText}
          </GlassBadge>
        )}
        {match.firstSeen && (
          <span className="font-mono text-xs text-slate-500">first seen {match.firstSeen}</span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="w-full">
          <SimilarityBar similarity={match.similarity} tone={barTone(match.similarity)} />
        </div>
        <AnimatedNumber
          value={clamped * 100}
          format={(n) => `${Math.round(n)}%`}
          className="w-10 shrink-0 text-right font-mono text-xs text-slate-400"
        />
      </div>
    </li>
  );
}

export function VerdictCard({
  verdict,
  checkedText,
}: {
  verdict: Verdict | null;
  checkedText: string;
}) {
  if (!verdict) return null;

  const badge = TIER_BADGE[verdict.tier];
  return (
    <TiltCard>
      <GlassPanel data-testid="verdict-card" role="region" aria-label="Check verdict">
        {verdict.tier === 'NO_REPORTS' ? (
          <>
            <AnimatedBadge
              status={badge.status}
              pulse={badge.pulse}
              data-testid="verdict-tier"
              className="font-display text-sm font-bold tracking-wide"
            >
              {badge.label}
            </AnimatedBadge>
            <p data-testid="verdict-copy" className="mt-3 text-lg font-medium text-slate-200">
              {NO_REPORTS_COPY}
            </p>
            <p className="mt-2 text-sm text-slate-500">{TIER_HEADLINE[verdict.tier]}</p>
            {/* CTA label and `/report?text=` href are pinned by issue #10's
                acceptance — keep them verbatim; `checkedText` is the text that
                produced this verdict (captured at check time in home.tsx) so the
                pre-filled report is provably about the same input. */}
            <Link
              to={`/report?text=${encodeURIComponent(checkedText)}`}
              data-testid="report-cta"
              className="mt-4 inline-flex min-h-[44px] items-center w-fit rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500"
            >
              Report this message
            </Link>
          </>
        ) : (
          <>
            <p className="flex items-center gap-3">
              <AnimatedBadge
                status={badge.status}
                pulse={badge.pulse}
                data-testid="verdict-tier"
                className="font-display text-sm font-bold tracking-wide"
              >
                {badge.label}
              </AnimatedBadge>
              <span className="text-sm text-slate-400">{TIER_HEADLINE[verdict.tier]}</span>
            </p>
            <ol className="mt-4 space-y-4">
              {verdict.matches.slice(0, MAX_DISPLAY_MATCHES).map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </ol>
          </>
        )}
      </GlassPanel>
    </TiltCard>
  );
}
