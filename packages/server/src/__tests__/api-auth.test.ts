import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanup, getTestToken, TEST_ADMIN_USER, TEST_ADMIN_PASS, TEST_AUTH_SECRET } from './helpers.js';
import { createToken } from '../plugins/auth.js';

describe('Auth API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('POST /api/auth/login', () => {
    it('returns token on valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: TEST_ADMIN_USER, password: TEST_ADMIN_PASS },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('expiresAt');
      expect(typeof body.token).toBe('string');
      expect(typeof body.expiresAt).toBe('number');
      expect(body.expiresAt).toBeGreaterThan(Date.now());
    });

    it('returns 401 on wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: TEST_ADMIN_USER, password: 'wrong-password' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid credentials');
    });

    it('returns 401 on wrong username', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'nobody', password: TEST_ADMIN_PASS },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 on missing fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: TEST_ADMIN_USER },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 on empty body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Protected routes', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects',
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Authentication required');
    });

    it('returns 401 when token is invalid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: 'Bearer invalid-token' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid or expired token');
    });

    it('returns 200 with valid token', async () => {
      const token = await getTestToken(app);

      const res = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });

    it('allows creating a project with valid token', async () => {
      const token = await getTestToken(app);

      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Auth Test Project', rootPath: '/tmp/auth-test' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().name).toBe('Auth Test Project');
    });
  });

  describe('Public routes', () => {
    it('GET /api/health does not require auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(res.statusCode).toBe(200);
    });

    it('GET /api/ready does not require auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/ready',
      });

      expect(res.statusCode).toBe(200);
    });

    it('POST /api/auth/login does not require auth', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'test', password: 'test' },
      });

      // Should get 401 (invalid creds) not auth required
      expect(res.statusCode).toBe(401);
      expect(res.json().error).toBe('Invalid credentials');
    });
  });

  describe('Token expiry', () => {
    it('rejects an expired token', async () => {
      // Manually create a token with a past timestamp
      const payload = Buffer.from(JSON.stringify({
        username: TEST_ADMIN_USER,
        iat: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      })).toString('base64url');

      const { createHmac } = await import('node:crypto');
      const signature = createHmac('sha256', TEST_AUTH_SECRET).update(payload).digest('base64url');
      const expiredToken = `${payload}.${signature}`;

      const res = await app.inject({
        method: 'GET',
        url: '/api/projects',
        headers: { authorization: `Bearer ${expiredToken}` },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
