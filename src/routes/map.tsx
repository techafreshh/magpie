/**
 * /map — the corpus constellation (issue #48): a lazy-loaded, canvas
 * force-directed graph of the whole corpus over pairwise cosine similarity.
 *
 * On mount it fetches `GET /api/map` (browse-style `cancelled` guard), then
 * `await import('d3-force')` — the physics engine is never statically
 * imported, so neither the main chunk nor this shell pays for it; Vite emits
 * it into its own lazy chunk. Pure math (fetch, cosine, edge-building, the
 * 2000-point cap) lives d3-free in `../lib/map-graph`.
 *
 * Simulation: link distance/strength proportional to similarity, mild
 * many-body repulsion, collision, centering. It stops after settling
 * (`alphaMin(0.02)` + a 4 s watchdog) and restarts only on threshold
 * changes; legend toggles only rebuild the link list and redraw (dimmed, no
 * re-simulation), so the layout stays put. Under reduced motion the layout
 * is ticked synchronously once (`sim.tick(300)`) and rendered settled —
 * no animation frames at all.
 *
 * Controls: a similarity-threshold slider (live edge rebuild), a category
 * legend (toggle/dim), hover/tap glass tooltip (snippet, category, report
 * count), tap-to-open beUI drawer with the full report text and a
 * `Check this message` CTA into `/?text=<encoded>`. Pan via drag, zoom via
 * wheel (at cursor) and pinch.
 *
 * Public surface: default `MapPage`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useReducedMotion } from 'motion/react';
import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import { CATEGORIES, THRESHOLDS } from '../lib/constants';
import { buildEdges, fetchMapPoints } from '../lib/map-graph';
import type { MapPoint } from '../lib/map-graph';
import { GlassBadge } from '../components/glassyui/glass-badge';
import { GlassPanel } from '../components/glassyui/glass-panel';
import { Loader } from '../components/motion/loader';
import { Drawer } from '../components/motion/drawer';

/** Slider bounds: default `THRESHOLDS.SUSPICIOUS`, spanning THRESHOLD_MIN–THRESHOLD_MAX. */
const THRESHOLD_MIN = 0.4;
const THRESHOLD_MAX = 0.95;
const THRESHOLD_STEP = 0.01;

/** First 120 chars of a report, verdict-card idiom. */
const SNIPPET_CHARS = 120;

/** Tap-vs-drag travel budget in css px. */
const TAP_TRAVEL = 6;

/** Cache of token-layer colors resolved for canvas use (issue #50): the
 * canvas API needs computed color values — neither hex literals nor `var()`
 * strings survive `fillStyle` — so every read goes through
 * `getComputedStyle` once and is cached per token. */
const colorCache = new Map<string, string>();

/** Resolve a `src/index.css` token to a canvas-usable color, cached per token. */
function tokenColor(token: string, fallback: string): string {
  const hit = colorCache.get(token);
  if (hit) return hit;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const resolved = raw || fallback;
  colorCache.set(token, resolved);
  return resolved;
}

/** Node fill: the report's per-category palette variable; unknown categories
 * fall back to the muted-foreground token (named-color safety net). */
function categoryColor(category: string): string {
  if ((CATEGORIES as readonly string[]).includes(category)) {
    return tokenColor(`--color-category-${category}`, 'teal');
  }
  return tokenColor('--color-muted-foreground', 'slategray');
}

/** Edge hairline color: the muted-foreground token, readable on both themes. */
function edgeColor(): string {
  return tokenColor('--color-muted-foreground', 'slategray');
}

interface SimNode extends SimulationNodeDatum {
  i: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  sim: number;
}

interface View {
  x: number;
  y: number;
  k: number;
}

function snippet(text: string): string {
  if (!text) return '';
  return text.length > SNIPPET_CHARS ? `${text.slice(0, SNIPPET_CHARS)}…` : text;
}

/** `1 report` (singular) / `N reports`, verdict-card idiom. */
function reports(count: number): string | null {
  if (!Number.isFinite(count)) return null;
  return count === 1 ? '1 report' : `${count} reports`;
}

/** Node radius scales mildly with report count (log scale, 2–6 px base). */
function nodeRadius(point: MapPoint): number {
  const count = Number.isFinite(point.reportCount) ? point.reportCount : 0;
  return 2 + Math.min(4, Math.log10(1 + count) * 2);
}

