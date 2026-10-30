import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // `@` → src: the shadcn CLI-resolved registry components import via `@/lib/utils`.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react(), tailwindcss()],
  // Bundle web workers as ES modules (workers/embed.worker.ts loads transformers.js).
  worker: {
    format: 'es',
  },
  // Dev same-origin API: the browser code always fetches `/api/*`; in dev the
  // Vite server forwards them to `npm run api` (server.mjs on :8787). Point
  // MAGPIE_API_URL elsewhere if the backend runs on another port.
  server: {
    proxy: {
      '/api': process.env.MAGPIE_API_URL ?? 'http://127.0.0.1:8787',
    },
  },
});
