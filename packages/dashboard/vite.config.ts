import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeStubs = resolve(__dirname, 'src/lib/node-stubs.ts');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6400,
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
      // The @voltron/shared package re-exports node-only utilities (hash, path).
      // These are tree-shaken away since dashboard code never imports them,
      // but Rollup still resolves them. Mark node builtins as external stubs.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-recharts': ['recharts'],
          'vendor-utils': ['date-fns', 'zustand', 'clsx', 'tailwind-merge'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  resolve: {
    alias: {
      // Stub out node builtins that shared package imports but dashboard doesn't use
      'node:crypto': nodeStubs,
      'node:fs': nodeStubs,
      'node:path': nodeStubs,
    },
  },
});
