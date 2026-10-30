import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { embed } from '../lib/embedder';
import { createReport } from '../lib/reports';
import { CATEGORIES, CHANNELS, DEFAULT_CATEGORY, DEFAULT_CHANNEL } from '../lib/constants';
import type { Category, Channel } from '../lib/constants';
import { useReporterId } from '../lib/reporter';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassInput } from '../components/glassyui/glass-input';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { GlassSkeleton } from '../components/glassyui/glass-skeleton';

/** Hard CAP on the paste box — same cap as the check page (home idiom). */
const MAX_CHARS = 1000;

/** Free-text hints only; any region value is accepted and stored verbatim (trimmed). */
const REGION_SUGGESTIONS = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'National'];

type Phase = 'idle' | 'embedding' | 'searching' | 'saving';

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  embedding: 'embedding locally…',
  searching: 'searching the corpus…',
  saving: 'saving report…',
};

export default function Report() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Anonymous reporting: the device-local reporter id stamps ownership (it is
  // what later allows hide-own on /browse — no account involved).
  const reporterId = useReporterId();
  // Prefill from ?text= (check-CTA handoff), capped like any manual input.
  const [text, setText] = useState(() => (searchParams.get('text') ?? '').slice(0, MAX_CHARS));
  const [category, setCategory] = useState<Category>(DEFAULT_CATEGORY);
  const [channel, setChannel] = useState<Channel>(DEFAULT_CHANNEL);
  const [region, setRegion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== 'idle';

  // Prewarm the model on mount (one discarded forward pass): the ~23 MB
  // download must not land inside the first Submit click. Home idiom.
  useEffect(() => {
    void embed('warmup').catch(() => undefined);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPhase('embedding');
    try {
      const result = await createReport(
        { text, category, channel, region, reporterId },
        (stage) => setPhase(stage),
      );
      if (result.outcome === 'created') {
        navigate('/report/success', { replace: true });
        return;
      }
      // Merge (issue #9): the count travels as query params — state is lost on
      // reload, and the toast must survive a direct GET of the final URL.
      navigate(`/report/success?outcome=merged&count=${result.reportCount}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('idle');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Report a scam</h1>
        <p className="mt-3 text-slate-400">
          Paste the suspicious message — it is embedded on this device, checked against the corpus
          for duplicates and, if new, added for everyone&apos;s next check. No account needed.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <GlassPanel>
          <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="report-input" className="block text-sm font-medium text-slate-300">
            Message received
          </label>
          <span data-testid="char-counter" className="font-mono text-xs text-slate-500">
            {`${text.length}/${MAX_CHARS}`}
          </span>
        </div>
        <textarea
          id="report-input"
          data-testid="report-input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          maxLength={MAX_CHARS}
          rows={5}
          placeholder="Paste the scam message…"
          className="mt-3 min-h-[44px] w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4 font-mono text-base text-slate-200 placeholder:text-slate-600"
        />
        <p className="mt-3 text-xs text-slate-500">
          Capped at 1,000 characters. Your text never leaves this device — only an anonymous vector
          is used for the duplicate check.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="report-category" className="block text-sm font-medium text-slate-300">
              Category
            </label>
            <select
              id="report-category"
              data-testid="report-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-base text-slate-200"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-channel" className="block text-sm font-medium text-slate-300">
              Channel
            </label>
            <select
              id="report-channel"
              data-testid="report-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-base text-slate-200"
            >
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          {/* GlassyUI input (issue #17): renders its own optional label; the
              free-text datalist and verbatim value stay as before. */}
          <GlassInput
            id="report-region"
            data-testid="report-region"
            label="Region (optional)"
            list="region-suggestions"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Lagos — or leave blank"
            className="min-h-[44px]"
          />
          <datalist id="region-suggestions">
            {REGION_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>

          <GlassButton type="submit" lens={false} data-testid="report-submit" disabled={busy || !text.trim()} className="mt-4 min-h-[44px] min-w-[44px]">
            Submit report
          </GlassButton>
        </GlassPanel>
      </form>

      {busy && (
        <GlassPanel data-testid="report-loading" role="status" aria-busy="true">
          <GlassSkeleton className="h-4 w-1/3" variant="block" />
          <GlassSkeleton className="mt-3 w-full" variant="text" lines={3} />
          <p className="mt-4 font-mono text-sm text-slate-400">{PHASE_LABEL[phase]}</p>
        </GlassPanel>
      )}

      {error && (
        <p role="alert" data-testid="report-error" className="font-mono text-sm text-amber-400">
          {error}
        </p>
      )}

      <div className="flex gap-6">
        <Link to="/" className="text-sky-400 underline-offset-4 hover:underline">
          ← Check a message
        </Link>
      </div>
    </main>
  );
}
