import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { embed, getEmbedLog, onEmbedLog } from '../lib/embedder';
import type { EmbedProgress } from '../lib/embedder';
import { GlassButton } from '../components/glassyui/glass-button';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { GlassSkeleton } from '../components/glassyui/glass-skeleton';

function formatLine(m: EmbedProgress): string {
  const stamp = new Date(m.ts).toISOString();
  const prefix = m.pct != null ? String(m.pct).padStart(3, ' ') + '%  ' : '';
  return `${stamp}  ${prefix}${m.message}`;
}

export default function Check() {
  const [log, setLog] = useState<EmbedProgress[]>(getEmbedLog());
  const [vector, setVector] = useState<number[]>([]);
  const [ms, setMs] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');

  // Subscribe before first render commits: onEmbedLog fires immediately with the current
  // log, so re-mounts still show earlier progress. StrictMode-safe (unsubscribe on cleanup).
  useEffect(() => onEmbedLog(setLog), []);

  async function handleEmbed() {
    setBusy(true);
    setError(null);
    setMs(null);
    try {
      const started = performance.now();
      const v = await embed(text);
      setMs(performance.now() - started);
      setVector(v);
    } catch (err) {
      setVector([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Check</h1>

      <p className="text-sm text-slate-400">
        Debug surface for the on-device embedder. The message below never leaves this device —
        it is embedded locally by transformers.js running in a Web Worker.
      </p>

      <label htmlFor="embed-input" className="block text-sm font-medium text-slate-300">
        Message to embed (stays on this device)
      </label>
      <textarea
        id="embed-input"
        data-testid="embed-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Paste a suspicious message…"
        className="min-h-[44px] rounded-2xl border border-slate-800 bg-slate-900/60 p-6 font-mono text-base text-slate-200"
      />

      <GlassButton
        type="button"
        lens={false}
        data-testid="embed-submit"
        disabled={busy}
        onClick={handleEmbed}
        className="min-h-[44px] min-w-[44px]"
      >
        Embed
      </GlassButton>

      {busy && (
        <div role="status" aria-busy="true">
          <GlassSkeleton className="h-4 w-1/3" variant="block" />
          <GlassSkeleton className="mt-3 w-full" variant="text" lines={2} />
          <p className="mt-4 font-mono text-sm text-slate-300">embedding…</p>
        </div>
      )}

      {!busy && error && (
        <p role="alert" data-testid="embed-error" className="font-mono text-sm text-amber-400">
          {error}
        </p>
      )}

      {!busy && vector.length > 0 && (
        <GlassPanel>
          <p data-testid="embed-result" className="font-mono text-emerald-300">
            dims: {vector.length}
          </p>
          {ms !== null && (
            <p className="mt-2 font-mono text-xs text-slate-500">
              {ms.toFixed(0)} ms
            </p>
          )}
        </GlassPanel>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-200">Embedder log</h2>
        <pre
          data-testid="embed-log"
          className="mt-4 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6 font-mono text-sm text-emerald-300"
        >
          {log.map(formatLine).join('\n')}
        </pre>
      </div>

      <Link to="/" className="text-sky-400 underline-offset-4 hover:underline">
        ← Back home
      </Link>
    </main>
  );
}
