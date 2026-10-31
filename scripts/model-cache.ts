// Shared transformers.js model-weight cache pin for the operator scripts
// (seed, tune, smoke). Deliberately minimal (no top-level work beyond
// resolving the path, zero new dependencies): each script calls
// `pinModelCache()` in `main()` — after corpus validation, before the first
// `embedOne` — so every `createPipeline` invocation in this repo inherits the
// same directory.
//
// Why the pin exists: transformers.js resolves its file cache from
// `env.cacheDir`, which defaults to `.cache` relative to the library's own
// installed location (inside `node_modules/@huggingface/transformers`), not
// the repo root — so without this pin a cold `npm run smoke -- --local`
// downloads `onnx/model_quantized.onnx` into `node_modules` and no
// repo-local `.cache/` ever appears. Pinning `env.cacheDir` to the
// repo-root `.cache/` (already gitignored and dockerignored) makes the
// weights' location observable and reruns download-free. `--local` stays
// network-capable: a cold first run still downloads the weights once
// (~23 MB q8) into the pinned directory; strict-offline enforcement is out
// of scope.
import { mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from '@huggingface/transformers';

/**
 * Absolute path to the repo-root `.cache/` — the one directory every
 * operator script's embeddings resolve their model weights from. Same
 * `fileURLToPath` idiom the scripts use for `CORPUS_PATH`.
 */
export const MODEL_CACHE_DIR = fileURLToPath(new URL('../.cache/', import.meta.url));

/**
 * Point transformers.js at the repo-local cache and create it. Idempotent —
 * re-assigning `env.cacheDir` is harmless, so every script calls this in
 * `main()` without coordination. Returns whether the directory already held
 * cached files (warm) before this call, so run headers can print the
 * resolved state instead of just claiming it.
 */
export function pinModelCache(): boolean {
  let warm = false;
  try {
    warm = readdirSync(MODEL_CACHE_DIR).length > 0;
  } catch {
    // Missing (or unreadable) directory reads as cold, not as failure.
  }
  env.cacheDir = MODEL_CACHE_DIR;
  mkdirSync(MODEL_CACHE_DIR, { recursive: true });
  return warm;
}
