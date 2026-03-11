/**
 * E2E Full Workflow Tests
 *
 * Tests complete user scenarios end-to-end:
 * Login → Create Project → Configure → Spawn Agent → Monitor → Control → Export
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import {
  buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject,
  registerAuthWsClient, registerWsClient, waitMessage, sendJson,
  type E2EContext, E2E_ADMIN_USER, E2E_ADMIN_PASS,
} from './e2e-helpers.js';
import { ActionRepository } from '../db/repositories/actions.js';
import { SnapshotRepository } from '../db/repositories/snapshots.js';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
function sha1hex(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

const WF_PORT = 18720;

describe('E2E: Full User Workflows', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await buildFullTestApp({ listen: true, port: WF_PORT });
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  describe('Workflow 1: Project setup → Agent spawn → Monitor → Kill', () => {
    it('complete agent lifecycle', async () => {
      // 1. Login
      const loginRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: E2E_ADMIN_USER, password: E2E_ADMIN_PASS },
      });
      const token = loginRes.json().token;
      expect(typeof token).toBe('string');

      // 2. Create project
      const projRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'My AI Project', rootPath: '/tmp/my-proj' },
      });
      expect(projRes.statusCode).toBe(201);
      const projectId = projRes.json().id;

      // 3. Set project rules
      const rulesRes = await authInject(ctx.app, token, {
        method: 'PUT',
        url: `/api/projects/${projectId}/rules`,
        payload: { content: 'Use TypeScript strict mode.\nAll functions must have JSDoc.' },
      });
      expect(rulesRes.statusCode).toBe(200);

      // 4. Add project memory
      const memRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory`,
        payload: { category: 'architecture', title: 'Stack', content: 'React 19 + Fastify' },
      });
      expect(memRes.statusCode).toBe(201);

      // 5. Create a protection zone
      const zoneRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/zones`,
        payload: {
          path: '/config/**',
          level: 'DO_NOT_TOUCH',
          reason: 'Configuration files are protected',
          allowedOperations: ['FILE_CREATE'],
        },
      });
      expect(zoneRes.statusCode).toBe(201);

      // 6. Create prompt version
      const promptRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts`,
        payload: { name: 'v1', content: 'You are a helpful coding assistant.' },
      });
      expect(promptRes.statusCode).toBe(201);

      // 7. Connect dashboard WS
      const { ws: dashWs } = await registerWsClient(WF_PORT, projectId, 'dashboard', token);

      // 8. Spawn agent via REST
      const spawnRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/spawn`,
        payload: {
          model: 'claude-sonnet-4-6',
          prompt: 'Build a login page with form validation',
          targetDir: '/tmp/my-proj',
        },
      });
      expect(spawnRes.statusCode).toBe(200);
      expect(spawnRes.json()).toHaveProperty('sessionId');

      // 9. Simulate agent activity via EventBus
      ctx.eventBus.emit('AGENT_STATUS_CHANGE', {
        projectId, status: 'RUNNING', sessionId: 'sess-wf1',
      });
      const statusMsg = await waitMessage(dashWs, 2000);
      expect(statusMsg?.type).toBe('AGENT_STATUS_CHANGE');

      // 10. Inject prompt while agent runs
      const injectRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/inject`,
        payload: { prompt: 'Also add email validation', urgency: 'normal' },
      });
      expect(injectRes.statusCode).toBe(200);

      // 11. Kill agent
      const killRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/kill`,
      });
      expect(killRes.statusCode).toBe(200);

      // 12. Check control history has entries
      const histRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/control/history`,
      });
      expect(histRes.statusCode).toBe(200);

      // 13. Check behavior score
      const behavRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/behavior/latest`,
      });
      expect(behavRes.statusCode).toBe(200);

      dashWs.close();
    });
  });

  describe('Workflow 2: Multi-project isolation', () => {
    it('events from project A do not leak to project B', async () => {
      const token = await getToken(ctx.app);
      const projA = await createTestProject(ctx.app, token, 'Project A', '/tmp/proj-a');
      const projB = await createTestProject(ctx.app, token, 'Project B', '/tmp/proj-b');

      const { ws: dashA } = await registerWsClient(WF_PORT, projA, 'dashboard', token);
      const { ws: dashB } = await registerWsClient(WF_PORT, projB, 'dashboard', token);

      // Emit event for project A
      const bPromise = waitMessage(dashB, 500);
      const aPromise = waitMessage(dashA, 2000);

      ctx.eventBus.emit('AGENT_STATUS_CHANGE', {
        projectId: projA,
        status: 'RUNNING',
        sessionId: 'sess-a',
      });

      const msgA = await aPromise;
      const msgB = await bPromise;

      expect(msgA?.type).toBe('AGENT_STATUS_CHANGE');
      expect(msgB).toBeNull(); // Project B should NOT receive project A's event

      dashA.close();
      dashB.close();
    });
  });

  describe('Workflow 3: Action event ingestion → Stats → Timeline', () => {
    it('interceptor events appear in stats and timeline', async () => {
      const token = await getToken(ctx.app);
      const projectId = await createTestProject(ctx.app, token, 'Stats Project', '/tmp/stats');

      // Create snapshot first
      const snapshotRepo = new SnapshotRepository();
      const snapshotId = randomUUID();
      snapshotRepo.insert({
        id: snapshotId, projectId, gitCommitHash: sha1hex('stats-snap'),
        parentId: null, fileCount: 5, totalSize: 1000, isCritical: false, createdAt: Date.now(),
      });

      const actionRepo = new ActionRepository();
      // Seed action events
      for (let i = 0; i < 20; i++) {
        actionRepo.insert({
          id: randomUUID(),
          projectId,
          sequenceNumber: i + 1,
          snapshotId,
          action: i % 2 === 0 ? 'FILE_MODIFY' : 'FILE_CREATE',
          file: `/src/file-${i % 5}.ts`,
          risk: i < 10 ? 'LOW' : 'MEDIUM',
          hash: sha256(`hash-${i}`),
          timestamp: Date.now() - i * 60_000,
        });
      }

      // Check stats
      const statsRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/stats`,
      });
      expect(statsRes.statusCode).toBe(200);
      const stats = statsRes.json();
      expect(stats.totalActions).toBe(20);

      // Check timeline
      const tlRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/timeline?granularity=hourly`,
      });
      expect(tlRes.statusCode).toBe(200);

      // Check file-specific query
      const fileRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/file?path=/src/file-0.ts`,
      });
      expect(fileRes.statusCode).toBe(200);
      expect(fileRes.json().length).toBeGreaterThan(0);
    });
  });

  describe('Workflow 4: Protection zones enforcement', () => {
    it('zone CRUD and pattern testing', async () => {
      const token = await getToken(ctx.app);
      const projectId = await createTestProject(ctx.app, token, 'Zone Project', '/tmp/zone');

      // Create zones
      const z1 = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/zones`,
        payload: { path: '/secrets/**', level: 'DO_NOT_TOUCH', reason: 'Secrets folder' },
      });
      expect(z1.statusCode).toBe(201);
      const zoneId = z1.json().id;

      const z2 = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/zones`,
        payload: { path: '/src/**/*.test.ts', level: 'SURGICAL_ONLY', reason: 'Test files', allowedOperations: ['FILE_MODIFY', 'FILE_CREATE'] },
      });
      expect(z2.statusCode).toBe(201);

      // List zones
      const listRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/zones`,
      });
      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().length).toBeGreaterThanOrEqual(2);

      // Test pattern
      const testRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/zones/test`,
        payload: { pattern: '/secrets/**', testPaths: ['/secrets/api-key.env', '/src/app.ts'] },
      });
      expect(testRes.statusCode).toBe(200);

      // Delete zone
      const delRes = await authInject(ctx.app, token, {
        method: 'DELETE',
        url: `/api/projects/${projectId}/zones/${zoneId}`,
      });
      expect(delRes.statusCode).toBe(200);
    });
  });

  describe('Workflow 5: Demo mode lifecycle', () => {
    it('start → status → stop', async () => {
      const token = await getToken(ctx.app);

      // Start
      const startRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/demo/start',
      });
      expect(startRes.statusCode).toBe(200);
      expect(startRes.json().running).toBe(true);

      // Status
      const statusRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/demo/status',
      });
      expect(statusRes.json().running).toBe(true);

      // Stop
      const stopRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/demo/stop',
      });
      expect(stopRes.statusCode).toBe(200);

      // Verify stopped
      const finalRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/demo/status',
      });
      expect(finalRes.json().running).toBe(false);
    });
  });

  describe('Workflow 6: Prompt versioning lifecycle', () => {
    it('create → activate → diff → list', async () => {
      const token = await getToken(ctx.app);
      const projectId = await createTestProject(ctx.app, token, 'Prompt Project', '/tmp/prompt');

      // Create v1
      const v1 = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts`,
        payload: { name: 'v1-basic', content: 'Be helpful.' },
      });
      const v1Id = v1.json().id;

      // Create v2
      const v2 = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts`,
        payload: { name: 'v2-strict', content: 'Be helpful. Never write insecure code.' },
      });
      const v2Id = v2.json().id;

      // Activate v2
      const actRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts/${v2Id}/activate`,
      });
      expect(actRes.statusCode).toBe(200);

      // Verify active
      const activeRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts/active`,
      });
      expect(activeRes.json().id).toBe(v2Id);

      // Diff
      const diffRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts/diff?from=${v1Id}&to=${v2Id}`,
      });
      expect(diffRes.statusCode).toBe(200);
      expect(diffRes.json()).toHaveProperty('from');
      expect(diffRes.json()).toHaveProperty('to');

      // List
      const listRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts`,
      });
      expect(listRes.json().length).toBe(2);
    });
  });

  describe('Workflow 7: Health & Readiness probes', () => {
    it('health and ready endpoints work', async () => {
      // Health — no auth needed
      const healthRes = await ctx.app.inject({ method: 'GET', url: '/api/health' });
      expect(healthRes.statusCode).toBe(200);
      expect(healthRes.json().status).toBe('healthy');

      // Ready — no auth needed
      const readyRes = await ctx.app.inject({ method: 'GET', url: '/api/ready' });
      expect(readyRes.statusCode).toBe(200);
      const ready = readyRes.json();
      expect(ready).toHaveProperty('status');
      expect(ready).toHaveProperty('checks');
      expect(ready.checks).toHaveProperty('database');
      expect(ready.checks).toHaveProperty('websocket');
    });
  });

  describe('Workflow 8: AI tool detection flow', () => {
    it('scan → get cached → rescan', async () => {
      const token = await getToken(ctx.app);

      // First scan (triggers detection)
      const scanRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/ai-tools',
      });
      expect(scanRes.statusCode).toBe(200);
      const firstScan = scanRes.json();
      expect(firstScan.tools.length).toBeGreaterThan(0);

      // Second call returns cached
      const cachedRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/ai-tools',
      });
      expect(cachedRes.json().scannedAt).toBe(firstScan.scannedAt);

      // Rescan
      const rescanRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/ai-tools/rescan',
      });
      expect(rescanRes.statusCode).toBe(200);
      expect(rescanRes.json().scannedAt).toBeGreaterThanOrEqual(firstScan.scannedAt);
    });
  });
});
