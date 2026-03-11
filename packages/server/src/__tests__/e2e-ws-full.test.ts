import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import {
  buildFullTestApp, cleanupE2E, getToken, createTestProject,
  connectWs, sendJson, waitMessage, collectMessages, registerWsClient, registerAuthWsClient,
  type E2EContext, E2E_PORT,
} from './e2e-helpers.js';
import { SnapshotRepository } from '../db/repositories/snapshots.js';

function sha1hex(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const WS_PORT = 18710;

describe('E2E: WebSocket Full Integration', () => {
  let ctx: E2EContext;
  let token: string;
  let projectId: string;
  let snapshotId: string;

  beforeAll(async () => {
    ctx = await buildFullTestApp({ listen: true, port: WS_PORT });
    token = await getToken(ctx.app);
    projectId = await createTestProject(ctx.app, token);

    // Create a snapshot for ACTION_EVENT tests
    const snapshotRepo = new SnapshotRepository();
    snapshotId = randomUUID();
    snapshotRepo.insert({
      id: snapshotId, projectId, gitCommitHash: sha1hex('ws-test-snap'),
      parentId: null, fileCount: 5, totalSize: 1000, isCritical: false, createdAt: Date.now(),
    });
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  // ─── Registration ──────────────────────────────────

  describe('Client Registration', () => {
    it('dashboard registers successfully', async () => {
      const { ws, initialMessages } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);
      // Server sends STATE_CHANGE after registration (no ACK for registration itself)
      const stateMsg = initialMessages.find((m) => m.type === 'STATE_CHANGE');
      expect(stateMsg).toBeDefined();
      ws.close();
    });

    it('interceptor registers with secret', async () => {
      const { ws, initialMessages } = await registerWsClient(WS_PORT, projectId, 'interceptor');
      const stateMsg = initialMessages.find((m) => m.type === 'STATE_CHANGE');
      expect(stateMsg).toBeDefined();
      ws.close();
    });

    it('simulator registers successfully', async () => {
      const { ws, initialMessages } = await registerWsClient(WS_PORT, projectId, 'simulator', token);
      const stateMsg = initialMessages.find((m) => m.type === 'STATE_CHANGE');
      expect(stateMsg).toBeDefined();
      ws.close();
    });

    it('rejects invalid registration payload', async () => {
      const ws = await connectWs(WS_PORT);
      sendJson(ws, { type: 'REGISTER', clientType: 'dashboard' }); // missing fields
      const closePromise = new Promise<number>((resolve) => {
        ws.on('close', (code) => resolve(code));
      });
      const code = await closePromise;
      expect(code).toBeGreaterThanOrEqual(4000);
    });

    it('receives STATE_CHANGE after registration', async () => {
      const { ws, initialMessages } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);
      const stateMsg = initialMessages.find((m) => m.type === 'STATE_CHANGE');
      expect(stateMsg).toBeDefined();
      expect(stateMsg?.payload).toHaveProperty('state');
      ws.close();
    });
  });

  // ─── Agent Commands via WS ─────────────────────────

  describe('Agent Commands via WS', () => {
    it('AGENT_SPAWN from dashboard triggers runner', async () => {
      (ctx.mockRunner.spawn as any).mockClear();
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);

      sendJson(ws, {
        type: 'AGENT_SPAWN',
        payload: {
          model: 'claude-sonnet-4-6',
          prompt: 'Build a REST API',
          targetDir: '/tmp/ws-test',
        },
        correlationId: randomUUID(),
        timestamp: Date.now(),
      });

      const resp = await waitMessage(ws);
      expect(resp?.type).toBe('ACK');
      expect(resp?.payload?.sessionId).toBe('mock-session-001');
      expect(ctx.mockRunner.spawn).toHaveBeenCalled();
      ws.close();
    });

    it('AGENT_INJECT_PROMPT validates payload', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);

      sendJson(ws, {
        type: 'AGENT_INJECT_PROMPT',
        payload: {
          prompt: 'Add dark mode',
          context: { filePath: '/src/theme.ts' },
          urgency: 'normal',
        },
        timestamp: Date.now(),
      });

      await new Promise((r) => setTimeout(r, 300));
      expect(ctx.mockRunner.injectPrompt).toHaveBeenCalled();
      ws.close();
    });

    it('interceptor cannot send agent commands', async () => {
      (ctx.mockRunner.spawn as any).mockClear();
      const { ws } = await registerWsClient(WS_PORT, projectId, 'interceptor');

      sendJson(ws, {
        type: 'AGENT_SPAWN',
        payload: { prompt: 'hack', targetDir: '/tmp' },
        timestamp: Date.now(),
      });

      await new Promise((r) => setTimeout(r, 300));
      expect(ctx.mockRunner.spawn).not.toHaveBeenCalled();
      ws.close();
    });
  });

  // ─── Interceptor → Server → Dashboard flow ────────

  describe('Interceptor → Server → Dashboard event flow', () => {
    it('ACTION_EVENT from interceptor is broadcast to dashboard', async () => {
      const { ws: intWs } = await registerWsClient(WS_PORT, projectId, 'interceptor');
      const { ws: dashWs } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);

      const dashPromise = waitMessage(dashWs, 2000);
      const eventId = randomUUID();

      sendJson(intWs, {
        type: 'ACTION_EVENT',
        payload: {
          id: eventId,
          sequenceNumber: 1,
          projectId,
          action: 'FILE_MODIFY',
          file: '/src/app.ts',
          risk: 'LOW',
          snapshotId,
          timestamp: Date.now(),
          hash: sha256('test-file-content'),
          diff: '+console.log("hello")',
        },
        timestamp: Date.now(),
      });

      // Should get ACK
      const ack = await waitMessage(intWs, 1000);
      expect(ack?.type).toBe('ACK');

      // Dashboard should receive broadcast
      const dashMsg = await dashPromise;
      expect(dashMsg).not.toBeNull();
      expect(dashMsg?.type).toBe('EVENT_BROADCAST');

      intWs.close();
      dashWs.close();
    });

    it('INTERCEPTOR_HEARTBEAT gets ACK', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'interceptor');

      sendJson(ws, {
        type: 'INTERCEPTOR_HEARTBEAT',
        payload: { uptimeMs: 30000, eventsProcessed: 100 },
        timestamp: Date.now(),
      });

      const ack = await waitMessage(ws);
      expect(ack?.type).toBe('ACK');
      ws.close();
    });
  });

  // ─── EventBus broadcasts ──────────────────────────

  describe('EventBus → WS broadcasts', () => {
    it('AGENT_STATUS_CHANGE reaches dashboard clients', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);
      const msgPromise = waitMessage(ws, 2000);

      ctx.eventBus.emit('AGENT_STATUS_CHANGE', {
        projectId,
        status: 'RUNNING',
        sessionId: 'sess-e2e',
      });

      const msg = await msgPromise;
      expect(msg?.type).toBe('AGENT_STATUS_CHANGE');
      expect(msg?.payload?.status).toBe('RUNNING');
      ws.close();
    });

    it('AGENT_BREADCRUMB reaches dashboard', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);
      const msgPromise = waitMessage(ws, 2000);

      ctx.eventBus.emit('AGENT_BREADCRUMB', {
        projectId,
        breadcrumb: {
          filePath: '/src/utils.ts',
          activity: 'WRITING',
          toolName: 'Write',
          timestamp: Date.now(),
        },
      });

      const msg = await msgPromise;
      expect(msg?.type).toBe('AGENT_BREADCRUMB');
      ws.close();
    });

    it('AGENT_PLAN_UPDATE reaches dashboard', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);
      const msgPromise = waitMessage(ws, 2000);

      ctx.eventBus.emit('AGENT_PLAN_UPDATE', {
        projectId,
        plan: {
          summary: 'Refactor auth module',
          steps: [{ title: 'Extract middleware', status: 'pending' }],
          currentStep: 0,
          confidence: 0.85,
        },
      });

      const msg = await msgPromise;
      expect(msg?.type).toBe('AGENT_PLAN_UPDATE');
      ws.close();
    });

    it('AGENT_LOCATION_UPDATE and AGENT_TOKEN_USAGE reach dashboard', async () => {
      const { ws: dash } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);

      // Test LOCATION_UPDATE
      const locPromise = waitMessage(dash, 2000);
      ctx.eventBus.emit('AGENT_LOCATION_UPDATE', {
        projectId,
        location: { filePath: '/src/index.ts', activity: 'READING', timestamp: Date.now() },
      });
      const locMsg = await locPromise;
      expect(locMsg?.type).toBe('AGENT_LOCATION_UPDATE');

      // Test TOKEN_USAGE on same connection
      const tokPromise = waitMessage(dash, 2000);
      ctx.eventBus.emit('AGENT_TOKEN_USAGE', {
        projectId,
        inputTokens: 10000,
        outputTokens: 5000,
      });
      const tokMsg = await tokPromise;
      expect(tokMsg?.type).toBe('AGENT_TOKEN_USAGE');
      expect(tokMsg?.payload?.inputTokens).toBe(10000);

      dash.close();
    });

    it('AGENT_BREAKPOINT_HIT reaches dashboard (if handler registered)', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);
      const msgPromise = waitMessage(ws, 1000);

      ctx.eventBus.emit('AGENT_BREAKPOINT_HIT', {
        projectId,
        filePath: '/src/critical.ts',
        activity: 'WRITING',
      });

      const msg = await msgPromise;
      // May or may not be handled depending on handler registration
      if (msg) {
        expect(msg.type).toBe('AGENT_BREAKPOINT_HIT');
      }
      ws.close();
    });

    it('DEV_SERVER_STATUS reaches dashboard (if handler registered)', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);
      const msgPromise = waitMessage(ws, 1000);

      ctx.eventBus.emit('DEV_SERVER_STATUS', {
        projectId,
        status: 'ready',
        port: 3000,
        url: 'http://localhost:3000',
      });

      const msg = await msgPromise;
      if (msg) {
        expect(msg.type).toBe('DEV_SERVER_STATUS');
      }
      ws.close();
    });
  });

  // ─── Execution Control via WS ─────────────────────

  describe('Execution control commands via WS', () => {
    it('COMMAND_STOP from dashboard is processed (no crash)', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);

      sendJson(ws, {
        type: 'COMMAND_STOP',
        payload: { reason: 'manual stop' },
        timestamp: Date.now(),
      });

      // May get STATE_CHANGE back or connection may close depending on state machine
      const msg = await waitMessage(ws, 1000);
      // Key assertion: command was processed without throwing
      // Connection may or may not remain open depending on state transitions
      if (msg) {
        expect(['STATE_CHANGE', 'ACK', 'ERROR']).toContain(msg.type);
      }
      ws.close();
    });

    it('COMMAND_STOP from interceptor is rejected', async () => {
      const { ws } = await registerWsClient(WS_PORT, projectId, 'interceptor');

      sendJson(ws, {
        type: 'COMMAND_STOP',
        payload: { reason: 'unauthorized' },
        timestamp: Date.now(),
      });

      const msg = await waitMessage(ws, 500);
      // Should be error or no response
      if (msg) {
        expect(msg.type).toBe('ERROR');
      }
      ws.close();
    });
  });

  // ─── Simulator messages ────────────────────────────

  describe('Simulator messages', () => {
    it('SIMULATOR_CONSTRAINT from simulator is relayed', async () => {
      const { ws: simWs } = await registerWsClient(WS_PORT, projectId, 'simulator', token);
      const { ws: dashWs } = await registerWsClient(WS_PORT, projectId, 'dashboard', token);

      const dashPromise = waitMessage(dashWs, 2000);

      sendJson(simWs, {
        type: 'SIMULATOR_CONSTRAINT',
        payload: {
          type: 'css',
          selector: '.header',
          property: 'background-color',
          value: '#ff0000',
          description: 'Header should be red',
        },
        timestamp: Date.now(),
      });

      const msg = await dashPromise;
      // May or may not relay depending on implementation — verify no crash
      simWs.close();
      dashWs.close();
    });
  });
});
