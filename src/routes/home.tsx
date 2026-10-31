import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { embed, onEmbedLog } from '../lib/embedder';
import type { EmbedProgress } from '../lib/embedder';
import { verdict as runVerdict } from '../lib/search';
import type { Verdict } from '../lib/search';
import { SPRING_PRESS } from '../lib/ease';
import { VerdictCard } from '../components/verdict-card';
import { ShaderErrorBoundary } from '../components/shader-error-boundary';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { Loader } from '../components/motion/loader';
import { TextScramble } from '../components/motion/text-scramble';

// Lazy hero band: the shader library stays out of the critical render path
// AND mounts only at browser idle — its evaluation must not sit in the load
// window's long-task budget (LCP is the headline, which paints before it).
const HeroShader = lazy(() => import('../components/hero-shader'));

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

  // Prewarm the model — but never inside the page-load window: a 23 MB
  // download starting at mount keeps the network busy on a throttled
  // connection, which drags TTI out and drags every main-thread task of the
  // following seconds into TBT (Lighthouse mobile paid ~14 s of window for
  // it). Warm on the user's first interaction (they are about to paste) or
  // after a generous delay, whichever comes first; a Check click before the
  // warmup simply downloads on demand with the loading UI showing.
  useEffect(() => {
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('focusin', warm);
      void embed('warmup').catch(() => undefined);
    };
    window.addEventListener('pointerdown', warm, { once: true });
    window.addEventListener('focusin', warm, { once: true });
    const timer = window.setTimeout(warm, 6000);
    return () => {
      window.removeEventListener('pointerdown', warm);
      window.removeEventListener('focusin', warm);
      window.clearTimeout(timer);
    };
  }, []);

  // The hero shader mounts at browser idle: LCP is the headline text (paints
  // before it), so sliding the WebGL chunk's evaluation out of the load
  // window costs nothing visible and removes its long task from TBT.
  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => {
    const id = window.requestIdleCallback(() => setHeroReady(true), { timeout: 3000 });
    return () => window.cancelIdleCallback(id);
  }, []);

  // Keep only the newest progress line for the loading status; StrictMode-safe
  // (onEmbedLog returns an unsubscribe used as the effect cleanup).
  useEffect(
    () => onEmbedLog((entries) => setLastLog(entries[entries.length - 1] ?? null)),
    [],
  );

  const busy = phase === 'embedding' || phase === 'searching';
  const reduce = useReducedMotion();

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
      <header className="relative overflow-hidden rounded-3xl border border-border px-6 py-10">
        <ShaderErrorBoundary>
          <Suspense fallback={<div aria-hidden="true" className="absolute inset-0" />}>
            {heroReady && <HeroShader />}
          </Suspense>
        </ShaderErrorBoundary>
        <div className="relative">
          <h1 className="font-display text-5xl font-bold tracking-tight">
            <TextScramble text="Magpie" />
          </h1>
          <p className="mt-3 text-muted-foreground">
            Paste a suspicious message — it gets embedded in your browser and matched against the
            crowd-sourced corpus of reported scams.
          </p>
        </div>
      </header>

      {/* GlassyUI panel (issue #17): role="region" keeps the old <section aria-label> semantics. */}
      <GlassPanel
        role="region"
        aria-label="Check a message"
        className="focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/40"
      >
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor="check-input" className="block text-sm font-medium text-slate-300">
            Message to check
          </label>
          <span
            data-testid="char-counter"
            className="rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground"
          >
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
        <motion.span
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={SPRING_PRESS}
          className="mt-4 inline-block w-fit"
        >
          <GlassButton
            type="button"
            lens={false}
            data-testid="check-button"
            disabled={busy || !text.trim()}
            onClick={handleCheck}
            className="min-h-[44px] min-w-[44px] w-fit rounded-full bg-iridescent"
          >
            Check
          </GlassButton>
        </motion.span>
      </GlassPanel>

      {busy && (
        <GlassPanel data-testid="check-loading" role="status" aria-busy="true">
          <div className="flex items-center gap-3">
            <Loader
              variant="spinner"
              size={24}
              label={phase === 'embedding' ? 'embedding locally…' : 'searching the corpus…'}
            />
            <p className="font-mono text-sm text-slate-400">
              {phase === 'embedding' ? 'embedding locally…' : 'searching the corpus…'}
            </p>
          </div>
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
