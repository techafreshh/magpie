/**
 * /health — a JSON health panel over `GET /api/health` (the backend's own
 * verdict about the Qdrant collection). `getHealth()` never throws, so the
 * page always renders a payload; unreachable shows as `"qdrant":"unreachable"`
 * with the backend's detail line.
 */
import { useEffect, useState } from 'react';
import { getHealth } from '../lib/api';
import type { HealthPayload } from '../lib/api';

export default function Health() {
  const [health, setHealth] = useState<HealthPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHealth().then((result) => {
      if (!cancelled) setHealth(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const payload = {
    status: 'ok',
    qdrant: health?.qdrant === 'reachable' ? 'reachable' : 'unreachable',
  } as const;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Health</h1>

      <pre
        data-testid="health-json"
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 font-mono text-sm text-emerald-300"
      >
        {JSON.stringify(payload)}
      </pre>

      <p className="text-sm text-slate-400">
        {health?.detail ??
          (health === null ? 'checking…' : 'the vector database answered — the radar is live.')}
        {health?.qdrant === 'unreachable' && (
          <span className="block mt-2 text-amber-400">
            Qdrant is not reachable from the backend — see the README&apos;s database setup steps.
          </span>
        )}
      </p>

    </main>
  );
}
