import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestAppNoAuth as buildTestApp, cleanup } from './helpers.js';

describe('Projects API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('CRUD lifecycle', () => {
    let projectId: string;

    it('POST /api/projects — creates a project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Test Project', rootPath: '/tmp/test-proj' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Test Project');
      expect(body.rootPath).toBe('/tmp/test-proj');
      expect(body.isActive).toBe(true);
      projectId = body.id;
    });

    it('GET /api/projects/:id — returns the created project', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(projectId);
      expect(body.name).toBe('Test Project');
    });

    it('PUT /api/projects/:id — updates the project', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}`,
        payload: { name: 'Updated Project' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.name).toBe('Updated Project');
      expect(body.id).toBe(projectId);
    });

    it('GET /api/projects — lists projects', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      const found = body.find((p: { id: string }) => p.id === projectId);
      expect(found).toBeDefined();
      expect(found.name).toBe('Updated Project');
    });

    it('DELETE /api/projects/:id — deactivates the project', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      // Verify deactivated
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}`,
      });
      expect(getRes.json().isActive).toBe(false);
    });
  });

  describe('Validation', () => {
    it('POST /api/projects — missing name returns 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { rootPath: '/tmp/no-name' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('POST /api/projects — missing rootPath returns 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'No Root' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('GET /api/projects/:id — unknown id returns 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/00000000-0000-0000-0000-000000000000',
      });

      expect(res.statusCode).toBe(404);
    });

    it('PUT /api/projects/:id — unknown id returns 404', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/projects/00000000-0000-0000-0000-000000000000',
        payload: { name: 'Ghost' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('DELETE /api/projects/:id — unknown id returns 404', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/projects/00000000-0000-0000-0000-000000000000',
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('Multiple projects', () => {
    it('creates and lists multiple projects', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Proj A', rootPath: '/tmp/proj-a' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { name: 'Proj B', rootPath: '/tmp/proj-b' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/projects',
      });

      const body = res.json();
      const names = body.map((p: { name: string }) => p.name);
      expect(names).toContain('Proj A');
      expect(names).toContain('Proj B');
    });
  });
});
