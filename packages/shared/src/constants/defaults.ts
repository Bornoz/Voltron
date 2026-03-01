export const DEFAULTS = {
  SERVER_PORT: 8600,
  DB_PATH: 'data/voltron.db',
  LOG_LEVEL: 'info',

  // Project defaults
  MAX_FILE_SIZE: 10_485_760,     // 10MB
  DEBOUNCE_MS: 500,
  SNAPSHOT_RETENTION: 100,
  RATE_LIMIT: 50,
  AUTO_STOP_ON_CRITICAL: true,

  // WebSocket
  WS_HEARTBEAT_INTERVAL: 30_000,  // 30s
  WS_RECONNECT_BASE: 2_000,      // 2s
  WS_RECONNECT_MAX: 30_000,      // 30s
  WS_QUEUE_MAX: 1_000,

  // Interceptor
  RECONCILE_INTERVAL: 60_000,     // 60s
  RENAME_DETECTION_WINDOW: 100,   // 100ms

  // Max events in dashboard memory
  MAX_EVENTS_IN_MEMORY: 5_000,

  // UI file patterns
  UI_FILE_PATTERNS: [
    '**/*.tsx', '**/*.jsx', '**/*.css', '**/*.scss',
    '**/*.less', '**/*.html', '**/*.svg',
    '**/tailwind.config.*', '**/postcss.config.*',
    '**/components/**', '**/pages/**', '**/layouts/**',
    '**/styles/**', '**/public/**',
  ],
} as const;
