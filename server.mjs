// Magpie server — zero-dependency HTTP server for the production build (dist/)
// and the JSON API that fronts Qdrant. `npm start` (and the Docker image) run
// this. All persistent state lives in one Qdrant collection (`QDRANT_COLLECTION`,
// default `magpie_reports`): vectors power kNN check search and the report
// dedupe-merge, payloads power feed and stats.
//
// API surface (same-origin; the browser never talks to Qdrant directly):
//   GET  /api/health            → {"status","qdrant","detail"} — 200 reachable / 503 unreachable
//   POST /api/check             {vector} → {"matches":[…]} — kNN top-10, hidden excluded
//   POST /api/reports           {vector,text,category,channel,region,reporterId} → create-or-merge
//   POST /api/reports/:id/hide  {reporterId} → soft-hide the reporter's own document
//   GET  /api/feed?page=N       → {"items":[…]} — 25 newest non-hidden, 0-based page
//   GET  /api/stats             → {"total","thisWeek","perCategory","top"}
//   GET  /api/map              → {"points":[…]} — non-hidden points with payload + rounded 384-dim vector, capped at 2000
//
// Embedding happens client-side (workers/embed.worker.ts); this server never
// embeds — it receives opaque 384-dim vectors and stores/queries them verbatim.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const INDEX = join(DIST, 'index.html');
const PORT = Number(process.env.PORT) || 8080;

// ---- Qdrant configuration ---------------------------------------------------

const QDRANT_URL = (process.env.QDRANT_URL || 'http://qdrant:6333').replace(/\/+$/, '');
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'magpie_reports';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
/** Must mirror scripts/setup-db.ts (`DIMENSION`) and the client embedder (384). */
const DIMENSION = 384;
/**
 * Dedupe-before-write boundary for the report flow. Mirrors
 * THRESHOLDS.MERGE in src/lib/constants.ts (this plain-JS server cannot import
 * that TS module — keep the values in sync; a tuning pass changes both or
 * neither). Env-overridable so an operator can align a drifted deployment.
 */
const MERGE_THRESHOLD = Number(process.env.MERGE_THRESHOLD) || 0.95;
/** Must mirror CATEGORIES in src/lib/constants.ts (order decides the `top` tie rule). */
const CATEGORIES = ['phishing', 'investment', 'advance_fee', 'delivery', 'romance', 'job_offer', 'other'];
/** Must mirror CHANNELS in src/lib/constants.ts. */
const CHANNELS = ['sms', 'whatsapp', 'email'];
/** Feed page width — mirrors FEED_PAGE_SIZE in src/lib/feed.ts. */
const FEED_PAGE_SIZE = 25;
/** Vector-map point cap — a constellation plot needs the corpus, not a pager. */
const MAP_POINT_LIMIT = 2000;

// ---- Qdrant REST helpers (fetch, Node 22) -----------------------------------

function qdrantHeaders(extra = {}) {
  const headers = { 'content-type': 'application/json', ...extra };
  if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;
  return headers;
}

async function qdrant(method, path, body) {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: qdrantHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  // Success responses carry "status":"ok" (string); failures carry
  // "status":{"error": …} and usually a 4xx/5xx HTTP code.
  if (!res.ok || payload.status !== 'ok') {
    const detail = payload?.status?.error ?? payload?.status ?? res.statusText;
    throw new Error(`Qdrant ${method} ${path} failed (${res.status}): ${detail}`);
  }
  return payload.result;
}

/**
 * Every persisted report is one point in the collection. Payload shape
 * (mirrors scripts/setup-db.ts DOC_FIELDS + created_at):
 *   text, category, channel, region, first_seen, reporter_id, hidden (bool),
 *   report_count (int), created_at (ISO datetime — the feed's order_by key).
 */
const HIDDEN_FILTER = { must_not: [{ key: 'hidden', match: { value: true } }] };

/** kNN top-k with the hidden filter; Qdrant Cosine score IS the similarity. */
async function knn(vector, k) {
  const result = await qdrant('POST', `/collections/${QDRANT_COLLECTION}/points/query`, {
    query: vector,
    limit: k,
    with_payload: true,
    filter: HIDDEN_FILTER,
  });
  return result.points
    .map((point) => ({ id: String(point.id), score: point.score, payload: point.payload ?? {} }))
    .sort((a, b) => b.score - a.score);
}

