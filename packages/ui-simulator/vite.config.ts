import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeStubs = resolve(__dirname, 'src/lib/node-stubs.ts');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/simulator/',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8600',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8600',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      output: {
        manualChunks: {
          'vendor-utils': ['zustand', 'clsx', 'tailwind-merge', 'colord', 'fast-json-patch'],
        },
      },
    },
  },
  resolve: {
    alias: {
      'node:crypto': nodeStubs,
      'node:fs': nodeStubs,
      'node:path': nodeStubs,
    },
  },
});
