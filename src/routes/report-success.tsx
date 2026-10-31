import { Link, useSearchParams } from 'react-router';
import { Toast } from '../components/toast';
import { GlassToastProvider, GlassToastViewport } from '../components/glassyui/glass-toast';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { AnimatedBadge } from '../components/motion/animated-badge';
import { AnimatedNumber } from '../components/motion/animated-number';

/**
 * Post-submit confirmation (issues #8 + #9). Standalone route — reads only
 * query params (never navigation state), so a direct GET of /report/success
 * renders the same pinned default copy, and a merge lands as
 * /report/success?outcome=merged&count=<N> with the exact toast string
 * `merged — now <N> reports` (em dash, always plural). Params survive a
 * reload, unlike navigation state.
 */
function parseCount(raw: string | null): number | null {
  if (raw === null) return null;
  const count = Number.parseInt(raw, 10);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

/** Plain-integer formatting (no separators) so probes can parse counts. */
function formatCount(n: number): string {
  return String(Math.round(n));
}

export default function ReportSuccess() {
  const [searchParams] = useSearchParams();
  const merged = searchParams.get('outcome') === 'merged';
  const count = parseCount(searchParams.get('count'));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Report a scam</h1>
      <GlassToastProvider swipeDirection="left">
        {/* Radix Toast.Root renders nothing until open — `defaultOpen` on the
            Toast below handles that; the viewport portals into <body>. */}
        <GlassToastViewport />
        <GlassPanel data-testid="report-success" aria-live="polite">
        <AnimatedBadge status="success" pulse={false} data-testid="report-success-badge">
          {merged ? 'merged' : 'reported'}
        </AnimatedBadge>
        {merged && count !== null && <Toast message={`merged — now ${count} reports`} />}
        {merged && count !== null ? (
          <>
            <h2 data-testid="report-success-title" className="mt-4 text-2xl font-semibold text-emerald-300">
              Report merged into an existing entry
            </h2>
            <p className="mt-3 text-muted-foreground">
              This message was already on file, so your report was folded into that entry — the
              corpus stays one-document-per-scam. The next person who checks the message sees the
              higher report count, a stronger signal.
            </p>
            <p data-testid="report-success-count" className="mt-4 font-mono text-sm text-muted-foreground">
              now{' '}
              <AnimatedNumber value={count} format={formatCount} startOnView={false} />{' '}
              reports
            </p>
          </>
        ) : (
          <>
            <h2 data-testid="report-success-title" className="mt-4 text-2xl font-semibold text-emerald-300">
              Report created — first report
            </h2>
            <p className="mt-3 text-muted-foreground">
              Your report is part of the corpus now — the next person who checks this message sees a
              high-risk verdict. If the same scam is reported again, the reports will be merged under
              this entry with a counter.
            </p>
          </>
        )}
        <div className="mt-4 flex gap-6">
          <Link
            to="/"
            data-testid="report-success-check"
            className="text-sky-400 underline-offset-4 hover:underline"
          >
            Check a message
          </Link>
          <Link
            to="/report"
            data-testid="report-success-again"
            className="text-sky-400 underline-offset-4 hover:underline"
          >
            Report another →
          </Link>
          <Link
            to="/browse"
            data-testid="report-success-browse"
            className="text-sky-400 underline-offset-4 hover:underline"
          >
            Browse reports →
          </Link>
        </div>
        </GlassPanel>
      </GlassToastProvider>
    </main>
  );
}
