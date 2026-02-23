import { DEFAULTS, AGENT_CONSTANTS } from '@voltron/shared';

export interface ServerConfig {
  port: number;
  host: string;
  dbPath: string;
  logLevel: string;
  interceptorSecret: string;
  githubToken: string | null;
  corsOrigins: string[];
  claudePath: string;
  agentModel: string;
  agentTimeoutMs: number;
}

export function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.VOLTRON_PORT ?? String(DEFAULTS.SERVER_PORT), 10),
    host: process.env.VOLTRON_HOST ?? '127.0.0.1',
    dbPath: process.env.VOLTRON_DB_PATH ?? DEFAULTS.DB_PATH,
    logLevel: process.env.VOLTRON_LOG_LEVEL ?? DEFAULTS.LOG_LEVEL,
    interceptorSecret: process.env.VOLTRON_INTERCEPTOR_SECRET ?? '',
    githubToken: process.env.VOLTRON_GITHUB_TOKEN ?? null,
    corsOrigins: [
      'https://voltron.isgai.tr',
      'http://localhost:6400',
      'http://localhost:5174',
    ],
    claudePath: process.env.VOLTRON_CLAUDE_PATH ?? AGENT_CONSTANTS.CLAUDE_BINARY,
    agentModel: process.env.VOLTRON_AGENT_MODEL ?? AGENT_CONSTANTS.DEFAULT_MODEL,
    agentTimeoutMs: parseInt(process.env.VOLTRON_AGENT_TIMEOUT ?? String(AGENT_CONSTANTS.AGENT_TIMEOUT_MS), 10),
  };
}
