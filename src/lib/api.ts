/**
 * Same-origin API client — the browser's one door to the Magpie backend
 * (server.mjs), which fronts the Qdrant vector database. The app is
 * client-only, so every request is same-origin: no base URL, no API keys, no
 * CORS. All persistent state lives behind these endpoints.
 *
 * Public surface: `apiFetch()`, `getHealth()` plus the `HealthPayload` type.
 */

/** Thrown for any non-2xx API response; `message` is the server's `error` field. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Fetch one API endpoint and return its parsed JSON. A network failure
 * (server down, DNS, offline) throws a plain Error with an actionable
 * message; a non-2xx response throws `ApiError` carrying the server's error
 * string verbatim — callers render it as-is (the UI's amber mono lines).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    });
  } catch {
    throw new Error('the Magpie server is unreachable — try again shortly');
  }
  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const serverMessage =
      payload !== null && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `request failed (${res.status})`;
    throw new ApiError(res.status, serverMessage);
  }
  return payload as T;
}

/** `GET /api/health` — the backend's own reachability verdict about Qdrant. */
export interface HealthPayload {
  status: 'ok' | 'degraded';
  qdrant: 'reachable' | 'unreachable';
  detail?: string;
  collection?: string;
}

/**
 * Health probe that never throws: an unreachable backend degrades to the
 * `unreachable` payload instead of rejecting, so the /health page can always
 * render a JSON panel.
 */
export async function getHealth(): Promise<HealthPayload> {
  try {
    return await apiFetch<HealthPayload>('/api/health');
  } catch (err) {
    return {
      status: 'degraded',
      qdrant: 'unreachable',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
