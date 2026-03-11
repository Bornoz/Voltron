import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, E2E_ADMIN_USER, E2E_ADMIN_PASS, type E2EContext } from './e2e-helpers.js';

describe('E2E: Full Auth Flow', () => {
  let ctx: E2EContext;

  beforeAll(async () => {
    ctx = await buildFullTestApp();
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  describe('Login → Protected Resource → Whoami', () => {
    it('full auth lifecycle', async () => {
      // Step 1: Login
      const loginRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: E2E_ADMIN_USER, password: E2E_ADMIN_PASS },
      });
      expect(loginRes.statusCode).toBe(200);
      const { token, expiresAt } = loginRes.json() as { token: string; expiresAt: number };
      expect(typeof token).toBe('string');
      expect(expiresAt).toBeGreaterThan(Date.now());

      // Step 2: Access protected resource
      const projRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/projects',
      });
      expect(projRes.statusCode).toBe(200);

      // Step 3: Whoami
      const whoamiRes = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/auth/whoami',
      });
      expect(whoamiRes.statusCode).toBe(200);
      expect(whoamiRes.json().authenticated).toBe(true);
    });
  });

  describe('Authentication enforcement', () => {
    const protectedEndpoints = [
      { method: 'GET' as const, url: '/api/projects' },
      { method: 'POST' as const, url: '/api/projects' },
      { method: 'GET' as const, url: '/api/ai-tools' },
    ];

    for (const ep of protectedEndpoints) {
      it(`${ep.method} ${ep.url} requires auth`, async () => {
        const res = await ctx.app.inject({
          method: ep.method,
          url: ep.url,
        });
        expect(res.statusCode).toBe(401);
      });
    }
  });

  describe('Public endpoints', () => {
    it('GET /api/health does not require auth', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);
    });

    it('GET /api/ready does not require auth', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/ready' });
      expect(res.statusCode).toBe(200);
    });

    it('GET /api/auth/setup-required does not require auth', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/setup-required' });
      expect(res.statusCode).toBe(200);
    });

    it('POST /api/auth/login does not require auth', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'x', password: 'x' },
      });
      // Returns 401 for bad credentials, but NOT 401 "Authentication required"
      // The key difference: login failure says "Invalid credentials", not "Authentication required"
      expect(res.json().error).not.toBe('Authentication required');
    });
  });

  describe('Password change', () => {
    it('changes password and login with new password', async () => {
      const token = await getToken(ctx.app);

      // Change password
      const changeRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/auth/change-password',
        payload: { currentPassword: E2E_ADMIN_PASS, newPassword: 'new-super-pass' },
      });
      expect(changeRes.statusCode).toBe(200);

      // Login with new password
      const loginRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: E2E_ADMIN_USER, password: 'new-super-pass' },
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.json()).toHaveProperty('token');

      // Old password should fail
      const oldRes = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: E2E_ADMIN_USER, password: E2E_ADMIN_PASS },
      });
      expect(oldRes.statusCode).toBe(401);
    });
  });
});
