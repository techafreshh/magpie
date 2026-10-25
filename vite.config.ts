import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Bundle web workers as ES modules (workers/embed.worker.ts loads transformers.js).
  worker: {
    format: 'es',
  },
});
