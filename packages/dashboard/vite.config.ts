import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
          'vendor-recharts': ['recharts'],
          'vendor-utils': ['date-fns', 'zustand', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
  resolve: {
    alias: {
      // Stub out node builtins that shared package imports but dashboard doesn't use
      'node:crypto': '/opt/voltron/packages/dashboard/src/lib/node-stubs.ts',
      'node:fs': '/opt/voltron/packages/dashboard/src/lib/node-stubs.ts',
      'node:path': '/opt/voltron/packages/dashboard/src/lib/node-stubs.ts',
    },
  },
});
