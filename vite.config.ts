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
});
