import { pipeline } from '@huggingface/transformers';
import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import type { ErrorMessage, ProgressMessage, ResultMessage, WorkerRequest } from '../src/lib/embedder';

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// Typed façade over the DedicatedWorkerGlobalScope: keeps the worker type-checkable under
// the app tsconfig (DOM lib) without adding the WebWorker lib for the whole project.
const ctx = self as unknown as {
  postMessage(msg: ProgressMessage | ResultMessage | ErrorMessage): void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let loadedOnce = false;

function post(msg: ProgressMessage | ResultMessage | ErrorMessage): void {
  ctx.postMessage(msg);
}

// `pipeline()`'s public signature returns Promise<AllTasks[T]> over a ~30-member task union,
// which blows past TypeScript's union-complexity limit during resolution (TS2590). Narrow the
// call to the one task we use via a minimal local signature instead.
const createPipeline = pipeline as unknown as (
  task: 'feature-extraction',
  model?: string,
  options?: {
    dtype?: 'q8';
    progress_callback?: (e: { status?: string; file?: string; progress?: number }) => void;
  },
) => Promise<FeatureExtractionPipeline>;

function loadExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = createPipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      progress_callback: (e: { status?: string; file?: string; progress?: number }) => {
        const ts = Date.now();
        const file = e.file ?? '?';
        let message: string;
        let pct: number | undefined;
        if (e.status === 'initiate' || e.status === 'download') {
          message = `download ${file}: start`;
        } else if (e.status === 'progress') {
          pct = Math.round(e.progress ?? 0);
          message = `download ${file}: ${pct}%`;
        } else if (e.status === 'done') {
          pct = 100;
          message = `download ${file}: complete`;
        } else {
          message = `${e.status ?? 'status'} ${file}`;
        }
        post(pct === undefined ? { type: 'progress', ts, message } : { type: 'progress', ts, message, pct });
      },
    });
  }
  return extractorPromise;
}

async function runEmbed(req: WorkerRequest): Promise<void> {
  try {
    const extractor = await loadExtractor();
    // The pipeline is created once per worker lifetime: on every call after the first the
    // model is already resident, so nothing is re-downloaded.
    post({
      type: 'progress',
      ts: Date.now(),
      message: loadedOnce ? 'ready: model loaded (cache, no download)' : 'ready: model loaded',
    });
    loadedOnce = true;
    const output = await extractor(req.text, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data as Float32Array);
    post({ type: 'result', id: req.id, vector });
  } catch (err) {
    post({
      type: 'error',
      id: req.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// Serialize jobs: transformers.js pipelines are stateful and not safe to run concurrently.
let queue: Promise<void> = Promise.resolve();

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (!req || req.type !== 'embed') return;
  // runEmbed never throws (errors are posted back), so the chain never rejects.
  queue = queue.then(() => runEmbed(req));
};
