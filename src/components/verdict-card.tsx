/**
 * Verdict card (PRD §7.1): the check flow's answer surface.
 *
 * Renders the verdict tier badge (HIGH RISK red / SUSPICIOUS amber) with the
 * matching corpus hits — text snippet (first 120 chars), category / channel /
 * region chips, report count, and a 0–100% similarity bar per match. For
 * `NO_REPORTS` only the exact no-prior-reports copy renders — listing
 * sub-threshold neighbours under "no prior reports" would contradict the
 * wording (PRD §7.1 puts that panel below 0.80 similarity), so the match list
 * is hidden in that tier — plus the "Report this message" CTA linking to
 * `/report?text=<urlencoded checked text>` (issue #10) so a no-match check
 * feeds the corpus; the report page applies the session gate itself.
 *
 * Contract strings (`HIGH RISK`, `SUSPICIOUS`, `NO_REPORTS_COPY`) are pinned
 * by the issue's acceptance — keep them verbatim; thresholds stay in
 * `THRESHOLDS` (`../lib/constants`) and are never retuned here.
 *
 * Public surface: `NO_REPORTS_COPY`, `MAX_DISPLAY_MATCHES`, `VerdictCard`.
 */
import { Link } from 'react-router';
import type { SearchResult, Verdict } from '../lib/search';
import { THRESHOLDS } from '../lib/constants';
import type { VerdictTier } from '../lib/constants';
import { SimilarityBar } from './similarity-bar';
import type { SimilarityTone } from './similarity-bar';

/** Exact copy for the no-reports tier — pinned verbatim by the issue. */
export const NO_REPORTS_COPY = 'no prior reports — unseen is not safe, stay sharp';

/** At most this many matches render on the card (issue: "top 3–5 matches"). */
export const MAX_DISPLAY_MATCHES = 5;

/** Snippet length per match: first 120 chars of the stored text. */
const SNIPPET_CHARS = 120;

const TIER_BADGE: Record<Exclude<VerdictTier, 'NO_REPORTS'>, { label: string; classes: string }> = {
  HIGH_RISK: {
    label: 'HIGH RISK',
    classes: 'border-red-500/40 bg-red-500/15 text-red-400',
  },
  SUSPICIOUS: {
    label: 'SUSPICIOUS',
    classes: 'border-amber-500/40 bg-amber-500/15 text-amber-400',
  },
};

const TIER_HEADLINE: Record<VerdictTier, string> = {
  HIGH_RISK: 'This message closely matches known reported scams.',
  SUSPICIOUS: 'This message resembles reported scams — treat it with care.',
  NO_REPORTS: 'Nothing in the corpus resembles this message.',
};

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

function barTone(similarity: number): SimilarityTone {
  if (similarity >= THRESHOLDS.HIGH) return 'high';
  if (similarity >= THRESHOLDS.SUSPICIOUS) return 'suspicious';
  return 'neutral';
}

/** One corpus hit: snippet, chips, report count, similarity bar. */
function MatchRow({ match }: { match: SearchResult }) {
  const snippetText = snippet(match.text);
  const reportsText = reports(match.reportCount);
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
          <span data-testid="match-category" className={CHIP_CLASSES}>
            {match.category}
          </span>
        )}
        {match.channel && (
          <span data-testid="match-channel" className={CHIP_CLASSES}>
            {match.channel}
          </span>
        )}
        {match.region && (
          <span data-testid="match-region" className={CHIP_CLASSES}>
            {match.region}
          </span>
        )}
        {reportsText && (
          <span data-testid="match-reports" className={CHIP_CLASSES}>
            {reportsText}
          </span>
        )}
        {match.firstSeen && (
          <span className="font-mono text-xs text-slate-500">first seen {match.firstSeen}</span>
        )}
      </div>
      <div className="mt-3">
        <SimilarityBar similarity={match.similarity} tone={barTone(match.similarity)} />
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

  if (verdict.tier === 'NO_REPORTS') {
    return (
      <section
        data-testid="verdict-card"
        aria-label="Check verdict"
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur"
      >
        <p data-testid="verdict-copy" className="text-lg font-medium text-slate-200">
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
          className="mt-4 inline-block w-fit rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500"
        >
          Report this message
        </Link>
      </section>
    );
  }

  const badge = TIER_BADGE[verdict.tier];
  return (
    <section
      data-testid="verdict-card"
      aria-label="Check verdict"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur"
    >
      <p data-testid="verdict-tier" className="flex items-center gap-3">
        <span className={`rounded-full border px-3 py-1 text-sm font-bold tracking-wide ${badge.classes}`}>
          {badge.label}
        </span>
        <span className="text-sm text-slate-400">{TIER_HEADLINE[verdict.tier]}</span>
      </p>
      <ol className="mt-4 space-y-4">
        {verdict.matches.slice(0, MAX_DISPLAY_MATCHES).map((match) => (
          <MatchRow key={match.id} match={match} />
        ))}
      </ol>
    </section>
  );
}
