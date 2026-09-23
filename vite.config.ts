import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub project page: https://<user>.github.io/slidenotes/
// Override with VITE_BASE=/ for a user page or a custom domain.
const base = process.env.VITE_BASE ?? '/slidenotes/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  // The PowerPoint engine (LibreOffice WASM) needs cross-origin isolation. The dev server
  // sets the headers directly; production on GitHub Pages uses public/coi-serviceworker.js.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
