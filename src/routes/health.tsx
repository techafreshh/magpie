import { Link } from 'react-router';
import { useAppwriteHealth } from '../lib/useAppwriteHealth';

export default function Health() {
  const health = useAppwriteHealth();
  const payload = { status: 'ok', appwrite: health.ok ? 'reachable' : 'unreachable' } as const;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Health</h1>

      <pre
        data-testid="health-json"
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 font-mono text-sm text-emerald-300"
      >
        {JSON.stringify(payload)}
      </pre>

      <p className="text-sm text-slate-400">
        {health.detail}
        {!health.configured && (
          <span className="block mt-2 text-amber-400">
            Appwrite is not configured for this deployment — see <code>.env.example</code> and the
            README bootstrap steps.
          </span>
        )}
      </p>

      <Link to="/" className="text-sky-400 underline-offset-4 hover:underline">
        ← Back home
      </Link>
    </main>
  );
}
