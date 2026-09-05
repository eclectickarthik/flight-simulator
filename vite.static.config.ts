import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

// Reuse the same simulator as the local Vinext preview, served as static files.
export default defineConfig({
  root: fileURLToPath(new URL('./static', import.meta.url)),
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  base: './',
  define: { __FLIGHT_BASE__: JSON.stringify('./') },
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    outDir: fileURLToPath(new URL('./dist-static/flight', import.meta.url)),
    emptyOutDir: true,
  },
});
