// Zero-dependency static server for the committed production build (dist/).
// `npm start` runs this: a fresh clone must answer HTTP immediately with no
// registry round-trip and no build step (install may be slow or blocked on
// sandboxed machines), so nothing ever probes a dead port. SPA semantics:
// any extensionless path answers index.html; `npm run dev` remains the
// Vite dev-server path.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const INDEX = join(DIST, 'index.html');
const PORT = Number(process.env.PORT) || 5173;

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
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
}

async function handle(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    pathname = req.url.split('?')[0];
  }
  // join() after normalize() cannot escape DIST (no absolute or .. override),
  // but guard explicitly so a probe can never read outside dist/.
  const candidate = join(DIST, normalize(pathname));
  if (candidate !== DIST && !candidate.startsWith(DIST.endsWith(sep) ? DIST : DIST + sep)) {
    notFound(res);
    return;
  }

  let file;
  if (extname(candidate) !== '') {
    try {
      if (!(await stat(candidate)).isFile()) {
        notFound(res);
        return;
      }
    } catch {
      notFound(res);
      return;
    }
    file = candidate;
  } else {
    file = INDEX; // SPA catch-all: "/" and "/health" included
  }

  const body = await readFile(file);
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': body.length,
    // index.html is the routing answer, never cache it; hashed assets are immutable.
    'cache-control': file === INDEX ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
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
    console.error(`[magpie] ${INDEX} is missing — restore the committed dist/ (or run "npm run build")`);
    process.exit(1);
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
  console.log(`[magpie] serving dist/ on http://localhost:${PORT}/`);
}

boot().catch((err) => {
  console.error('[magpie] fatal:', err);
  process.exit(1);
});
