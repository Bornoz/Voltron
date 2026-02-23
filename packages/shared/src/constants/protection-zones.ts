export const SELF_PROTECTION_PATHS = [
  '/opt/voltron/**',
  '**/voltron.db*',
  '**/voltron.config.*',
  '/etc/nginx/**',
  '/etc/systemd/**',
  '/etc/letsencrypt/**',
] as const;

export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'coverage/**',
  '.turbo/**',
  '*.log',
] as const;
