import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

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
      'node:crypto': '/opt/voltron/packages/ui-simulator/src/lib/node-stubs.ts',
      'node:fs': '/opt/voltron/packages/ui-simulator/src/lib/node-stubs.ts',
      'node:path': '/opt/voltron/packages/ui-simulator/src/lib/node-stubs.ts',
    },
  },
});
