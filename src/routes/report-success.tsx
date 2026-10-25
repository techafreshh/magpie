import { Link } from 'react-router';

const GLASS_PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur';

/**
 * Post-create confirmation (issue #8). Standalone route — reads no navigation
 * state, so a direct GET of /report/success renders the same pinned copy.
 */
export default function ReportSuccess() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Report a scam</h1>
      <section data-testid="report-success" aria-live="polite" className={GLASS_PANEL}>
        <h2 data-testid="report-success-title" className="text-2xl font-semibold text-emerald-300">
          Report created — first report
        </h2>
        <p className="mt-3 text-slate-400">
          Your report is part of the corpus now — the next person who checks this message sees a
          high-risk verdict. If the same scam is reported again, the reports will be merged under
          this entry with a counter.
        </p>
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
        </div>
      </section>
    </main>
  );
}
