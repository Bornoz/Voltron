import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { initDb, closeDb, getDb } from '../db/connection.js';
import { createSchema } from '../db/schema.js';
import { ProjectRepository } from '../db/repositories/projects.js';
import { EventBus } from '../services/event-bus.js';
import { createWsServices, registerWsHandler } from '../ws/handler.js';
import type { ServerConfig } from '../config.js';

const TEST_PORT = 18601;
let TEST_PROJECT_ID = '';
let TEST_SNAPSHOT_ID = '';

function makeConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  return {
    port: TEST_PORT,
    host: '127.0.0.1',
    dbPath: ':memory:',
    logLevel: 'silent',
    interceptorSecret: 'test-secret',
    githubToken: null,
    corsOrigins: ['http://localhost:6400'],
    claudePath: 'claude',
    agentModel: 'test-model',
    agentTimeoutMs: 60_000,
    authSecret: '',
    adminUser: 'admin',
    adminPass: 'pass',
    ...overrides,
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

/** Collect all messages received within timeoutMs */
function collectMessages(ws: WebSocket, timeoutMs = 500): Promise<unknown[]> {
  return new Promise((resolve) => {
    const msgs: unknown[] = [];
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

/** Wait for a single message with timeout */
function waitMessage(ws: WebSocket, timeoutMs = 2000): Promise<any | null> {
  return Promise.race([
    new Promise<any>((resolve) => {
      ws.once('message', (raw) => resolve(JSON.parse(raw.toString())));
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/** Register a client and wait for the STATE_CHANGE response */
async function registerClient(
  port: number,
  opts: { clientType: 'interceptor' | 'dashboard' | 'simulator'; authToken?: string },
): Promise<{ ws: WebSocket; initialMessages: unknown[] }> {
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

describe('WS Interceptor Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const config = makeConfig();
    const db = initDb(':memory:');
    createSchema(db);

    const projectRepo = new ProjectRepository();
    const project = projectRepo.create({
      name: 'Test Project',
      rootPath: '/tmp/test',
    });
    TEST_PROJECT_ID = project.id;

    // Create a snapshot so ACTION_EVENT snapshotId FK is satisfied
    TEST_SNAPSHOT_ID = randomUUID();
    getDb().prepare(`
      INSERT INTO snapshots (id, project_id, parent_id, git_commit_hash, label, file_count, total_size, is_critical, created_at)
      VALUES (?, ?, NULL, ?, 'test snapshot', 1, 100, 0, ?)
    `).run(TEST_SNAPSHOT_ID, TEST_PROJECT_ID, 'a'.repeat(40), Date.now());

    app = Fastify({ logger: false });
    await app.register(websocket);

    const eventBus = new EventBus();
    const services = createWsServices(config, eventBus);
    registerWsHandler(app, config, services);

    await app.listen({ port: TEST_PORT, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
    closeDb();
  });

  it('should accept interceptor registration with valid auth token', async () => {
    const { ws, initialMessages } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });
    const stateMsg = initialMessages.find((m: any) => m.type === 'STATE_CHANGE');
    expect(stateMsg).toBeDefined();
    ws.close();
  });

  it('should reject interceptor with invalid auth token', async () => {
    const ws = await connectWs(TEST_PORT);
    sendJson(ws, {
      type: 'REGISTER',
      clientType: 'interceptor',
      clientId: randomUUID(),
      projectId: TEST_PROJECT_ID,
      authToken: 'wrong-secret',
    });

    await new Promise<void>((resolve) => {
      ws.on('close', (code) => {
        expect(code).toBe(4003);
        resolve();
      });
      // Fallback timeout
      setTimeout(() => {
        ws.close();
        resolve();
      }, 3000);
    });
  });

  it('should reject invalid registration payload', async () => {
    const ws = await connectWs(TEST_PORT);
    const msg = await waitMessage(ws);
    sendJson(ws, { garbage: true });
    const errorMsg = await waitMessage(ws);
    expect(errorMsg?.type).toBe('ERROR');
    await new Promise<void>((resolve) => {
      ws.on('close', () => resolve());
      setTimeout(() => { ws.close(); resolve(); }, 2000);
    });
  });

  it('should accept dashboard registration without auth token', async () => {
    const { ws, initialMessages } = await registerClient(TEST_PORT, {
      clientType: 'dashboard',
    });
    const stateMsg = initialMessages.find((m: any) => m.type === 'STATE_CHANGE');
    expect(stateMsg).toBeDefined();
    ws.close();
  });

  it('should handle invalid JSON gracefully', async () => {
    const ws = await connectWs(TEST_PORT);
    ws.send('not valid json{{{');
    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('ERROR');
    expect(resp?.payload?.message).toBe('Invalid JSON');
    ws.close();
  });

  it('should ACK valid ACTION_EVENT from interceptor', async () => {
    const { ws } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });

    const eventId = randomUUID();
    sendJson(ws, {
      type: 'ACTION_EVENT',
      payload: {
        id: eventId,
        sequenceNumber: 1,
        projectId: TEST_PROJECT_ID,
        action: 'FILE_CREATE',
        file: '/tmp/test/index.ts',
        risk: 'NONE',
        snapshotId: TEST_SNAPSHOT_ID,
        timestamp: Date.now(),
        hash: 'a'.repeat(64),
      },
      timestamp: Date.now(),
    });

    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('ACK');
    expect(resp?.payload?.eventId).toBe(eventId);
    ws.close();
  });

  it('should ACK duplicate events with duplicate flag', async () => {
    const { ws } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });

    const eventId = randomUUID();
    const event = {
      type: 'ACTION_EVENT',
      payload: {
        id: eventId,
        sequenceNumber: 2,
        projectId: TEST_PROJECT_ID,
        action: 'FILE_CREATE',
        file: '/tmp/test/file.ts',
        risk: 'NONE',
        snapshotId: TEST_SNAPSHOT_ID,
        timestamp: Date.now(),
        hash: 'b'.repeat(64),
      },
      timestamp: Date.now(),
    };

    // First send
    sendJson(ws, event);
    await waitMessage(ws); // ACK

    // Second send (duplicate)
    sendJson(ws, event);
    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('ACK');
    expect(resp?.payload?.duplicate).toBe(true);

    ws.close();
  });

  it('should reject ACTION_EVENT from dashboard client', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'ACTION_EVENT',
      payload: {
        id: randomUUID(),
        sequenceNumber: 3,
        projectId: TEST_PROJECT_ID,
        action: 'FILE_CREATE',
        file: '/tmp/test/file.ts',
        risk: 'NONE',
        snapshotId: TEST_SNAPSHOT_ID,
        timestamp: Date.now(),
        hash: 'c'.repeat(64),
      },
      timestamp: Date.now(),
    });

    // Should not get ACK
    const resp = await waitMessage(ws, 500);
    // Either null (no response) or not an ACK
    if (resp) {
      expect(resp.type).not.toBe('ACK');
    }
    ws.close();
  });

  it('should handle INTERCEPTOR_HEARTBEAT with ACK', async () => {
    const { ws } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });

    sendJson(ws, {
      type: 'INTERCEPTOR_HEARTBEAT',
      payload: {},
      timestamp: Date.now(),
    });

    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('ACK');
    expect(resp?.payload?.heartbeat).toBe(true);
    ws.close();
  });

  it('should broadcast events to dashboard clients', async () => {
    const { ws: dashWs } = await registerClient(TEST_PORT, { clientType: 'dashboard' });
    const { ws: intWs } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });

    // Set up listener on dashboard before sending event
    const dashPromise = waitMessage(dashWs, 2000);

    sendJson(intWs, {
      type: 'ACTION_EVENT',
      payload: {
        id: randomUUID(),
        sequenceNumber: 4,
        projectId: TEST_PROJECT_ID,
        action: 'FILE_MODIFY',
        file: '/tmp/test/broadcast.ts',
        risk: 'NONE',
        snapshotId: TEST_SNAPSHOT_ID,
        timestamp: Date.now(),
        hash: 'd'.repeat(64),
      },
      timestamp: Date.now(),
    });

    const broadcast = await dashPromise;
    expect(broadcast).not.toBeNull();
    expect(broadcast?.type).toBe('EVENT_BROADCAST');

    dashWs.close();
    intWs.close();
  });

  it('should handle COMMAND_STOP from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'COMMAND_STOP',
      payload: { reason: 'operator' },
      timestamp: Date.now(),
    });

    // Shouldn't crash
    await new Promise((resolve) => setTimeout(resolve, 200));
    ws.close();
  });

  it('should handle COMMAND_CONTINUE from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'COMMAND_CONTINUE',
      payload: {},
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    ws.close();
  });

  it('should handle COMMAND_RESET from dashboard', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, {
      type: 'COMMAND_RESET',
      payload: {},
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    ws.close();
  });

  it('should reject COMMAND_STOP from interceptor', async () => {
    const { ws } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });

    sendJson(ws, {
      type: 'COMMAND_STOP',
      payload: { reason: 'hacker' },
      timestamp: Date.now(),
    });

    // Should be silently ignored
    const resp = await waitMessage(ws, 500);
    expect(resp).toBeNull();
    ws.close();
  });

  it('should handle SNAPSHOT_CREATED from interceptor', async () => {
    const { ws } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });

    sendJson(ws, {
      type: 'SNAPSHOT_CREATED',
      payload: {
        id: randomUUID(),
        projectId: TEST_PROJECT_ID,
        parentId: null,
        gitCommitHash: 'a'.repeat(40),
        label: 'test snapshot',
        fileCount: 1,
        totalSize: 100,
        isCritical: false,
        createdAt: Date.now(),
      },
      timestamp: Date.now(),
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    ws.close();
  });

  it('should handle invalid message format after registration', async () => {
    const { ws } = await registerClient(TEST_PORT, { clientType: 'dashboard' });

    sendJson(ws, { notAValidMessage: true });
    const resp = await waitMessage(ws);
    expect(resp?.type).toBe('ERROR');
    expect(resp?.payload?.message).toContain('Invalid message format');
    ws.close();
  });

  it('should handle sequence tracking for ACTION_EVENT', async () => {
    const { ws } = await registerClient(TEST_PORT, {
      clientType: 'interceptor',
      authToken: 'test-secret',
    });

    // Send event with sequence 1
    sendJson(ws, {
      type: 'ACTION_EVENT',
      payload: {
        id: randomUUID(),
        sequenceNumber: 1,
        projectId: TEST_PROJECT_ID,
        action: 'FILE_CREATE',
        file: '/tmp/test/seq1.ts',
        risk: 'NONE',
        snapshotId: TEST_SNAPSHOT_ID,
        timestamp: Date.now(),
        hash: 'e'.repeat(64),
      },
      timestamp: Date.now(),
    });
    const resp1 = await waitMessage(ws);
    expect(resp1?.type).toBe('ACK');

    // Send event with sequence 2
    sendJson(ws, {
      type: 'ACTION_EVENT',
      payload: {
        id: randomUUID(),
        sequenceNumber: 2,
        projectId: TEST_PROJECT_ID,
        action: 'FILE_MODIFY',
        file: '/tmp/test/seq2.ts',
        risk: 'NONE',
        snapshotId: TEST_SNAPSHOT_ID,
        timestamp: Date.now(),
        hash: 'f'.repeat(64),
      },
      timestamp: Date.now(),
    });
    const resp2 = await waitMessage(ws);
    expect(resp2?.type).toBe('ACK');

    ws.close();
  });
});