/** d3 types links as id-or-node unions; after init they are always nodes. */
function asNode(value: string | number | SimNode | undefined): SimNode | undefined {
  return typeof value === 'object' && value !== null ? value : undefined;
}

function edgeKey(threshold: number, hidden: ReadonlySet<string>): string {
  return `${threshold.toFixed(2)}|${[...hidden].sort().join(',')}`;
}

export default function MapPage() {
  const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(THRESHOLDS.SUSPICIOUS);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [hover, setHover] = useState<{ point: MapPoint; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reduce = useReducedMotion();

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<MapPoint[]>([]);
  const hiddenRef = useRef<ReadonlySet<string>>(new Set());
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const appliedRef = useRef<string>('');
  const watchdogRef = useRef(0);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef({ startX: 0, startY: 0, lastX: 0, lastY: 0, moved: 0, pinch: 0 });

  // The drawn edge set rebuilds live off the slider + legend (browse-style:
  // derived, never fetched). Strongest-first, capped — see map-graph.
  const edges = useMemo(
    () => (points ? buildEdges(points, hidden, threshold) : []),
    [points, hidden, threshold],
  );

  // Keep the imperative draw/sim world in sync with the latest render.
  // (links carry resolved node refs, so they are rebuilt imperatively in
  // the sim effects below — never derived during render.)
  pointsRef.current = points ?? [];
  hiddenRef.current = hidden;
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    const pts = pointsRef.current;
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const hiddenSet = hiddenRef.current;
    const { x: vx, y: vy, k } = viewRef.current;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + vx, h / 2 + vy);
    ctx.scale(k, k);

    // Hairline edges, opacity proportional to similarity, batched by
    // quantized alpha so 6000 links stay one handful of strokes.
    ctx.strokeStyle = edgeColor();
    ctx.lineWidth = 1 / k;
    let bucket = -1;
    let open = false;
    for (const e of links) {
      const b = Math.round(e.sim * 20);
      if (b !== bucket) {
        if (open) ctx.stroke();
        ctx.beginPath();
        ctx.globalAlpha = 0.05 + (b / 20) * 0.5;
        bucket = b;
        open = true;
      }
      const s = asNode(e.source);
      const t = asNode(e.target);
      if (s?.x == null || s?.y == null || t?.x == null || t?.y == null) continue;
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
    }
    if (open) ctx.stroke();
    ctx.globalAlpha = 1;

    // Nodes glow in their category color (#41 CSS variables); hidden
    // categories render dimmed with no glow so the layout stays stable.
    for (const n of nodes) {
      const p = pts[n.i];
      if (!p || n.x == null || n.y == null) continue;
      const dimmed = hiddenSet.has(p.category);
      const color = categoryColor(p.category);
      ctx.globalAlpha = dimmed ? 0.15 : 1;
      if (!dimmed) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(n.x, n.y, nodeRadius(p), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Hover/selection ring in screen space.
    const ringed = hover?.point ?? selected;
    if (ringed) {
      const idx = pts.indexOf(ringed);
      const n = idx >= 0 ? nodes[idx] : undefined;
      if (n?.x != null && n?.y != null) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5 / k;
        ctx.beginPath();
        ctx.arc(n.x, n.y, nodeRadius(ringed) + 3 / k, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }, [hover?.point, selected]);

  const drawRef = useRef(draw);
  drawRef.current = draw;

  // Fetch once on mount (browse.tsx idiom: null = loading, cancelled guard).
  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    setError(null);
    setReady(false);
    fetchMapPoints()
      .then((docs) => {
        if (!cancelled) setPoints(docs);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Build the simulation once the corpus (and the lazy physics) is in.
  // Reduced motion: tick synchronously to a settled layout and draw once —
  // no animation frames. Desktop: tick-driven draw with a settle watchdog.
  useEffect(() => {
    if (!points || points.length === 0) return;
    let cancelled = false;
    let sim: Simulation<SimNode, SimLink> | null = null;
    const n = points.length;
    (async () => {
      const d3 = await import('d3-force');
      if (cancelled) return;
      // Deterministic golden-angle disc: the reduced-motion path renders
      // this settled without ever animating, and the live path assembles
      // from a stable spread instead of a random scatter.
      const nodes: SimNode[] = points.map((_, i) => {
        const r = 190 * Math.sqrt((i + 0.5) / n);
        const a = i * 2.399963;
        return { i, x: r * Math.cos(a), y: r * Math.sin(a) };
      });
      nodesRef.current = nodes;
      simRef.current = null;
      const links: SimLink[] = edgesRef.current.map((e) => ({
        source: nodes[e.a] as SimNode,
        target: nodes[e.b] as SimNode,
        sim: e.sim,
      }));
      linksRef.current = links;
      sim = d3
        .forceSimulation<SimNode, SimLink>(nodes)
        .force(
          'link',
          d3
            .forceLink<SimNode, SimLink>(links)
            .distance((l) => 90 * (1 - l.sim) + 12)
            .strength((l) => l.sim),
        )
        .force('charge', d3.forceManyBody<SimNode>().strength(-28))
        .force('collide', d3.forceCollide<SimNode>(7))
        .force('center', d3.forceCenter<SimNode>(0, 0));
      sim.alphaMin(0.02);
      sim.on('tick', () => {
        drawRef.current();
      });
      simRef.current = sim;
      appliedRef.current = edgeKey(threshold, hidden);
      if (reduce) {
        sim.tick(300);
        sim.stop();
        drawRef.current();
      } else {
        window.clearTimeout(watchdogRef.current);
        watchdogRef.current = window.setTimeout(() => sim?.stop(), 4000);
      }
      if (!cancelled) setReady(true);
    })().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
      window.clearTimeout(watchdogRef.current);
      sim?.stop();
      if (simRef.current === sim) simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, reduce]);

  // Threshold / legend changes rebuild the link list live. The simulation
  // restarts only on threshold changes; legend toggles only swap links and
  // redraw (dimmed) with the layout untouched.
  useEffect(() => {
    const sim = simRef.current;
    if (!sim || !ready || !points || points.length === 0) return;
    const key = edgeKey(threshold, hidden);
    if (key === appliedRef.current) return;
    const prevKey = appliedRef.current;
    appliedRef.current = key;
    const nodes = nodesRef.current;
    const links: SimLink[] = edges.map((e) => ({
      source: nodes[e.a] as SimNode,
      target: nodes[e.b] as SimNode,
      sim: e.sim,
    }));
    linksRef.current = links;
    sim.force('link', null);
    // The link force is rebuilt via a fresh dynamic import so this shell
    // never statically depends on d3-force (see the mount effect above).
    (async () => {
      const d3 = await import('d3-force');
      const current = simRef.current;
      if (!current || appliedRef.current !== key) return;
      current.force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(linksRef.current)
          .distance((l) => 90 * (1 - l.sim) + 12)
          .strength((l) => l.sim),
      );
      // Legend-only toggles never re-simulate: the new link list is in
      // place for the next threshold restart, and the draw dims the rest.
      const thresholdChanged = prevKey.split('|')[0] !== threshold.toFixed(2);
      if (thresholdChanged) {
        if (reduce) {
          current.alpha(1);
          current.tick(300);
          current.stop();
        } else {
          current.alpha(1).restart();
          window.clearTimeout(watchdogRef.current);
          watchdogRef.current = window.setTimeout(() => current.stop(), 4000);
        }
      }
      drawRef.current();
    })().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [edges, threshold, hidden, ready, reduce, points]);

  // Canvas sizing: devicePixelRatio-scaled buffer + ResizeObserver re-fit.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      sizeRef.current = { w, h };
      setSize({ w, h });
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [ready, points]);

  // Wheel zoom at cursor (non-passive so the page doesn't scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const view = viewRef.current;
      const next = Math.min(4, Math.max(0.3, view.k * Math.exp(-e.deltaY * 0.0015)));
      const scale = next / view.k;
      view.x = sx - (sx - (rect.width / 2 + view.x)) * scale - rect.width / 2;
      view.y = sy - (sy - (rect.height / 2 + view.y)) * scale - rect.height / 2;
      view.k = next;
      drawRef.current();
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [ready]);

  function toLocal(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hitTest(sx: number, sy: number): MapPoint | null {
    const { w, h } = sizeRef.current;
    if (w === 0) return null;
    const view = viewRef.current;
    const wx = (sx - w / 2 - view.x) / view.k;
    const wy = (sy - h / 2 - view.y) / view.k;
    const tol = 14 / view.k;
    const pts = pointsRef.current;
    let best: MapPoint | null = null;
    let bestD = Infinity;
    for (const n of nodesRef.current) {
      if (n.x == null || n.y == null) continue;
      const p = pts[n.i];
      if (!p) continue;
      const d = Math.hypot(n.x - wx, n.y - wy);
      if (d < nodeRadius(p) + tol && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const at = toLocal(e);
    if (!canvas || !at) return;
    canvas.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, at);
    if (pointersRef.current.size === 1) {
      gestureRef.current = { startX: at.x, startY: at.y, lastX: at.x, lastY: at.y, moved: 0, pinch: 0 };
    } else if (pointersRef.current.size === 2) {
      const [p, q] = [...pointersRef.current.values()];
      if (p && q) gestureRef.current.pinch = Math.hypot(p.x - q.x, p.y - q.y);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const at = toLocal(e);
    if (!at) return;
    const stored = pointersRef.current.get(e.pointerId);
    if (!stored) {
      // Hover (no buttons): glass tooltip follows the node.
      const hit = hitTest(at.x, at.y);
      setHover(hit ? { point: hit, x: at.x, y: at.y } : null);
      return;
    }
    stored.x = at.x;
    stored.y = at.y;
    const view = viewRef.current;
    if (pointersRef.current.size === 2) {
      // Pinch zoom at the midpoint + two-finger pan.
      const [p, q] = [...pointersRef.current.values()];
      if (!p || !q) return;
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      const prev = gestureRef.current.pinch || dist;
      const midX = (p.x + q.x) / 2;
      const midY = (p.y + q.y) / 2;
      const next = Math.min(4, Math.max(0.3, view.k * (prev === 0 ? 1 : dist / prev)));
      const { w, h } = sizeRef.current;
      const scale = next / view.k;
      view.x = midX - (midX - (w / 2 + view.x)) * scale - w / 2;
      view.y = midY - (midY - (h / 2 + view.y)) * scale - h / 2;
      view.k = next;
      gestureRef.current.pinch = dist;
      gestureRef.current.moved += 1;
      drawRef.current();
      return;
    }
    // Single-pointer drag pans.
    const g = gestureRef.current;
    const dx = at.x - g.lastX;
    const dy = at.y - g.lastY;
    g.lastX = at.x;
    g.lastY = at.y;
    g.moved += Math.abs(dx) + Math.abs(dy);
    if (Math.abs(dx) + Math.abs(dy) > 0) {
      view.x += dx;
      view.y += dy;
      drawRef.current();
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const at = toLocal(e);
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size === 0 && at) {
      // Tap (small travel): select the node → drawer; otherwise dismiss.
      const g = gestureRef.current;
      const travel = Math.hypot(at.x - g.startX, at.y - g.startY);
      if (g.moved < TAP_TRAVEL && travel < TAP_TRAVEL) {
        const hit = hitTest(at.x, at.y);
        setHover(hit ? { point: hit, x: at.x, y: at.y } : null);
        setSelected(hit);
      }
    }
    if (pointersRef.current.size < 2) gestureRef.current.pinch = 0;
  }

  function toggleCategory(category: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of points ?? []) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return map;
  }, [points]);

  return (
    // Rhythm exception (issue #50): the constellation keeps a wider
    // max-w-[60rem] shell for the canvas — shared tokens/classes, not
    // identical widths.
    <main className="mx-auto flex min-h-screen w-full max-w-[60rem] flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Map</h1>
        <p className="mt-3 text-muted-foreground">
          Pairwise similarity across the corpus — drag to pan, scroll or pinch to zoom, tap a
          node for the report.
        </p>
      </header>

      {error && (
        <p role="alert" data-testid="map-error" className="font-mono text-sm text-amber-400">
          {error}
        </p>
      )}

      {points === null && !error && (
        <GlassPanel data-testid="map-loading" role="status" aria-busy="true">
          <div className="flex items-center gap-3">
            <Loader variant="spinner" size={24} label="warming up the constellation…" />
            <p className="font-mono text-sm text-slate-400">warming up the constellation…</p>
          </div>
        </GlassPanel>
      )}

      {points !== null && !error && points.length === 0 && (
        <GlassPanel data-testid="map-empty">
          <p>No reports in the corpus yet — the constellation needs at least one point.</p>
          <Link
            to="/report"
            className="mt-3 inline-block text-sky-400 underline-offset-4 hover:underline"
          >
            Report a scam →
          </Link>
        </GlassPanel>
      )}

      {points !== null && !error && points.length > 0 && (
        <>
          <GlassPanel className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <label htmlFor="map-threshold" className="text-sm font-medium text-slate-300">
                Similarity threshold
              </label>
              <input
                id="map-threshold"
                type="range"
                data-testid="map-threshold"
                min={THRESHOLD_MIN}
                max={THRESHOLD_MAX}
                step={THRESHOLD_STEP}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="min-h-[44px] min-w-[12rem] flex-1 accent-sky-400"
              />
              <span className="font-mono text-sm text-slate-400">{threshold.toFixed(2)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Categories">
              {CATEGORIES.map((category) => {
                const pressed = !hidden.has(category);
                const count = counts.get(category) ?? 0;
                return (
                  <button
                    key={category}
                    type="button"
                    data-testid={`map-legend-${category}`}
                    aria-pressed={pressed}
                    onClick={() => toggleCategory(category)}
                    style={
                      (CATEGORIES as readonly string[]).includes(category)
                        ? { color: `var(--color-category-${category})` }
                        : undefined
                    }
                    className={`min-h-[44px] rounded-full border border-slate-700 px-3 py-1 font-mono text-xs transition-opacity ${pressed ? 'opacity-100' : 'opacity-40'}`}
                  >
                    {category} ({count})
                  </button>
                );
              })}
            </div>
            <p className="font-mono text-xs text-slate-500" aria-live="polite">
              {points.length} reports · {edges.length} links · threshold {threshold.toFixed(2)}
            </p>
          </GlassPanel>

          <div ref={wrapRef} className="relative h-[62vh] min-h-[380px] w-full overflow-hidden rounded-3xl border border-border">
            <canvas
              ref={canvasRef}
              data-testid="vector-map"
              role="img"
              aria-label={`Constellation of ${points.length} reports by similarity`}
              className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {hover && (
              <div
                data-testid="map-tooltip"
                className="pointer-events-none absolute z-10 max-w-[16rem] rounded-2xl border border-border bg-card/85 p-3 shadow-xl backdrop-blur"
                style={{
                  left: Math.min(hover.x + 14, Math.max(8, size.w - 272)),
                  top: Math.min(hover.y + 14, Math.max(8, size.h - 120)),
                }}
              >
                <p className="break-words text-xs text-slate-200">{snippet(hover.point.text)}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-400">
                  <span
                    style={
                      (CATEGORIES as readonly string[]).includes(hover.point.category)
                        ? { color: `var(--color-category-${hover.point.category})` }
                        : undefined
                    }
                  >
                    {hover.point.category}
                  </span>
                  <span>{reports(hover.point.reportCount)}</span>
                </p>
              </div>
            )}
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40">
                <Loader variant="spinner" size={24} label="settling the layout…" />
              </div>
            )}
          </div>

          <Drawer
            open={selected !== null}
            onOpenChange={(open) => {
              if (!open) setSelected(null);
            }}
            ariaLabel="Report details"
          >
            {selected && (
              <div data-testid="map-drawer" className="flex flex-col gap-4 overflow-y-auto p-6">
                <h2 className="text-lg font-bold tracking-tight">Report</h2>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.category && (
                    <GlassBadge
                      tone="purple"
                      style={
                        (CATEGORIES as readonly string[]).includes(selected.category)
                          ? { color: `var(--color-category-${selected.category})` }
                          : undefined
                      }
                    >
                      {selected.category}
                    </GlassBadge>
                  )}
                  {selected.channel && <GlassBadge tone="blue">{selected.channel}</GlassBadge>}
                  {selected.region && <GlassBadge tone="green">{selected.region}</GlassBadge>}
                  {reports(selected.reportCount) && (
                    <GlassBadge tone="orange">{reports(selected.reportCount)}</GlassBadge>
                  )}
                  {selected.firstSeen && (
                    <span className="font-mono text-xs text-slate-500">
                      first seen {selected.firstSeen}
                    </span>
                  )}
                </div>
                <p data-testid="map-drawer-text" className="break-words text-sm text-slate-200">
                  {selected.text}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={`/?text=${encodeURIComponent(selected.text)}`}
                    data-testid="map-drawer-check"
                    className="inline-flex min-h-[44px] items-center w-fit rounded-xl bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-500"
                  >
                    Check this message
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-700 px-5 py-2.5 text-slate-300"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </Drawer>
        </>
      )}
    </main>
  );
}
