// Shared Qdrant REST helper for the operator scripts (setup-db, seed, smoke).
// Deliberately side-effect-free (no top-level main, no dotenv call): scripts
// may import it without triggering any work — the old discipline of "never
// import a sibling script" existed because those scripts executed their main()
// at import time; this module replaces the duplicated REST plumbing instead.
//
// Zero dependencies: the Qdrant REST API is plain JSON over HTTP, so Node 22's
// fetch is the whole client — no SDK package. The server (server.mjs) keeps a
// plain-JS copy of `uuidFromText` and the request/error shapes: keep the two
// in sync (grep `uuidFromText` across server.mjs and this module).
//
// Loads .env.local once at import time. This MUST happen here rather than in
// each script: ESM imports are hoisted, so a script's own `config()` call
// would run only after this module's top-level env reads. Real environment
// variables win (dotenv never overrides existing keys).
import { createHash } from 'node:crypto';
import { config } from 'dotenv';
config({ path: '.env.local' });

/** Qdrant base URL (overrides: .env.local / env). Default assumes the compose
 * network alias; on the host, point it at the container IP or a loopback publish. */
export const QDRANT_URL = (process.env.QDRANT_URL || 'http://qdrant:6333').replace(/\/+$/, '');
/** The one collection holding every report (mirrors server.mjs default). */
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || 'magpie_reports';
/** Optional — set only when the Qdrant instance itself requires an API key. */
export const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
/** Must mirror the client embedder (workers/embed.worker.ts) and server.mjs. */
export const DIMENSION = 384;

function qdrantHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...extra };
  if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY;
  return headers;
}

/**
 * One Qdrant REST call. Success responses carry `"status":"ok"` (string);
 * failures carry `"status":{"error": …}` and usually a 4xx/5xx HTTP code —
 * both are surfaced in the thrown message.
 */
export async function qdrant<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: qdrantHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    status?: 'ok' | { error?: string };
    result?: T;
  };
  if (!res.ok || payload.status !== 'ok') {
    const detail =
      (typeof payload.status === 'object' ? payload.status?.error : undefined) ??
      (typeof payload.status === 'string' ? payload.status : undefined) ??
      res.statusText;
    throw new Error(`Qdrant ${method} ${path} failed (${res.status}): ${detail}`);
  }
  return payload.result as T;
}

/** Qdrant point IDs are UUIDs or unsigned ints — derive a stable UUID from the text hash. */
export function uuidFromText(text: string): string {
  const hex = createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Collection-info shapes this repo consumes. */
export interface QdrantCollectionInfo {
  status: string;
  config: {
    params: {
      vectors: { size: number; distance: string } | Record<string, unknown>;
    };
  };
  payload_schema?: Record<string, { data_type?: string } | unknown>;
}

/** Shorthand for "does the collection exist" (false on 404, throws otherwise). */
export async function collectionExists(collection = QDRANT_COLLECTION): Promise<boolean> {
  try {
    await qdrant('GET', `/collections/${collection}`);
    return true;
  } catch (err) {
    if (/\(404\)/.test(String(err))) return false;
    throw err;
  }
}
