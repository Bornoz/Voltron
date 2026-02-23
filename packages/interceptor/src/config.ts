import { DEFAULTS } from '@voltron/shared';

export interface InterceptorConfig {
  projectId: string;
  projectRoot: string;
  serverUrl: string;
  authToken: string;
  debounceMs: number;
  maxFileSize: number;
  ignorePatterns: string[];
  reconcileInterval: number;
  rateLimit: number;
}

export function loadConfig(): InterceptorConfig {
  const projectRoot = process.argv[2] || process.env.VOLTRON_PROJECT_ROOT;
  if (!projectRoot) {
    console.error('Usage: voltron-interceptor <project-root>');
    console.error('  or set VOLTRON_PROJECT_ROOT environment variable');
    process.exit(1);
  }

  return {
    projectId: process.env.VOLTRON_PROJECT_ID || '',
    projectRoot,
    serverUrl: process.env.VOLTRON_SERVER_URL || `ws://127.0.0.1:${DEFAULTS.SERVER_PORT}/ws`,
    authToken: process.env.VOLTRON_INTERCEPTOR_SECRET || '',
    debounceMs: parseInt(process.env.VOLTRON_DEBOUNCE_MS || String(DEFAULTS.DEBOUNCE_MS), 10),
    maxFileSize: parseInt(process.env.VOLTRON_MAX_FILE_SIZE || String(DEFAULTS.MAX_FILE_SIZE), 10),
    ignorePatterns: [
      'node_modules/**', '.git/**', 'dist/**', 'build/**',
      'coverage/**', '.turbo/**', '*.log',
      ...(process.env.VOLTRON_IGNORE_PATTERNS?.split(',') ?? []),
    ],
    reconcileInterval: parseInt(process.env.VOLTRON_RECONCILE_INTERVAL || String(DEFAULTS.RECONCILE_INTERVAL), 10),
    rateLimit: parseInt(process.env.VOLTRON_RATE_LIMIT || String(DEFAULTS.RATE_LIMIT), 10),
  };
}
