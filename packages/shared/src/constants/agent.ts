export const AGENT_CONSTANTS = {
  /** Path to Claude CLI binary */
  CLAUDE_BINARY: process.env.VOLTRON_CLAUDE_PATH ?? 'claude',

  /** Default model for agent spawning */
  DEFAULT_MODEL: 'claude-haiku-4-5-20251001',

  /** Maximum breadcrumbs to keep in memory per session */
  MAX_BREADCRUMBS: 500,

  /** Throttle interval for location updates (ms) */
  LOCATION_THROTTLE_MS: 200,

  /** Plan extraction debounce (ms) */
  PLAN_DEBOUNCE_MS: 1000,

  /** Max time to wait for SIGTERM before SIGKILL (ms) */
  KILL_TIMEOUT_MS: 5000,

  /** Max agent sessions per project (enforced: 1 running at a time) */
  MAX_CONCURRENT_PER_PROJECT: 1,

  /** Agent process timeout - kill after this (ms, 0 = no timeout) */
  AGENT_TIMEOUT_MS: 0,

  /** Supported Claude models */
  SUPPORTED_MODELS: [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
  ] as const,

  /** Tool name to AgentActivity mapping */
  TOOL_ACTIVITY_MAP: {
    Read: 'READING',
    Write: 'WRITING',
    Edit: 'WRITING',
    Grep: 'SEARCHING',
    Glob: 'SEARCHING',
    Bash: 'EXECUTING',
    Task: 'THINKING',
    WebFetch: 'SEARCHING',
    WebSearch: 'SEARCHING',
  } as Record<string, string>,

  /** Tool name to file path extraction key */
  TOOL_FILE_PATH_MAP: {
    Read: 'file_path',
    Write: 'file_path',
    Edit: 'file_path',
    Grep: 'path',
    Glob: 'path',
  } as Record<string, string>,
} as const;
