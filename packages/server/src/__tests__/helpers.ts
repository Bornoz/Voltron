import Fastify, { type FastifyInstance } from 'fastify';
import { initDb, closeDb } from '../db/connection.js';
import { createSchema } from '../db/schema.js';
import { registerAuth } from '../plugins/auth.js';
import { registerErrorHandler } from '../plugins/error-handler.js';
import { authRoutes } from '../routes/auth.js';
import { healthRoutes } from '../routes/health.js';
import { projectRoutes } from '../routes/projects.js';
import { protectionRoutes } from '../routes/protection.js';
import { snapshotRoutes } from '../routes/snapshots.js';
import type { ServerConfig } from '../config.js';

export const TEST_AUTH_SECRET = 'test-secret-for-unit-tests-only';
export const TEST_ADMIN_USER = 'admin';
export const TEST_ADMIN_PASS = 'test-pass';

function makeTestConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  return {
    port: 8600,
    host: '127.0.0.1',
    dbPath: ':memory:',
    logLevel: 'silent',
    interceptorSecret: '',
    githubToken: null,
    corsOrigins: ['http://localhost:6400'],
    claudePath: 'claude',
    agentModel: 'test-model',
    agentTimeoutMs: 60_000,
    authSecret: TEST_AUTH_SECRET,
    adminUser: TEST_ADMIN_USER,
    adminPass: TEST_ADMIN_PASS,
    ...overrides,
  };
}

/**
 * Build a Fastify test instance with in-memory SQLite.
 * Call `cleanup()` after each test suite.
 */
export async function buildTestApp(overrides?: Partial<ServerConfig>): Promise<FastifyInstance> {
  const config = makeTestConfig(overrides);

  // Init in-memory DB
  const db = initDb(':memory:');
  createSchema(db);

  const app = Fastify({ logger: false });

  // Auth middleware
  registerAuth(app, config);

  // Error handler must be registered for proper Zod validation 400s
  registerErrorHandler(app);

  // Auth routes
  authRoutes(app, config);

  // Register routes
  await app.register(healthRoutes);
  await app.register(projectRoutes);
  await app.register(protectionRoutes);
  await app.register(snapshotRoutes);

  await app.ready();
  return app;
}

/**
 * Build a test app with auth DISABLED (for backward compatibility with existing tests).
 */
export async function buildTestAppNoAuth(): Promise<FastifyInstance> {
  return buildTestApp({ authSecret: '' });
}

/**
 * Login and return a valid Bearer token for test requests.
 */
export async function getTestToken(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: TEST_ADMIN_USER, password: TEST_ADMIN_PASS },
  });
  const body = JSON.parse(res.body) as { token: string };
  return body.token;
}

export async function cleanup(app: FastifyInstance): Promise<void> {
  await app.close();
  closeDb();
}
