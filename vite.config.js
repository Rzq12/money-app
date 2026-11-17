import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    // Portfolio prices in development (src/quotes.js). Built web apps use the `quotes` Edge Function instead.
    proxy: {
      '/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/yahoo/, ''),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kasku+ dev)' },
      },
    },
  },
});
