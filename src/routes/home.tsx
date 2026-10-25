import { Link } from 'react-router';
import { readConfig } from '../lib/appwrite';
import { useAppwriteHealth } from '../lib/useAppwriteHealth';

export default function Home() {
  const health = useAppwriteHealth();
  const config = readConfig();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-5xl font-bold tracking-tight">Magpie</h1>
        <p className="mt-3 text-slate-400">
          Paste a suspicious message — it gets embedded in your browser and matched against the
          crowd-sourced corpus of reported scams.
        </p>
      </header>

      <section
        aria-label="Appwrite connectivity"
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg backdrop-blur"
      >
        <h2 className="text-lg font-semibold text-slate-200">Appwrite connectivity</h2>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Endpoint</dt>
            <dd className="truncate font-mono text-slate-300">{config?.endpoint ?? 'not configured'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Project</dt>
            <dd className="truncate font-mono text-slate-300">{config?.projectId ?? 'not configured'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">VectorsDB</dt>
            <dd className={health.ok ? 'text-emerald-400' : 'text-amber-400'}>
              {health.ok ? 'reachable' : 'unreachable'}
              {health.detail !== 'checking' && <span className="block font-mono text-xs text-slate-500">{health.detail}</span>}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex gap-6">
        <Link to="/check" className="text-sky-400 underline-offset-4 hover:underline">
          Check page →
        </Link>
        <Link to="/health" className="text-sky-400 underline-offset-4 hover:underline">
          Health check →
        </Link>
      </div>
    </main>
  );
}
