import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router';
import { embed } from '../lib/embedder';
import { createReport } from '../lib/reports';
import { CATEGORIES, CHANNELS, DEFAULT_CATEGORY, DEFAULT_CHANNEL } from '../lib/constants';
import type { Category, Channel } from '../lib/constants';
import { useReporterId } from '../lib/reporter';
import { SPRING_PRESS } from '../lib/ease';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassInput } from '../components/glassyui/glass-input';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { GlassSkeleton } from '../components/glassyui/glass-skeleton';
import { Alert, AlertContent, AlertDescription, AlertIcon } from '../components/motion/alert';

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
  const reduce = useReducedMotion();

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
        <h1 className="font-display text-3xl font-bold tracking-tight">Report a scam</h1>
        <p className="mt-3 text-muted-foreground">
          Paste the suspicious message — it is embedded on this device, checked against the corpus
          for duplicates and, if new, added for everyone&apos;s next check. No account needed.
        </p>
      </header>

      <form onSubmit={handleSubmit}>
        <GlassPanel>
          <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="report-input" className="block text-sm font-medium text-foreground">
            Message received
          </label>
          <span data-testid="char-counter" className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
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
          className="mt-3 min-h-[44px] w-full rounded-2xl border border-border bg-muted p-4 font-mono text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Capped at 1,000 characters. Your text never leaves this device — only an anonymous vector
          is used for the duplicate check.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="report-category" className="block text-sm font-medium text-foreground">
              Category
            </label>
            {/*
              Select fallback (documented): the beUI `Select` was evaluated
              and deliberately not vendored — it is a `button` + `listbox`
              composite that emits `onValueChange` instead of native `change`
              events, `htmlFor` label association no longer targets a form
              control, and there is no submittable value without a synced
              hidden input. Syncing a hidden input creates a dual source of
              truth for keyboard, form-reset and autofill paths for zero
              visual gain, so the styled native `<select>` elements
              below are the deliberate fallback, keeping `report-category` /
              `report-channel` testids plus `value` / `onChange` untouched.
            */}
            <select
              id="report-category"
              data-testid="report-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-border bg-muted p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-channel" className="block text-sm font-medium text-foreground">
              Channel
            </label>
            <select
              id="report-channel"
              data-testid="report-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
              className="mt-2 min-h-[44px] w-full rounded-2xl border border-border bg-muted p-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
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

          <motion.span
            whileTap={reduce ? undefined : { scale: 0.97 }}
            transition={SPRING_PRESS}
            className="mt-4 inline-block w-fit"
          >
            <GlassButton type="submit" lens={false} data-testid="report-submit" disabled={busy || !text.trim()} className="min-h-[44px] min-w-[44px]">
              Submit report
            </GlassButton>
          </motion.span>
        </GlassPanel>
      </form>

      {busy && (
        <GlassPanel data-testid="report-loading" role="status" aria-busy="true">
          <GlassSkeleton className="h-4 w-1/3" variant="block" />
          <GlassSkeleton className="mt-3 w-full" variant="text" lines={3} />
          <p className="mt-4 font-mono text-sm text-muted-foreground">{PHASE_LABEL[phase]}</p>
        </GlassPanel>
      )}

      {error && (
        <>
          {/* beUI animated-alert (amber warning): default role="alert" preserved,
              existing report-error testid moved onto the Alert surface. */}
          <Alert variant="warning" data-testid="report-error" className="font-mono text-sm">
          <AlertIcon />
          <AlertContent>
            <AlertDescription>{error}</AlertDescription>
          </AlertContent>
          </Alert>
        </>
      )}

    </main>
  );
}
