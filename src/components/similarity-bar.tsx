/**
 * Similarity bar (PRD §7.1 verdict card): horizontal 0–100% score bar.
 *
 * Bar-only: the track renders at full width and the fill carries an inline
 * `style.width` (similarity × 100, clamped to [0, 1], one decimal) so
 * DOM-level probes can read the percentage straight off the element — a
 * native `<progress>` would make that ambiguous to style and inspect. The
 * `%` label lives in the verdict card's beUI `AnimatedNumber` count-up (its
 * sole consumer), so this module owns the track + fill only; `aria-valuenow`
 * stays the exact programmatic percentage.
 *
 * The track reads the `muted` token (issue #50) so it flips with the theme;
 * the fill stays the red/amber/sky utility trio. Settled by construction —
 * no animation runs here, so reduced motion needs no gate.
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
    <div
      data-testid="similarity-track"
      className="h-2 w-full rounded-full bg-muted"
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
  );
}