async function countPoints(filter) {
  const result = await qdrant('POST', `/collections/${QDRANT_COLLECTION}/points/count`, {
    filter,
    exact: true,
  });
  return result.count;
}

/** Full point (id + payload) by id, or null when absent. */
async function getPoint(id) {
  try {
    const result = await qdrant('GET', `/collections/${QDRANT_COLLECTION}/points/${id}`);
    return result ? { id: String(result.id), payload: result.payload ?? {} } : null;
  } catch (err) {
    if (/404/.test(String(err))) return null;
    throw err;
  }
}

/** Patch selected payload keys on one point (other keys, and the vector, untouched). */
async function setPayload(id, payload) {
  await qdrant('POST', `/collections/${QDRANT_COLLECTION}/points/payload`, {
    payload,
    points: [id],
    wait: true,
  });
}

/** Qdrant point IDs are UUIDs or unsigned ints — derive a stable UUID from the text hash. */
function uuidFromText(text) {
  const hex = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ---- Mapping (server shapes mirror the client lib types 1:1) ----------------

function toMatch(hit) {
  const p = hit.payload;
  return {
    id: hit.id,
    text: p.text ?? '',
    category: p.category ?? '',
    channel: p.channel ?? '',
    region: p.region ?? '',
    reportCount: p.report_count ?? 0,
    // Cosine distance is 1 − cosine similarity; Qdrant returns the similarity
    // itself as `score`, so no conversion — the client consumed 1 − $distance
    // from the previous backend and this is the same quantity.
    similarity: hit.score,
    firstSeen: p.first_seen ?? '',
  };
}

function toFeedItem(point) {
  const p = point.payload ?? {};
  return {
    id: String(point.id),
    text: p.text ?? '',
    category: p.category ?? '',
    channel: p.channel ?? '',
    region: p.region ?? '',
    reportCount: p.report_count ?? 0,
    reporterId: p.reporter_id ?? '',
    createdAt: p.created_at ?? '',
  };
}

/** Decimals kept per vector component — far below the embedder's noise floor, roughly halves the payload. */
const VECTOR_DECIMALS = 5;
const VECTOR_ROUNDING_SCALE = 10 ** VECTOR_DECIMALS;

/** Round each component to VECTOR_DECIMALS places; a malformed vector never fails the whole map. */
function roundVector(vector) {
  if (!Array.isArray(vector)) return [];
  return vector.map((n) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
    return Math.round(n * VECTOR_ROUNDING_SCALE) / VECTOR_ROUNDING_SCALE;
  });
}

function toMapPoint(point) {
  const p = point.payload ?? {};
  return {
    id: String(point.id),
    text: p.text ?? '',
    category: p.category ?? '',
    channel: p.channel ?? '',
    region: p.region ?? '',
    reportCount: p.report_count ?? 0,
    createdAt: p.created_at ?? '',
    firstSeen: p.first_seen ?? '',
    vector: roundVector(point.vector),
  };
}

// ---- Request plumbing -------------------------------------------------------

