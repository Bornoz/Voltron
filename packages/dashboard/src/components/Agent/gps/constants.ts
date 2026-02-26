import type { GPSTheme } from './types';

// ── Activity Colors ─────────────────────────────────────
export const ACTIVITY_COLORS: Record<string, string> = {
  READING: '#4ade80',
  WRITING: '#facc15',
  SEARCHING: '#60a5fa',
  EXECUTING: '#fb923c',
  THINKING: '#c084fc',
  WAITING: '#9ca3af',
  IDLE: '#6b7280',
};

export const ACTIVITY_BG: Record<string, string> = {
  READING: 'rgba(74,222,128,0.15)',
  WRITING: 'rgba(250,204,21,0.15)',
  SEARCHING: 'rgba(96,165,250,0.15)',
  EXECUTING: 'rgba(251,146,60,0.15)',
  THINKING: 'rgba(192,132,252,0.15)',
  WAITING: 'rgba(156,163,175,0.1)',
  IDLE: 'rgba(107,114,128,0.1)',
};

export const ACTIVITY_ICONS: Record<string, string> = {
  READING: 'R',
  WRITING: 'W',
  SEARCHING: 'S',
  EXECUTING: 'E',
  THINKING: 'T',
  WAITING: '.',
  IDLE: '-',
};

// ── Heatmap Colors ──────────────────────────────────────
export const HEATMAP_COLORS = [
  '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444',
];

// ── File Extension Icons ────────────────────────────────
export const EXT_ICONS: Record<string, string> = {
  '.ts': 'TS',
  '.tsx': 'TX',
  '.js': 'JS',
  '.jsx': 'JX',
  '.css': 'CS',
  '.html': 'HT',
  '.json': 'JN',
  '.md': 'MD',
  '.svg': 'SG',
  '.png': 'PN',
  '.yml': 'YM',
  '.yaml': 'YM',
  '.sh': 'SH',
  '.sql': 'SQ',
  '.py': 'PY',
  '.go': 'GO',
  '.rs': 'RS',
};

// ── Theme ───────────────────────────────────────────────
export const DARK_THEME: GPSTheme = {
  background: '#0a0e1a',
  dirFill: 'rgba(30,41,59,0.6)',
  dirStroke: 'rgba(71,85,105,0.4)',
  dirLabel: '#94a3b8',
  fileFill: '#1e293b',
  fileStroke: '#334155',
  fileLabel: '#cbd5e1',
  currentGlow: '#3b82f6',
  edgeDefault: 'rgba(148,163,184,0.2)',
  trailDefault: 'rgba(59,130,246,0.6)',
  cursorHalo: 'rgba(59,130,246,0.3)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
};

// ── Layout ──────────────────────────────────────────────
export const FORCE = {
  SPRING_K: 0.008,
  SPRING_REST: 120,
  REPULSION: 5000,
  DIR_GRAVITY: 0.02,
  CENTER_GRAVITY: 0.001,
  DAMPING: 0.92,
  ITERATIONS: 80,
  MIN_DIST: 40,
} as const;

export const NODE = {
  FILE_W: 100,
  FILE_H: 36,
  FILE_R: 8,
  DIR_PAD: 24,
  DIR_LABEL_H: 28,
  DIR_R: 12,
  MIN_RADIUS: 10,
  MAX_RADIUS: 24,
} as const;

export const VIEW = {
  MIN_ZOOM: 0.15,
  MAX_ZOOM: 4.0,
  ZOOM_STEP: 0.15,
  MINIMAP_W: 120,
  MINIMAP_H: 80,
  TRAIL_LENGTH: 5,
  CURSOR_TRANSITION_MS: 600,
  CURSOR_TRAIL_OPACITY_DECAY: 0.2,
} as const;

// ── Syntax Highlighting Regex ───────────────────────────
export const SYNTAX = {
  KEYWORDS: /\b(const|let|var|function|class|interface|type|export|import|from|return|if|else|for|while|do|switch|case|break|continue|new|this|typeof|instanceof|void|null|undefined|true|false|async|await|try|catch|throw|finally|extends|implements|static|readonly|private|protected|public|abstract|enum|namespace|module|declare|as|in|of|is|keyof|infer)\b/g,
  STRINGS: /(["'`])(?:(?=(\\?))\2.)*?\1/g,
  COMMENTS_SINGLE: /\/\/.*/g,
  COMMENTS_MULTI: /\/\*[\s\S]*?\*\//g,
  NUMBERS: /\b\d+\.?\d*\b/g,
  TYPES: /\b[A-Z][A-Za-z0-9]*\b/g,
} as const;
