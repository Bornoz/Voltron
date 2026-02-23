import type { RiskLevel } from '../types/risk.js';

export const RISK_COLORS: Record<RiskLevel, string> = {
  NONE: '#6b7280',     // gray
  LOW: '#22c55e',      // green
  MEDIUM: '#eab308',   // yellow
  HIGH: '#f97316',     // orange
  CRITICAL: '#ef4444', // red
};

export const RISK_THRESHOLDS = {
  LARGE_DIFF_LOW: 50,
  LARGE_DIFF_MEDIUM: 200,
  LARGE_DIFF_HIGH: 500,
  LARGE_FILE_MEDIUM: 1_048_576,    // 1MB
  LARGE_FILE_HIGH: 10_485_760,     // 10MB
  CASCADE_MEDIUM: 3,
  CASCADE_HIGH: 5,
  CASCADE_CRITICAL: 10,
  CASCADE_WINDOW_MS: 5000,
  RATE_HIGH_MULTIPLIER: 1,
  RATE_CRITICAL_MULTIPLIER: 2,
  RATE_CONSECUTIVE_SECONDS: 3,
} as const;