function json(req, res, status, body) {
  const payload = JSON.stringify(body);
  // API JSON reuses the server's compression path: gzip when the client
  // offers it. No GZIP_MIN_BYTES gate here — API bodies are dynamic (the
  // map is ~200–300KB gzipped) and even small error bodies must prove the
  // path is wired. The gzipped() file cache is not used: it is keyed by
  // filename for immutable dist/ assets, while these bodies vary per request.
  const acceptsGzip = /gzip/i.test(String(req.headers['accept-encoding'] ?? ''));
  if (acceptsGzip) {
    const encoded = gzipSync(Buffer.from(payload), { level: 6 });
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-encoding': 'gzip',
      // Vary so shared caches never serve gzip bytes to an identity-only client.
      vary: 'Accept-Encoding',
      'content-length': encoded.length,
    });
    res.end(encoded);
    return;
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY_BYTES = 1024 * 1024; // 384 floats ≈ 8 KB; 1 MB is a generous abuse cap

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new ApiError(413, 'request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolveBody(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new ApiError(400, 'request body must be valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/** Validate a 384-dim finite-number vector; returns it unchanged. */
function parseVector(value) {
  if (!Array.isArray(value) || value.length !== DIMENSION) {
    throw new ApiError(400, `vector must be an array of ${DIMENSION} numbers`);
  }
  for (const n of value) {
    if (typeof n !== 'number' || !Number.isFinite(n)) {
      throw new ApiError(400, 'vector must contain only finite numbers');
    }
  }
  return value;
}

/** Common report-field validation (report flow). */
function parseReportFields(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text.length === 0 || text.length > 1000) {
    throw new ApiError(400, 'text must be 1–1000 characters');
  }
  if (!CATEGORIES.includes(body.category)) {
    throw new ApiError(400, `category must be one of: ${CATEGORIES.join(', ')}`);
  }
  if (!CHANNELS.includes(body.channel)) {
    throw new ApiError(400, `channel must be one of: ${CHANNELS.join(', ')}`);
  }
  const region = typeof body.region === 'string' ? body.region.trim().slice(0, 120) : '';
  const reporterId = typeof body.reporterId === 'string' ? body.reporterId.trim() : '';
  if (!reporterId || reporterId.length > 64 || reporterId === 'seed') {
    throw new ApiError(400, 'reporterId must be a non-empty id (≤ 64 chars)');
  }
  // Stored payload keys are snake_case (the seed's shape, and what
  // toMatch/toFeedItem/handleHideReport read back).
  return { text, category: body.category, channel: body.channel, region, reporter_id: reporterId };
}

// ---- API handlers -----------------------------------------------------------

