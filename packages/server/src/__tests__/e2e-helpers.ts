/**
 * Full-app E2E test helpers.
 * Builds a complete Fastify server with ALL routes, in-memory SQLite, and mock AgentRunner.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { initDb, closeDb } from '../db/connection.js';
import { createSchema } from '../db/schema.js';
import { registerAuth } from '../plugins/auth.js';
import { registerErrorHandler } from '../plugins/error-handler.js';
import { authRoutes } from '../routes/auth.js';
import { healthRoutes } from '../routes/health.js';
import { projectRoutes } from '../routes/projects.js';
import { actionRoutes } from '../routes/actions.js';
import { snapshotRoutes } from '../routes/snapshots.js';
import { protectionRoutes } from '../routes/protection.js';
import { controlRoutes } from '../routes/control.js';
import { behaviorRoutes } from '../routes/behavior.js';
import { promptRoutes } from '../routes/prompts.js';
import { projectSettingsRoutes } from '../routes/project-settings.js';
import { demoRoutes } from '../routes/demo.js';
import { aiToolRoutes } from '../routes/ai-tools.js';
import { agentRoutes } from '../routes/agent.js';
import { createWsServices, registerWsHandler } from '../ws/handler.js';
import { EventBus } from '../services/event-bus.js';
import { AiDetector } from '../services/ai-detector.js';
import { BehaviorScorer } from '../services/behavior-scorer.js';
import { ProjectRepository } from '../db/repositories/projects.js';
import type { ServerConfig } from '../config.js';
import type { AgentRunner } from '../services/agent-runner.js';
import type { DevServerManager } from '../services/dev-server-manager.js';
import { vi } from 'vitest';

export const E2E_PORT = 18700;
export const E2E_AUTH_SECRET = 'e2e-test-secret';
export const E2E_ADMIN_USER = 'admin';
export const E2E_ADMIN_PASS = 'admin-pass-e2e';

export function makeE2EConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  return {
    port: E2E_PORT,
    host: '127.0.0.1',
    dbPath: ':memory:',
    logLevel: 'silent',
    interceptorSecret: 'test-interceptor-secret',
    githubToken: null,
    corsOrigins: ['http://localhost:6400'],
    claudePath: 'claude',
    agentModel: 'test-model',
    agentTimeoutMs: 60_000,
    authSecret: E2E_AUTH_SECRET,
    adminUser: E2E_ADMIN_USER,
    adminPass: E2E_ADMIN_PASS,
    ...overrides,
  };
}

export function createMockAgentRunner(): AgentRunner {
  return {
    spawn: vi.fn().mockResolvedValue('mock-session-001'),
    pause: vi.fn(),
    resume: vi.fn(),
    kill: vi.fn().mockResolvedValue(undefined),
    injectPrompt: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockReturnValue(null),
    getSessionFromDb: vi.fn().mockReturnValue(null),
    getSessionHistory: vi.fn().mockReturnValue([]),
    getSessions: vi.fn().mockReturnValue([]),
    isRunning: vi.fn().mockReturnValue(false),
    shutdownAll: vi.fn().mockResolvedValue(undefined),
    getBreakpoints: vi.fn().mockReturnValue([]),
    setBreakpoint: vi.fn(),
    removeBreakpoint: vi.fn(),
    getInjections: vi.fn().mockReturnValue([]),
    getPlan: vi.fn().mockReturnValue(null),
    getBreadcrumbs: vi.fn().mockReturnValue([]),
    handlePhaseDecision: vi.fn().mockResolvedValue(undefined),
    hardPause: vi.fn(),
    resumeCheckpoint: vi.fn(),
    redirect: vi.fn(),
  } as unknown as AgentRunner;
}

export function createMockDevServerManager(): DevServerManager {
  return {
    getInfo: vi.fn().mockReturnValue(null),
    getStatus: vi.fn().mockReturnValue(null),
    restart: vi.fn().mockResolvedValue(undefined),
    stopAll: vi.fn().mockResolvedValue(undefined),
  } as unknown as DevServerManager;
}

export interface E2EContext {
  app: FastifyInstance;
  config: ServerConfig;
  eventBus: EventBus;
  mockRunner: AgentRunner;
  mockDevServer: DevServerManager;
  projectRepo: ProjectRepository;
}

/**
 * Build a complete Fastify app with ALL routes registered, in-memory DB.
 * For WebSocket tests, pass `listen: true` to bind to a port.
 */
