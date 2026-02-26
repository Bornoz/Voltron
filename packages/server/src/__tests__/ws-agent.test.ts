import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { initDb, closeDb } from '../db/connection.js';
import { createSchema } from '../db/schema.js';
import { ProjectRepository } from '../db/repositories/projects.js';
import { EventBus } from '../services/event-bus.js';
import { createWsServices, registerWsHandler } from '../ws/handler.js';
import type { ServerConfig } from '../config.js';
import type { AgentRunner } from '../services/agent-runner.js';

const TEST_PORT = 18602;
let TEST_PROJECT_ID = '';

function makeConfig(): ServerConfig {
  return {
    port: TEST_PORT,
    host: '127.0.0.1',
    dbPath: ':memory:',
    logLevel: 'silent',
    interceptorSecret: '',
    githubToken: null,
    corsOrigins: ['http://localhost:6400'],
    claudePath: 'claude',
    agentModel: 'test-model',
    agentTimeoutMs: 60_000,
    authSecret: '',
    adminUser: 'admin',
    adminPass: 'pass',
  };
}

function connectWs(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function sendJson(ws: WebSocket, data: unknown): void {
  ws.send(JSON.stringify(data));
}

function collectMessages(ws: WebSocket, timeoutMs = 500): Promise<any[]> {
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

function waitMessage(ws: WebSocket, timeoutMs = 2000): Promise<any | null> {
  return Promise.race([
    new Promise<any>((resolve) => {
      ws.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

async function registerClient(
  port: number,
  opts: { clientType: 'interceptor' | 'dashboard' | 'simulator'; authToken?: string },
): Promise<{ ws: WebSocket; initialMessages: any[] }> {
  const ws = await connectWs(port);
  const collecting = collectMessages(ws, 300);
  sendJson(ws, {
    type: 'REGISTER',
    clientType: opts.clientType,
    clientId: randomUUID(),
    projectId: TEST_PROJECT_ID,
    authToken: opts.authToken,
  });
  const initialMessages = await collecting;
  return { ws, initialMessages };
}

// Mock AgentRunner
function createMockAgentRunner(): AgentRunner {
  return {
    spawn: vi.fn().mockResolvedValue('mock-session-id'),
    pause: vi.fn(),
    resume: vi.fn(),
    kill: vi.fn().mockResolvedValue(undefined),
    injectPrompt: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockReturnValue(null),
    isRunning: vi.fn().mockReturnValue(false),
  } as unknown as AgentRunner;
}

describe('WS Agent Commands Integration', () => {
  let app: FastifyInstance;
  let mockRunner: AgentRunner;
  let eventBus: EventBus;

  beforeAll(async () => {
    const config = makeConfig();
    const db = initDb(':memory:');
    createSchema(db);

    const projectRepo = new ProjectRepository();
    const project = projectRepo.create({
      name: 'Agent Test Project',
      rootPath: '/tmp/agent-test',
    });
    TEST_PROJECT_ID = project.id;

    app = Fastify({ logger: false });
    await app.register(websocket);

    eventBus = new EventBus();
    mockRunner = createMockAgentRunner();
    const services = createWsServices(config, eventBus, mockRunner);
    registerWsHandler(app, config, services);

    await app.listen({ port: TEST_PORT, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  it('should handle AGENT_SPAWN from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    const corrId = randomUUID();
    sendJson(ws, {
      type: 'AGENT_SPAWN',
      payload: {
        model: 'claude-haiku-4-5-20251001',
        prompt: 'Fix the login bug',
        targetDir: '/tmp/agent-test',
      },
      correlationId: corrId,
      timestamp: Date.now(),
    });

    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('ACK');
    expect(resp?.payload?.sessionId).toBe('mock-session-id');
    expect(resp?.payload?.status).toBe('SPAWNING');
    expect(resp?.correlationId).toBe(corrId);
    expect(mockRunner.spawn).toHaveBeenCalled();
    ws.close();
  });

  it('should handle AGENT_SPAWN failure', async () => {
    (mockRunner.spawn as any).mockRejectedValueOnce(new Error('Claude binary not found'));

    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'AGENT_SPAWN',
      payload: {
        prompt: 'Fix bugs',
        targetDir: '/tmp/agent-test',
      },
      timestamp: Date.now(),
    });

    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('AGENT_ERROR');
    expect(resp?.payload?.error).toContain('Claude binary not found');
    ws.close();
  });

  it('should handle AGENT_STOP from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'AGENT_STOP',
      payload: {},
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mockRunner.pause).toHaveBeenCalledWith(TEST_PROJECT_ID);
    ws.close();
  });

  it('should handle AGENT_RESUME from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'AGENT_RESUME',
      payload: {},
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mockRunner.resume).toHaveBeenCalledWith(TEST_PROJECT_ID);
    ws.close();
  });

  it('should handle AGENT_KILL from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'AGENT_KILL',
      payload: {},
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mockRunner.kill).toHaveBeenCalledWith(TEST_PROJECT_ID);
    ws.close();
  });

  it('should handle AGENT_INJECT_PROMPT from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'AGENT_INJECT_PROMPT',
      payload: {
        prompt: 'Also add dark mode support',
        context: { filePath: '/src/theme.ts' },
        urgency: 'high',
      },
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mockRunner.injectPrompt).toHaveBeenCalledWith(
      TEST_PROJECT_ID,
      expect.objectContaining({
        prompt: 'Also add dark mode support',
        urgency: 'high',
      }),
    );
    ws.close();
  });

  it('should ignore agent commands from interceptor', async () => {
    (mockRunner.spawn as any).mockClear();

    const { ws } = await registerClient(TEST_PORT, { clientType: 'interceptor' });

    sendJson(ws, {
      type: 'AGENT_SPAWN',
      payload: { prompt: 'hack', targetDir: '/tmp' },
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mockRunner.spawn).not.toHaveBeenCalled();
    ws.close();
  });

  it('should broadcast agent events from EventBus to dashboard', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    const eventPromise = waitMessage(dashWs, 2000);
    eventBus.emit('AGENT_STATUS_CHANGE', {
      projectId: TEST_PROJECT_ID,
      status: 'RUNNING',
      sessionId: 'sess-42',
    });

    const msg = await eventPromise;
    expect(msg).not.toBeNull();
    expect(msg?.type).toBe('AGENT_STATUS_CHANGE');
    expect(msg?.payload?.status).toBe('RUNNING');
    dashWs.close();
  });

  it('should broadcast AGENT_LOCATION_UPDATE to both dashboard and simulator', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });
    const { ws: simWs } = await registerClient(TEST_PORT, { clientType: 'simulator' });

    const dashPromise = waitMessage(dashWs, 2000);
    const simPromise = waitMessage(simWs, 2000);

    eventBus.emit('AGENT_LOCATION_UPDATE', {
      projectId: TEST_PROJECT_ID,
      location: { filePath: '/src/index.ts', activity: 'WRITING', timestamp: Date.now() },
    });

    const [dashMsg, simMsg] = await Promise.all([dashPromise, simPromise]);

    expect(dashMsg?.type).toBe('AGENT_LOCATION_UPDATE');
    expect(simMsg?.type).toBe('AGENT_LOCATION_UPDATE');

    dashWs.close();
    simWs.close();
  });

  it('should broadcast AGENT_OUTPUT only to dashboard (not simulator)', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });
    const { ws: simWs } = await registerClient(TEST_PORT, { clientType: 'simulator' });

    const dashPromise = waitMessage(dashWs, 1000);
    const simPromise = waitMessage(simWs, 500);

    eventBus.emit('AGENT_OUTPUT', {
      projectId: TEST_PROJECT_ID,
      text: 'Reading file...',
      type: 'text',
      timestamp: Date.now(),
    });

    const [dashMsg, simMsg] = await Promise.all([dashPromise, simPromise]);

    expect(dashMsg?.type).toBe('AGENT_OUTPUT');
    expect(simMsg).toBeNull();

    dashWs.close();
    simWs.close();
  });

  it('should broadcast AGENT_TOKEN_USAGE to dashboard', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    const dashPromise = waitMessage(dashWs, 1000);

    eventBus.emit('AGENT_TOKEN_USAGE', {
      projectId: TEST_PROJECT_ID,
      inputTokens: 5000,
      outputTokens: 2000,
    });

    const msg = await dashPromise;
    expect(msg?.type).toBe('AGENT_TOKEN_USAGE');
    expect(msg?.payload?.inputTokens).toBe(5000);

    dashWs.close();
  });

  it('should broadcast AGENT_ERROR to dashboard', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    const dashPromise = waitMessage(dashWs, 1000);

    eventBus.emit('AGENT_ERROR', {
      projectId: TEST_PROJECT_ID,
      error: 'Process exited with code 1',
    });

    const msg = await dashPromise;
    expect(msg?.type).toBe('AGENT_ERROR');
    expect(msg?.payload?.error).toBe('Process exited with code 1');

    dashWs.close();
  });

  it('should broadcast AGENT_PHASE_UPDATE to dashboard', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    const dashPromise = waitMessage(dashWs, 1000);

    eventBus.emit('AGENT_PHASE_UPDATE', {
      projectId: TEST_PROJECT_ID,
      phases: [{ id: 'p1', title: 'Setup', edits: [], status: 'running' }],
      currentPhaseIndex: 0,
      status: 'running',
    });

    const msg = await dashPromise;
    expect(msg?.type).toBe('AGENT_PHASE_UPDATE');

    dashWs.close();
  });

  it('should broadcast DEV_SERVER_STATUS to dashboard', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    const dashPromise = waitMessage(dashWs, 1000);

    eventBus.emit('DEV_SERVER_STATUS', {
      projectId: TEST_PROJECT_ID,
      status: 'ready',
      port: 3000,
      url: 'http://localhost:3000',
    });

    const msg = await dashPromise;
    expect(msg?.type).toBe('DEV_SERVER_STATUS');
    expect(msg?.payload?.status).toBe('ready');

    dashWs.close();
  });

  it('should handle AGENT_STOP failure gracefully', async () => {
    (mockRunner.pause as any).mockImplementationOnce(() => {
      throw new Error('No active session');
    });

    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'AGENT_STOP',
      payload: {},
      timestamp: Date.now(),
    });

    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('AGENT_ERROR');
    expect(resp?.payload?.error).toContain('No active session');
    ws.close();
  });
});
