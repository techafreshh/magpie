/**
 * Constellation math for the /map page (issue #48) — the d3-free half of the
 * route, so the lazy map shell can import it without pulling the physics
 * engine into any chunk that doesn't need it (`d3-force` is only ever
 * `await import()`-ed inside the map effect).
 *
 * `fetchMapPoints()` reads the already-shipped `GET /api/map` backend
 * (issue #47: `{"points":[...]}` capped at 2000, vectors rounded) and
 * re-caps client-side; `cosineSim()` is the pairwise metric (360 points ≈
 * 64k pairs, sub-100ms); `buildEdges()` turns the pairs above a similarity
 * threshold into the link list, strongest-first and capped for the canvas
 * frame budget.
 *
 * Public surface: `MAP_POINT_CAP`, `MAP_EDGE_CAP`, `MapPoint`, `MapEdge`,
 * `fetchMapPoints()`, `cosineSim()`, `buildEdges()`.
 */
import { apiFetch } from './api';

/** Client-side mirror of the server's `MAP_POINT_LIMIT` — never render more. */
export const MAP_POINT_CAP = 2000;

/** Strongest-pair cap per threshold so a low slider can't blow the frame budget. */
export const MAP_EDGE_CAP = 6000;

/** One corpus point, exactly the `GET /api/map` shape (issue #47). */
export interface MapPoint {
  id: string;
  text: string;
  category: string;
  channel: string;
  region: string;
  reportCount: number;
  createdAt: string;
  firstSeen: string;
  vector: number[];
}

/** One drawn/physics link: indexes into the points array plus the similarity. */
export interface MapEdge {
  a: number;
  b: number;
  sim: number;
}

/**
 * The whole corpus for the constellation, capped at `MAP_POINT_CAP`
 * regardless of what the server sent. Errors propagate raw (the /map UI
 * renders them as its amber mono line, browse-style).
 */
export async function fetchMapPoints(): Promise<MapPoint[]> {
  const body = await apiFetch<{ points: MapPoint[] }>('/api/map');
  return (body.points ?? []).slice(0, MAP_POINT_CAP);
}

/** Cosine similarity with explicit norms; zero-vectors score 0, never NaN. */
export function cosineSim(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * All pairs with `sim >= threshold` (self-pairs excluded), strongest-first,
 * capped at `MAP_EDGE_CAP` — the lowest-similarity pairs above the cap are
 * dropped, so lowering the slider densifies the graph up to the budget.
 * Pairs touching a hidden category are excluded (the legend dims those nodes
 * instead, so the layout stays put and no re-simulation is needed).
 */
export function buildEdges(
  points: readonly MapPoint[],
  hiddenCategories: ReadonlySet<string>,
  threshold: number,
): MapEdge[] {
  const norms = points.map((p) => {
    let s = 0;
    for (const v of p.vector) s += v * v;
    return Math.sqrt(s);
  });
  const edges: MapEdge[] = [];
  for (let a = 0; a < points.length; a++) {
    const pa = points[a];
    if (!pa || hiddenCategories.has(pa.category)) continue;
    const va = pa.vector;
    const na = norms[a] ?? 0;
    if (na === 0) continue;
    for (let b = a + 1; b < points.length; b++) {
      const pb = points[b];
      if (!pb || hiddenCategories.has(pb.category)) continue;
      const nb = norms[b] ?? 0;
      if (nb === 0) continue;
      const vb = pb.vector;
      const n = Math.min(va.length, vb.length);
      let dot = 0;
      for (let i = 0; i < n; i++) dot += (va[i] ?? 0) * (vb[i] ?? 0);
      const sim = dot / (na * nb);
      if (sim >= threshold) edges.push({ a, b, sim });
    }
  }
  edges.sort((x, y) => y.sim - x.sim);
  return edges.slice(0, MAP_EDGE_CAP);
}
