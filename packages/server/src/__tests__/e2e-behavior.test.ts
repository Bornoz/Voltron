import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject, type E2EContext } from './e2e-helpers.js';

describe('E2E: Behavior Scoring API', () => {
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

  describe('GET /api/projects/:id/behavior/latest', () => {
    it('returns default scores when no scoring done yet', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/behavior/latest`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('overallScore');
      expect(body).toHaveProperty('riskScore');
      expect(body).toHaveProperty('velocityScore');
      expect(body).toHaveProperty('complianceScore');
    });
  });

  describe('GET /api/projects/:id/behavior/scores', () => {
    it('returns score history (may be empty)', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/behavior/scores`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('supports limit parameter', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/behavior/scores?limit=5`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/projects/:id/behavior/score', () => {
    it('triggers manual score calculation', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/behavior/score`,
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