async function handleHealth() {
  try {
    await qdrant('GET', `/collections/${QDRANT_COLLECTION}`);
    return { status: 200, body: { status: 'ok', qdrant: 'reachable', collection: QDRANT_COLLECTION } };
  } catch (err) {
    return {
      status: 503,
      body: {
        status: 'degraded',
        qdrant: 'unreachable',
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function handleCheck(req) {
  const body = await readBody(req);
  const vector = parseVector(body.vector);
  const hits = await knn(vector, 10);
  return { status: 200, body: { matches: hits.map(toMatch) } };
}

async function handleCreateReport(req) {
  const body = await readBody(req);
  const vector = parseVector(body.vector);
  const fields = parseReportFields(body);

  // Dedupe-before-write: top-1 of the same kNN the check flow uses. At or
  // above MERGE_THRESHOLD the report folds into the existing document
  // (report_count + 1) instead of storing a near-duplicate point.
  const [top] = await knn(vector, 10);
  if (top && top.score >= MERGE_THRESHOLD) {
    const point = await getPoint(top.id);
    if (point) {
      const reportCount = (point.payload.report_count ?? 0) + 1;
      await setPayload(point.id, { report_count: reportCount });
      return { status: 200, body: { outcome: 'merged', documentId: point.id, reportCount } };
    }
    // The hit vanished between query and read — fall through and create fresh.
  }

  const now = new Date().toISOString();
  const id = uuidFromText(fields.text); // deterministic: re-submitting the same text rewrites one point
  await qdrant('PUT', `/collections/${QDRANT_COLLECTION}/points?wait=true`, {
    points: [
      {
        id,
        vector,
        payload: {
          ...fields,
          first_seen: now,
          hidden: false,
          report_count: 1,
          created_at: now,
        },
      },
    ],
  });
  return { status: 200, body: { outcome: 'created', documentId: id } };
}

async function handleHideReport(req, documentId) {
  const body = await readBody(req);
  const reporterId = typeof body.reporterId === 'string' ? body.reporterId.trim() : '';
  if (!reporterId || reporterId.length > 64 || reporterId === 'seed') {
    throw new ApiError(400, 'reporterId must be a non-empty id (≤ 64 chars)');
  }
  const point = await getPoint(documentId);
  if (!point) throw new ApiError(404, 'report not found');
  if (point.payload.reporter_id !== reporterId) {
    // Only the reporter's own reports are hideable (the app's only moderation).
    throw new ApiError(403, 'not your report');
  }
  await setPayload(documentId, { hidden: true });
  return { status: 200, body: { ok: true } };
}

/**
 * This Qdrant build rejects `offset` together with `order_by` ("use
 * order_by.start_from and a filter…"). Offset paging is still emulated
 * exactly, in one round-trip: order_by alone serves the newest
 * (page + 1) × PAGE_SIZE points, and the requested page is the tail slice.
 * MAX_FEED_SCAN bounds the slice for pathological page depths (40 pages —
 * far beyond this corpus's scale).
 */
const MAX_FEED_SCAN = 1000;

async function handleFeed(url) {
  const page = Math.max(0, Number(url.searchParams.get('page') ?? '0') || 0);
  const scan = Math.min((page + 1) * FEED_PAGE_SIZE, MAX_FEED_SCAN);
  const result = await qdrant('POST', `/collections/${QDRANT_COLLECTION}/points/scroll`, {
    filter: HIDDEN_FILTER,
    order_by: { key: 'created_at', direction: 'desc' },
    limit: scan,
    with_payload: true,
  });
  const items = result.points
    .slice(page * FEED_PAGE_SIZE, scan)
    .map(toFeedItem);
  return { status: 200, body: { items, page } };
}

async function handleStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  // Same shape as the client's CorpusStats (src/lib/stats.ts): total,
  // rolling-7-day, one count per category (CATEGORIES order), deterministic top.
  const [total, thisWeek, ...categoryCounts] = await Promise.all([
    countPoints(HIDDEN_FILTER),
    countPoints({ ...HIDDEN_FILTER, must: [{ key: 'created_at', range: { gte: weekAgo } }] }),
    ...CATEGORIES.map((category) =>
      countPoints({ ...HIDDEN_FILTER, must: [{ key: 'category', match: { value: category } }] }),
    ),
  ]);
  const perCategory = CATEGORIES.map((category, i) => ({ category, count: categoryCounts[i] }));
  const topEntry = perCategory.reduce(
    (best, entry) => (best === null || entry.count > best.count ? entry : best),
    null,
  );
  const top = topEntry !== null && topEntry.count > 0 ? topEntry : null;
  return { status: 200, body: { total, thisWeek, perCategory, top } };
}

async function handleMap() {
  const result = await qdrant('POST', `/collections/${QDRANT_COLLECTION}/points/scroll`, {
    filter: HIDDEN_FILTER,
    limit: MAP_POINT_LIMIT,
    with_payload: true,
    with_vector: true,
  });
  const points = (result?.points ?? []).map(toMapPoint);
  return { status: 200, body: { points } };
}

const API_ROUTES = [
  { method: 'GET', pattern: /^\/api\/health$/, handler: () => handleHealth() },
  { method: 'POST', pattern: /^\/api\/check$/, handler: (req) => handleCheck(req) },
  { method: 'POST', pattern: /^\/api\/reports$/, handler: (req) => handleCreateReport(req) },
  {
    method: 'POST',
    pattern: /^\/api\/reports\/([^/]+)\/hide$/,
    handler: (req, params) => handleHideReport(req, params[0]),
  },
  { method: 'GET', pattern: /^\/api\/feed$/, handler: (req, _p, url) => handleFeed(url) },
  { method: 'GET', pattern: /^\/api\/stats$/, handler: () => handleStats() },
  // Read-only: the constellation page plots the whole corpus client-side.
  { method: 'GET', pattern: /^\/api\/map$/, handler: () => handleMap() },
];

async function handleApi(req, res, url) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/api';
  for (const route of API_ROUTES) {
    if (route.method !== req.method) continue;
    const match = pathname.match(route.pattern);
    if (!match) continue;
    try {
      const { status, body } = await route.handler(req, match.slice(1), url);
      json(req, res, status, body);
    } catch (err) {
      if (err instanceof ApiError) {
        json(req, res, err.status, { error: err.message });
      } else {
        console.error('[magpie] api error:', err);
        json(req, res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
    }
    return;
  }
  json(req, res, 404, { error: 'not found' });
}

// ---- Static file serving (unchanged from the zero-dep static server) --------

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Gzip (issue #18): the bundle ships ~500KB of text assets (JS + CSS); over a
// slow mobile connection that is most of the Lighthouse budget. Compress the
// text-like assets when the client offers gzip — identity bytes stay
// byte-identical for clients that do not. `.wasm` is deliberately excluded
// (already compressed, decompressing it on every request wastes CPU).
const COMPRESSIBLE = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt']);
const GZIP_MIN_BYTES = 860; // below one MTU-ish payload, compression gains nothing
// Built dist/ files never change under a running server, so a small bounded
// memo of encoded buffers keeps repeat requests at memcpy cost. Oldest-insert
// eviction beyond GZIP_CACHE_MAX entries.
const GZIP_CACHE_MAX = 64;
const gzipCache = new Map();

function gzipped(file, body) {
  let encoded = gzipCache.get(file);
  if (!encoded) {
    encoded = gzipSync(body, { level: 6 });
    if (gzipCache.size >= GZIP_CACHE_MAX) {
      gzipCache.delete(gzipCache.keys().next().value);
    }
    gzipCache.set(file, encoded);
  }
  return encoded;
}

async function serveStatic(req, res, pathname) {
  // join() after normalize() cannot escape DIST (no absolute or .. override),
  // but guard explicitly so a probe can never read outside dist/.
  const candidate = join(DIST, normalize(pathname));
  if (candidate !== DIST && !candidate.startsWith(DIST.endsWith(sep) ? DIST : DIST + sep)) {
    return notFound(res);
  }

  let file;
  if (extname(candidate) !== '') {
    try {
      if (!(await stat(candidate)).isFile()) {
        return notFound(res);
      }
    } catch {
      return notFound(res);
    }
    file = candidate;
  } else {
    file = INDEX; // SPA catch-all: "/" and every client route
  }

  let body;
  try {
    body = await readFile(file);
  } catch {
    return notFound(res);
  }
  const headers = {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    // index.html is the routing answer, never cache it; hashed assets are immutable.
    'cache-control': file === INDEX ? 'no-store' : 'public, max-age=31536000, immutable',
  };
  const acceptsGzip = /gzip/i.test(String(req.headers['accept-encoding'] ?? ''));
  if (
    acceptsGzip &&
    body.length >= GZIP_MIN_BYTES &&
    COMPRESSIBLE.has(extname(file).toLowerCase())
  ) {
    const encoded = gzipped(file, body);
    headers['content-encoding'] = 'gzip';
    // Vary so shared caches never serve gzip bytes to an identity-only client.
    headers.vary = 'Accept-Encoding';
    headers['content-length'] = encoded.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : encoded);
    return;
  }
  headers['content-length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
}

// ---- Server -----------------------------------------------------------------

const server = createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    pathname = req.url.split('?')[0];
  }
  const url = new URL(req.url, 'http://localhost');

  const work =
    pathname === '/api' || pathname.startsWith('/api/')
      ? handleApi(req, res, url)
      : serveStatic(req, res, pathname);

  Promise.resolve(work).catch((err) => {
    console.error('[magpie] request error:', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('internal error');
  });
});

function attemptListen(host) {
  return new Promise((done, fail) => {
    const onError = (err) => {
      server.off('error', onError);
      fail(err);
    };
    server.on('error', onError);
    server.listen(PORT, host, () => {
      server.off('error', onError);
      done();
    });
  });
}

async function boot() {
  try {
    await stat(INDEX);
  } catch {
    // API-only mode is legitimate (vite dev serves the UI; `npm run api`);
    // static requests will 404 until dist/ exists.
    console.warn(`[magpie] ${INDEX} is missing — API-only mode (run "npm run build" to serve dist/)`);
  }

  // "::" is dual-stack (serves 127.0.0.1 and ::1, like Vite's --host); fall
  // back to IPv4-only on IPv6-less kernels. Retry briefly on EADDRINUSE so a
  // just-killed predecessor's socket can release.
  const hosts = ['::', '0.0.0.0'];
  const retryable = new Set(['EADDRINUSE', 'EAFNOSUPPORT', 'EADDRNOTAVAIL']);
  let bound = false;
  for (let attempt = 1; attempt <= 3 && !bound; attempt++) {
    for (const host of hosts) {
      try {
        await attemptListen(host);
        bound = true;
        break;
      } catch (err) {
        if (!retryable.has(err.code)) throw err;
        console.warn(`[magpie] cannot bind ${host}:${PORT} (${err.code}), retrying...`);
      }
    }
    if (!bound) await new Promise((r) => setTimeout(r, 400));
  }
  if (!bound) {
    console.error(`[magpie] could not bind port ${PORT} after 3 attempts`);
    process.exit(1);
  }
  console.log(`[magpie] serving dist/ + api on http://localhost:${PORT}/ (qdrant: ${QDRANT_URL}, collection: ${QDRANT_COLLECTION})`);
}

boot().catch((err) => {
  console.error('[magpie] fatal:', err);
  process.exit(1);
});
