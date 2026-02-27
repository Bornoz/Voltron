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
        manualChunks(id) {
          // All React-related modules MUST be in the same chunk to share the dispatcher
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/recharts')) return 'vendor-recharts';
          if (
            id.includes('node_modules/date-fns') ||
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge')
          ) {
            return 'vendor-utils';
          }
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
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
