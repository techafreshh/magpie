/**
 * Toast (issue #9): the merge confirmation surface on /report/success.
 *
 * Small persistent glass panel — no auto-hide timer, so the confirmation
 * never vanishes before it is seen (or read by a probe). The `message` prop
 * is rendered verbatim; the merge flow pins its exact contract string
 * (`merged — now <N> reports`, see `src/routes/report-success.tsx`) at the
 * single call site.
 *
 * Public surface: `Toast`.
 */

const TOAST_PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg backdrop-blur';

export function Toast({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" data-testid="report-merge-toast" className={TOAST_PANEL}>
      <span className="font-mono text-sm font-medium text-emerald-300">{message}</span>
    </p>
  );
}
