import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestAppNoAuth as buildTestApp, cleanup } from './helpers.js';

describe('Health API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('GET /api/health', () => {
    it('returns 200 with correct shape', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/health' });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body).toHaveProperty('status', 'healthy');
      expect(body).toHaveProperty('service', 'voltron');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('timestamp');
      expect(typeof body.uptime).toBe('number');
      expect(typeof body.timestamp).toBe('number');
    });
  });

  describe('GET /api/ready', () => {
    it('returns 200 with checks object', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/ready' });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body).toHaveProperty('status', 'ready');
      expect(body).toHaveProperty('checks');
      expect(body).toHaveProperty('version', '0.1.0');
      expect(body).toHaveProperty('uptime');
      expect(typeof body.uptime).toBe('number');

      // DB check present
      expect(body.checks).toHaveProperty('database');
      expect(body.checks.database.status).toBe('ok');
      expect(typeof body.checks.database.responseMs).toBe('number');

      // WS check present (no broadcaster injected, so connections=0)
      expect(body.checks).toHaveProperty('websocket');
      expect(body.checks.websocket.status).toBe('ok');

      // Agent check present
      expect(body.checks).toHaveProperty('agents');
      expect(body.checks.agents.status).toBe('ok');
    });
  });
});
