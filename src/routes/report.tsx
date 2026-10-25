import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { embed } from '../lib/embedder';
import { createReport } from '../lib/reports';
import { CATEGORIES, CHANNELS } from '../lib/constants';
import type { Category, Channel } from '../lib/constants';
import { useSession } from '../lib/useSession';

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

const GLASS_PANEL = 'rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur';

export default function Report() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Shared tri-state auth gate: `checking` never flashes the form on, any
  // failure (missing env, 401, CORS) degrades to `anonymous` — the sign-in
  // panel, never a raw error.
  const session = useSession();
  const status = session.status;
  const user = session.status === 'user' ? session.user : null;
  // Prefill from ?text= (check-CTA handoff), capped like any manual input.
  const [text, setText] = useState(() => (searchParams.get('text') ?? '').slice(0, MAX_CHARS));
  const [category, setCategory] = useState<Category>('other');
  const [channel, setChannel] = useState<Channel>('sms');
  const [region, setRegion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [duplicatePercent, setDuplicatePercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase !== 'idle';

  // Prewarm the model once the user is known (one discarded forward pass): the
  // ~23 MB download must not land inside the first Submit click. Home idiom.
  useEffect(() => {
    if (status !== 'user') return;
    void embed('warmup').catch(() => undefined);
  }, [status]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setDuplicatePercent(null);
    setPhase('embedding');
    try {
      const result = await createReport(
        { text, category, channel, region, reporterId: user.$id },
        (stage) => setPhase(stage),
      );
      if (result.outcome === 'created') {
        navigate('/report/success', { replace: true });
        return;
      }
      setDuplicatePercent(Math.round(result.similarity * 100));
      setPhase('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('idle');
    }
  }

  if (status === 'checking') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Report a scam</h1>
        <p data-testid="report-session-checking" className="font-mono text-sm text-slate-400">
          Checking session…
        </p>
      </main>
    );
  }

  if (status === 'anonymous') {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Report a scam</h1>
        <section data-testid="report-signin-required" className={GLASS_PANEL}>
          <h2 className="text-2xl font-semibold text-slate-200">Sign in required</h2>
          <p className="mt-3 text-slate-400">
            Reports carry their author&apos;s id so the corpus stays accountable — sign in first,
            then paste the scam message. No password: a one-time magic link is enough.
          </p>
          <Link
            to="/login"
            data-testid="report-signin-link"
            className="mt-4 inline-block w-fit rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500"
          >
            Sign in with a magic link
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Report a scam</h1>
        <p className="mt-3 text-slate-400">
          Paste the suspicious message — it is embedded on this device, checked against the corpus
          for duplicates and, if new, added for everyone&apos;s next check.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={GLASS_PANEL}>
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
          className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4 font-mono text-sm text-slate-200 placeholder:text-slate-600"
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
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200"
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
              className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200"
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
          <label htmlFor="report-region" className="block text-sm font-medium text-slate-300">
            Region <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id="report-region"
            data-testid="report-region"
            list="region-suggestions"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="e.g. Lagos — or leave blank"
            className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200 placeholder:text-slate-600"
          />
          <datalist id="region-suggestions">
            {REGION_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>

        <button
          type="submit"
          data-testid="report-submit"
          disabled={busy || !text.trim()}
          className="mt-4 w-fit rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Submit report
        </button>
      </form>

      {busy && (
        <div data-testid="report-loading" role="status" className={GLASS_PANEL}>
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-slate-800" />
            <div className="h-2 w-full rounded-full bg-slate-800/80" />
          </div>
          <p className="mt-4 font-mono text-sm text-slate-400">{PHASE_LABEL[phase]}</p>
        </div>
      )}

      {duplicatePercent !== null && (
        <p
          role="alert"
          data-testid="report-duplicate"
          className="rounded-2xl border border-amber-800/60 bg-amber-950/40 p-4 font-mono text-sm text-amber-400"
        >
          {`This message is already on file (${duplicatePercent}% similar) — not added again.`}
        </p>
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
