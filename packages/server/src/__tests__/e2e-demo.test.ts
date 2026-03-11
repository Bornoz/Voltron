import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, type E2EContext } from './e2e-helpers.js';

describe('E2E: Demo Mode API', () => {
  let ctx: E2EContext;
  let token: string;

  beforeAll(async () => {
    ctx = await buildFullTestApp();
    token = await getToken(ctx.app);
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  describe('Demo lifecycle', () => {
    it('GET /api/demo/status — initially not running', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/demo/status',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.running).toBe(false);
      expect(body.phase).toBe('idle');
      expect(body.sessionId).toBeNull();
    });

    it('POST /api/demo/start — starts demo', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/demo/start',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.running).toBe(true);
      expect(body).toHaveProperty('sessionId');
      expect(body.status).toBe('running');
    });

    it('GET /api/demo/status — shows running', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/demo/status',
      });
      expect(res.json().running).toBe(true);
    });

    it('POST /api/demo/start — returns 409 when already running', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/demo/start',
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('already running');
    });

    it('POST /api/demo/stop — stops demo', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/demo/stop',
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('stopped');
    });

    it('POST /api/demo/stop — returns 404 when not running', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/demo/stop',
      });
      expect(res.statusCode).toBe(404);
    });

    it('status shows idle after stop', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/demo/status',
      });
      expect(res.json().running).toBe(false);
    });
  });
});
