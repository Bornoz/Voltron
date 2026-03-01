import { z } from 'zod';
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
  authSecret: string;
  adminUser: string;
  adminPass: string;
}

const EnvSchema = z.object({
  VOLTRON_PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULTS.SERVER_PORT),
  VOLTRON_HOST: z.string().default('127.0.0.1'),
  VOLTRON_DB_PATH: z.string().default(DEFAULTS.DB_PATH),
  VOLTRON_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default(DEFAULTS.LOG_LEVEL as 'info'),
  VOLTRON_INTERCEPTOR_SECRET: z.string().optional().default(''),
  VOLTRON_GITHUB_TOKEN: z.string().optional(),
  VOLTRON_CLAUDE_PATH: z.string().optional(),
  VOLTRON_AGENT_MODEL: z.string().optional(),
  VOLTRON_AGENT_TIMEOUT: z.coerce.number().int().nonnegative().optional(),
  VOLTRON_AUTH_SECRET: z.string().optional(),
  VOLTRON_ADMIN_USER: z.string().optional(),
  VOLTRON_ADMIN_PASS: z.string().optional(),
  VOLTRON_CORS_ORIGINS: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export function loadConfig(): ServerConfig {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    console.error(`\n[VOLTRON] Environment validation failed:\n${errors}\n`);
    process.exit(1);
  }

  const env = result.data;

  // In production, interceptor secret is required
  if (env.NODE_ENV === 'production' && !env.VOLTRON_INTERCEPTOR_SECRET) {
    console.error('\n[VOLTRON] VOLTRON_INTERCEPTOR_SECRET is required in production\n');
    process.exit(1);
  }

  // In production, auth secret is required
  if (env.NODE_ENV === 'production' && !env.VOLTRON_AUTH_SECRET) {
    console.error('\n[VOLTRON] VOLTRON_AUTH_SECRET is required in production\n');
    process.exit(1);
  }

  return {
    port: env.VOLTRON_PORT,
    host: env.VOLTRON_HOST,
    dbPath: env.VOLTRON_DB_PATH,
    logLevel: env.VOLTRON_LOG_LEVEL,
    interceptorSecret: env.VOLTRON_INTERCEPTOR_SECRET,
    githubToken: env.VOLTRON_GITHUB_TOKEN ?? null,
    corsOrigins: [
      ...(env.VOLTRON_CORS_ORIGINS
        ? env.VOLTRON_CORS_ORIGINS.split(',').map((s) => s.trim())
        : []),
      'http://localhost:6400',
      'http://localhost:5174',
    ],
    claudePath: env.VOLTRON_CLAUDE_PATH ?? AGENT_CONSTANTS.CLAUDE_BINARY,
    agentModel: env.VOLTRON_AGENT_MODEL ?? AGENT_CONSTANTS.DEFAULT_MODEL,
    agentTimeoutMs: env.VOLTRON_AGENT_TIMEOUT ?? AGENT_CONSTANTS.AGENT_TIMEOUT_MS,
    authSecret: env.VOLTRON_AUTH_SECRET ?? '',
    adminUser: env.VOLTRON_ADMIN_USER ?? '',
    adminPass: env.VOLTRON_ADMIN_PASS ?? '',
  };
}
