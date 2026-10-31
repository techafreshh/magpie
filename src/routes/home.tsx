import { useEffect, useRef, useState } from 'react';
import { embed, onEmbedLog } from '../lib/embedder';
import type { EmbedProgress } from '../lib/embedder';
import { verdict as runVerdict } from '../lib/search';
import type { Verdict } from '../lib/search';
import { VerdictCard } from '../components/verdict-card';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { GlassSkeleton } from '../components/glassyui/glass-skeleton';

/** Hard CAP on the paste box (issue: "Textarea capped at 1,000 chars"). */
const MAX_CHARS = 1000;

type Phase = 'idle' | 'embedding' | 'searching' | 'done';

export default function Home() {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // The exact text that produced the current verdict, captured at check time —
  // the verdict card's report CTA must encode the checked message, not the
  // box's possibly edited current value.
  const [checkedText, setCheckedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastLog, setLastLog] = useState<EmbedProgress | null>(null);
  // Monotonic token mirroring the embedder's request-id correlation: checked
  // after each await so a slow earlier run can never land a stale verdict.
  const seqRef = useRef(0);

  // Prewarm the model on mount (one discarded forward pass): in a cold browser
  // profile the ~23 MB download would otherwise land inside the first Check
  // click and blow the 5 s budget.
  useEffect(() => {
    void embed('warmup').catch(() => undefined);
  }, []);

  // Keep only the newest progress line for the loading status; StrictMode-safe
  // (onEmbedLog returns an unsubscribe used as the effect cleanup).
  useEffect(
    () => onEmbedLog((entries) => setLastLog(entries[entries.length - 1] ?? null)),
    [],
  );

  const busy = phase === 'embedding' || phase === 'searching';

  async function handleCheck() {
    const submitted = text;
    const mySeq = ++seqRef.current;
    setError(null);
    setVerdict(null);
    setPhase('embedding');
    try {
      const vector = await embed(text);
      if (seqRef.current !== mySeq) return;
      setPhase('searching');
      const v = await runVerdict(vector);
      if (seqRef.current !== mySeq) return;
      setVerdict(v);
      setCheckedText(submitted);
      setPhase('done');
    } catch (err) {
      if (seqRef.current !== mySeq) return;
      setError(err instanceof Error ? err.message : String(err));
      setPhase('done');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-5xl font-bold tracking-tight">Magpie</h1>
        <p className="mt-3 text-slate-400">
          Paste a suspicious message — it gets embedded in your browser and matched against the
          crowd-sourced corpus of reported scams.
        </p>
      </header>

      {/* GlassyUI panel (issue #17): role="region" keeps the old <section aria-label> semantics. */}
      <GlassPanel role="region" aria-label="Check a message">
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="check-input" className="block text-sm font-medium text-slate-300">
            Message to check
          </label>
          <span data-testid="char-counter" className="font-mono text-xs text-slate-500">
            {`${text.length}/${MAX_CHARS}`}
          </span>
        </div>
        <textarea
          id="check-input"
          data-testid="check-input"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          maxLength={MAX_CHARS}
          rows={5}
          placeholder="Paste a suspicious message…"
          className="mt-3 min-h-[44px] w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-4 font-mono text-base text-slate-200 placeholder:text-slate-600"
        />
        <p className="mt-3 text-xs text-slate-500">
          Long input is capped at 1,000 characters; the embedding model reads roughly the first
          ~256 tokens. Your text never leaves this device — only an anonymous vector is sent for
          search.
        </p>
        <GlassButton
          type="button"
          lens={false}
          data-testid="check-button"
          disabled={busy || !text.trim()}
          onClick={handleCheck}
          className="mt-4 min-h-[44px] min-w-[44px] w-fit"
        >
          Check
        </GlassButton>
      </GlassPanel>

      {busy && (
        <GlassPanel data-testid="check-loading" role="status" aria-busy="true">
          <GlassSkeleton className="h-4 w-1/3" variant="block" />
          <GlassSkeleton className="mt-3 w-full" variant="text" lines={3} />
          <p className="mt-4 font-mono text-sm text-slate-400">
            {phase === 'embedding' ? 'embedding locally…' : 'searching the corpus…'}
          </p>
          {lastLog?.message && (
            <p className="mt-1 font-mono text-xs text-slate-600">{lastLog.message}</p>
          )}
        </GlassPanel>
      )}

      {error && (
        <p role="alert" data-testid="check-error" className="font-mono text-sm text-amber-400">
          {error}
        </p>
      )}

      <div aria-live="polite">
        {phase === 'done' && verdict && <VerdictCard verdict={verdict} checkedText={checkedText} />}
      </div>

    </main>
  );
}
