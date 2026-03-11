import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject, type E2EContext } from './e2e-helpers.js';

describe('E2E: Stats, Sessions & Interceptor Status', () => {
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

  describe('GET /api/stats', () => {
    it('returns server stats with WS info and uptime', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/stats',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('ws');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
      expect(typeof body.uptime).toBe('number');
      expect(body.ws).toHaveProperty('total');
    });
  });

  describe('GET /api/sessions', () => {
    it('returns active sessions list', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/sessions',
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe('GET /api/projects/:id/interceptor/status', () => {
    it('returns interceptor connection status for a project', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/interceptor/status`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('interceptorConnected');
      expect(body).toHaveProperty('dashboardConnected');
      expect(body).toHaveProperty('simulatorConnected');
      expect(body).toHaveProperty('totalConnections');
      expect(body).toHaveProperty('executionState');
      expect(body).toHaveProperty('currentRate');
      expect(body).toHaveProperty('timestamp');
      // Initially no connections
      expect(body.interceptorConnected).toBe(false);
      expect(body.dashboardConnected).toBe(false);
      expect(body.totalConnections).toBe(0);
    });
  });
});
