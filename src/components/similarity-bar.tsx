/**
 * Similarity bar (PRD §7.1 verdict card): horizontal 0–100% score bar.
 *
 * The track renders at full width; the fill carries an inline `style.width`
 * (similarity × 100, clamped to [0, 1], one decimal) so DOM-level probes can
 * read the percentage straight off the element — a native `<progress>` would
 * make that ambiguous to style and inspect.
 *
 * Public surface: `SimilarityBar`, `SimilarityTone`.
 */

/** Fill color of the bar: red (high risk) / amber (suspicious) / sky (below suspicion). */
export type SimilarityTone = 'high' | 'suspicious' | 'neutral';

const TONE_FILL: Record<SimilarityTone, string> = {
  high: 'bg-red-500',
  suspicious: 'bg-amber-500',
  neutral: 'bg-sky-500',
};

export function SimilarityBar({ similarity, tone }: { similarity: number; tone: SimilarityTone }) {
  const clamped = Math.min(1, Math.max(0, similarity)) as number;
  return (
    <div className="flex items-center gap-3">
      <div
        data-testid="similarity-track"
        className="h-2 w-full rounded-full bg-slate-800/80"
      >
        <div
          data-testid="similarity-bar"
          role="progressbar"
          aria-label="match similarity"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clamped * 100)}
          className={`h-2 rounded-full ${TONE_FILL[tone]}`}
          style={{ width: `${(clamped * 100).toFixed(1)}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs text-slate-400">
        {Math.round(clamped * 100)}%
      </span>
    </div>
  );
}
