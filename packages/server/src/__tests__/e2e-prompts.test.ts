import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject, type E2EContext } from './e2e-helpers.js';

describe('E2E: Prompt Versioning API', () => {
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

  describe('Full prompt lifecycle', () => {
    let versionId1: string;
    let versionId2: string;

    it('POST /api/projects/:id/prompts — creates a prompt version', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts`,
        payload: { name: 'v1-initial', content: 'You are a helpful coding assistant.' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('v1-initial');
      expect(body.content).toBe('You are a helpful coding assistant.');
      versionId1 = body.id;
    });

    it('creates a second version', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts`,
        payload: { name: 'v2-strict', content: 'You are a strict code reviewer. Never approve insecure code.' },
      });
      expect(res.statusCode).toBe(201);
      versionId2 = res.json().id;
    });

    it('GET /api/projects/:id/prompts — lists all versions', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(2);
    });

    it('GET /api/projects/:id/prompts/:vid — returns specific version', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts/${versionId1}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe('v1-initial');
    });

    it('returns 404 for non-existent version', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts/non-existent-id`,
      });
      expect(res.statusCode).toBe(404);
    });

    it('POST /api/projects/:id/prompts/:vid/activate — activates a version', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts/${versionId2}/activate`,
      });
      expect(res.statusCode).toBe(200);
    });

    it('GET /api/projects/:id/prompts/active — returns the activated version', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts/active`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(versionId2);
    });

    it('GET /api/projects/:id/prompts/diff — compares two versions', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts/diff?from=${versionId1}&to=${versionId2}`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('from');
      expect(body).toHaveProperty('to');
    });

    it('returns 400 when diff params are missing', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/prompts/diff`,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Validation', () => {
    it('rejects empty name', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts`,
        payload: { name: '', content: 'some content' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects empty content', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/prompts`,
        payload: { name: 'valid-name', content: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
