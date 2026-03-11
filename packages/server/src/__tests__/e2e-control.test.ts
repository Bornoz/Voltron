import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject, type E2EContext } from './e2e-helpers.js';

describe('E2E: Control API (State Machine)', () => {
  let ctx: E2EContext;
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    ctx = await buildFullTestApp();
    token = await getToken(ctx.app);
    projectId = await createTestProject(ctx.app, token);
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  describe('GET /api/projects/:id/control/state', () => {
    it('returns current execution state', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/control/state`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('state');
    });
  });

  describe('POST /api/projects/:id/control/stop', () => {
    it('sends STOP command and returns updated state', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/control/stop`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('state');
    });
  });

  describe('POST /api/projects/:id/control/continue', () => {
    it('sends CONTINUE command', async () => {
      // First stop
      await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/control/stop`,
      });
      // Then continue
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/control/continue`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/projects/:id/control/reset', () => {
    it('resets circuit breaker and state machine', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/control/reset`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('state');
    });
  });

  describe('GET /api/projects/:id/control/history', () => {
    it('returns state transition history', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/control/history`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('returns history array after state transitions', async () => {
      // Trigger some transitions
      await authInject(ctx.app, token, { method: 'POST', url: `/api/projects/${projectId}/control/stop` });
      await authInject(ctx.app, token, { method: 'POST', url: `/api/projects/${projectId}/control/reset` });

      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/control/history`,
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });
});
