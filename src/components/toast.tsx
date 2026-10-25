/**
 * Toast (issue #9 contract, rebuilt on the GlassyUI registry in issue #17):
 * persistent merge confirmation on /report/success.
 *
 * Delegates to `GlassToast` (Radix) with `defaultOpen` + `duration={Infinity}`
 * — Infinity means Radix never starts an auto-dismiss timer, preserving the
 * issue-#9 "no auto-hide" pin. The `message` prop is rendered verbatim and the
 * `report-merge-toast` testid is pinned; the merge flow's exact contract string
 * (`merged — now <N> reports`, see `src/routes/report-success.tsx`) is set at
 * the single call site, which also mounts `GlassToastProvider` +
 * `GlassToastViewport`.
 *
 * Public surface: `Toast`.
 */
import { GlassToast, GlassToastDescription } from './glassyui/glass-toast';

export function Toast({ message }: { message: string }) {
  return (
    <GlassToast data-testid="report-merge-toast" defaultOpen duration={Infinity}>
      <GlassToastDescription>
        <span className="font-mono text-sm font-medium text-emerald-300">{message}</span>
      </GlassToastDescription>
    </GlassToast>
  );
}