export async function buildFullTestApp(opts?: {
  listen?: boolean;
  port?: number;
  configOverrides?: Partial<ServerConfig>;
}): Promise<E2EContext> {
  const port = opts?.port ?? E2E_PORT;
  const config = makeE2EConfig({ port, ...opts?.configOverrides });
  const db = initDb(':memory:');
  createSchema(db);

  const app = Fastify({ logger: false });

  // Plugins
  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  registerAuth(app, config);
  registerErrorHandler(app);

  // Services
  const eventBus = new EventBus();
  const mockRunner = createMockAgentRunner();
  const mockDevServer = createMockDevServerManager();
  const wsServices = createWsServices(config, eventBus, mockRunner);
  const behaviorScorer = new BehaviorScorer();
  const aiDetector = new AiDetector();

  // Auth routes (before protected routes)
  authRoutes(app, config);

  // All routes
  await app.register((instance) => healthRoutes(instance, { broadcaster: wsServices.broadcaster, agentRunner: mockRunner }));
  await app.register(projectRoutes);
  await app.register(actionRoutes);
  await app.register(snapshotRoutes);
  await app.register(protectionRoutes);
  controlRoutes(app, wsServices.stateMachine, wsServices.broadcaster, wsServices.circuitBreaker);
  behaviorRoutes(app, behaviorScorer);
  promptRoutes(app);
  agentRoutes(app, mockRunner, mockDevServer);
  projectSettingsRoutes(app);
  demoRoutes(app, wsServices.broadcaster);
  aiToolRoutes(app, aiDetector);

  // WebSocket
  registerWsHandler(app, config, wsServices);

  // Stats endpoint
  app.get('/api/stats', async (_request, reply) => {
    return reply.send({
      ws: wsServices.broadcaster.getStats(),
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  app.get('/api/sessions', async (_request, reply) => {
    return reply.send(wsServices.sessionRepo.getActive());
  });

  // Interceptor status per project
  app.get<{ Params: { id: string } }>('/api/projects/:id/interceptor/status', async (request, reply) => {
    const connections = wsServices.broadcaster.getConnectionCounts();
    const projectConns = connections.byProject[request.params.id];
    const controlState = wsServices.stateMachine.getState(request.params.id);
    const circuitRate = wsServices.circuitBreaker.getCurrentRate();
    return reply.send({
      interceptorConnected: (projectConns?.interceptors ?? 0) > 0,
      dashboardConnected: (projectConns?.dashboards ?? 0) > 0,
      simulatorConnected: (projectConns?.simulators ?? 0) > 0,
      totalConnections: projectConns?.total ?? 0,
      executionState: controlState?.state ?? 'IDLE',
      currentRate: circuitRate,
      timestamp: Date.now(),
    });
  });

  if (opts?.listen) {
    await app.listen({ port, host: '127.0.0.1' });
  } else {
    await app.ready();
  }

  const projectRepo = new ProjectRepository();

  return { app, config, eventBus, mockRunner, mockDevServer, projectRepo };
}

export async function cleanupE2E(ctx: E2EContext): Promise<void> {
  await ctx.app.close();
  closeDb();
}

/** Get a JWT token via login */
export async function getToken(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username: E2E_ADMIN_USER, password: E2E_ADMIN_PASS },
  });
  return (res.json() as { token: string }).token;
}

/** Inject an authenticated request */
export async function authInject(
  app: FastifyInstance,
  token: string,
  opts: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; payload?: unknown },
) {
  return app.inject({
    method: opts.method,
    url: opts.url,
    headers: { authorization: `Bearer ${token}` },
    payload: opts.payload as any,
  });
}

/** Create a project and return its ID */
export async function createTestProject(
  app: FastifyInstance,
  token: string,
  name = 'E2E Test Project',
  rootPath = '/tmp/e2e-test',
): Promise<string> {
  const res = await authInject(app, token, {
    method: 'POST',
    url: '/api/projects',
    payload: { name, rootPath },
  });
  return (res.json() as { id: string }).id;
}

// ── WebSocket helpers ──

export function connectWs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

export function sendJson(ws: WebSocket, data: unknown): void {
  ws.send(JSON.stringify(data));
}

export function waitMessage(ws: WebSocket, timeoutMs = 2000): Promise<any | null> {
  return Promise.race([
    new Promise<any>((resolve) => {
      ws.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export function collectMessages(ws: WebSocket, timeoutMs = 500): Promise<any[]> {
  return new Promise((resolve) => {
    const msgs: any[] = [];
    const handler = (raw: Buffer | ArrayBuffer | Buffer[]) => {
      msgs.push(JSON.parse(raw.toString()));
    };
    ws.on('message', handler);
    setTimeout(() => {
      ws.off('message', handler);
      resolve(msgs);
    }, timeoutMs);
  });
}

/**
 * Register a WS client. For dashboard/simulator, pass authToken (JWT).
 * For interceptor, pass secret.
 */
export async function registerWsClient(
  port: number,
  projectId: string,
  clientType: 'interceptor' | 'dashboard' | 'simulator',
  authToken?: string,
): Promise<{ ws: WebSocket; initialMessages: any[] }> {
  const ws = await connectWs(port);
  const collecting = collectMessages(ws, 300);
  sendJson(ws, {
    type: 'REGISTER',
    clientType,
    clientId: randomUUID(),
    projectId,
    authToken: clientType === 'interceptor'
      ? (authToken ?? 'test-interceptor-secret')
      : (authToken ?? undefined),
  });
  const initialMessages = await collecting;
  return { ws, initialMessages };
}

/**
 * Register a WS client with proper auth.
 * Gets a JWT token first for dashboard/simulator clients.
 */
export async function registerAuthWsClient(
  app: FastifyInstance,
  port: number,
  projectId: string,
  clientType: 'interceptor' | 'dashboard' | 'simulator',
): Promise<{ ws: WebSocket; initialMessages: any[] }> {
  if (clientType === 'interceptor') {
    return registerWsClient(port, projectId, clientType, 'test-interceptor-secret');
  }
  // Get JWT token for dashboard/simulator
  const token = await getToken(app);
  return registerWsClient(port, projectId, clientType, token);
}
