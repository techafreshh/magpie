/**
 * /map stub (issue #42): empty-state panel only. Issue #48 replaces this
 * file with the real d3-force vector constellation — so nothing here imports
 * map, graph, or layout code (and nothing pre-wires a lazy chunk for it).
 *
 * Public surface: default `MapPage`.
 */
import { Link } from 'react-router';
import { GlassPanel } from '../components/glassyui/glass-panel';

export default function MapPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[40rem] flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Map</h1>
      </header>

      <GlassPanel data-testid="map-stub" role="status">
        <p>The vector constellation arrives in #48.</p>
        <Link to="/" className="mt-3 inline-block text-sky-400 underline-offset-4 hover:underline">
          ← Back to the check
        </Link>
      </GlassPanel>
    </main>
  );
}
