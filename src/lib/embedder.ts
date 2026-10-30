/**
 * Embedding boundary (PRD §"Embedding boundary").
 *
 * `embed(text)` returns a fixed-size semantic vector (384 dims) computed fully on-device:
 * transformers.js `Xenova/all-MiniLM-L6-v2` (quantized) runs inside `workers/embed.worker.ts`,
 * so neither the message text nor any derived value is ever sent to a server. All model
 * traffic (tokenizer + ONNX weights) is downloaded by the worker via transformers.js's own
 * HTTP layer — this module performs zero networking.
 *
 * One-file fallback swap (documented, deliberately NOT wired): to move embeddings
 * server-side (e.g. a containerized embedding service), replace the body of
 * `embed()` below and delete `workers/embed.worker.ts`. Do it in this single
 * file only and never mix embedding sources for vectors stored in the same
 * corpus — vectors from different models are not comparable and would silently
 * corrupt kNN.
 *
 * Public surface: `embed()`, `getEmbedLog()`, `onEmbedLog()` plus the worker message types.
 */

/** A timestamped progress line posted by the worker (model download / readiness). */
export interface EmbedProgress {
  /** Worker-collapsed Unix epoch ms. */
  ts: number;
  /** Human-readable progress line, e.g. `download onnx/model_quantized.onnx: 43%`. */
  message: string;
  /** 0-100 percent when the line denotes download progress, otherwise absent. */
  pct?: number;
}

/** Message sent to the worker: one embed job. */
export interface WorkerRequest {
  type: 'embed';
  /** Correlates a result/error back to its request. */
  id: number;
  text: string;
}

/** Message from the worker: completed embedding for request `id`. */
export interface ResultMessage {
  type: 'result';
  id: number;
  /** Unit-normalized mean-pooled embedding, length 384. */
  vector: number[];
}

/** Message from the worker: progress line (independent of any single request). */
export interface ProgressMessage {
  type: 'progress';
  ts: number;
  message: string;
  pct?: number;
}

/** Message from the worker: request `id` failed. */
export interface ErrorMessage {
  type: 'error';
  id: number;
  message: string;
}

export type WorkerOutbound = ResultMessage | ProgressMessage | ErrorMessage;

const LOG_CAP = 200;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: number[]) => void; reject: (e: Error) => void }>();

let log: EmbedProgress[] = [];
const logSubscribers = new Set<(entries: EmbedProgress[]) => void>();

function appendLog(entry: ProgressMessage): void {
  log = [...log, entry].slice(-LOG_CAP);
  for (const cb of logSubscribers) cb(log);
}

function handleOutbound(msg: WorkerOutbound): void {
  if (msg.type === 'result') {
    pending.get(msg.id)?.resolve(msg.vector);
    pending.delete(msg.id);
  } else if (msg.type === 'error') {
    pending.get(msg.id)?.reject(new Error(msg.message));
    pending.delete(msg.id);
  } else if (msg.type === 'progress') {
    appendLog(msg);
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  // The URL literal must stay inline in the `new Worker(new URL(...))` call — hoisting it
  // into a variable makes Vite silently skip emitting the worker chunk.
  worker = new Worker(new URL('../../workers/embed.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerOutbound>) => handleOutbound(e.data);
  worker.onerror = (e) => {
    // Worker-level failure (e.g. module failed to load): reject everything still in flight.
    const message = e.message || 'embed worker crashed';
    for (const { reject } of pending.values()) reject(new Error(message));
    pending.clear();
  };
  return worker;
}

/** Latest load progress lines, oldest first, capped (see LOG_CAP). */
export function getEmbedLog(): EmbedProgress[] {
  return log;
}

/**
 * Subscribe to the capped embed progress log. The callback fires once immediately with the
 * current log and again after each new progress line. Returns an unsubscribe function.
 */
export function onEmbedLog(cb: (entries: EmbedProgress[]) => void): () => void {
  logSubscribers.add(cb);
  cb(log);
  return () => {
    logSubscribers.delete(cb);
  };
}

/** Embed `text` into the model's fixed-dimension unit vector. Never touches the network itself. */
export function embed(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) return Promise.reject(new TypeError('text is empty'));
  const id = ++nextId;
  const task = new Promise<number[]>((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
  getWorker().postMessage({ type: 'embed', id, text: trimmed } satisfies WorkerRequest);
  return task;
}
