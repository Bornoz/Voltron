import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestAppNoAuth as buildTestApp, cleanup } from './helpers.js';

describe('Snapshots API — Input Validation', () => {
  let app: FastifyInstance;
  let projectId: string;

  beforeAll(async () => {
    app = await buildTestApp();

    // Create a project
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Snapshot Test', rootPath: '/tmp/snap-test' },
    });
    projectId = res.json().id;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('GET /api/projects/:id/snapshots — query validation', () => {
    it('accepts valid limit and offset', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/snapshots?limit=10&offset=0`,
      });

      expect(res.statusCode).toBe(200);
    });

    it('uses defaults when no query params', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/snapshots`,
      });

      expect(res.statusCode).toBe(200);
    });

    it('rejects negative limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/snapshots?limit=-1`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects limit = 0', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/snapshots?limit=0`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects limit > 1000', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/snapshots?limit=1001`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects negative offset', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/snapshots?offset=-5`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects non-numeric limit', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/snapshots?limit=abc`,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/projects/:id/snapshots/prune — query validation', () => {
    it('accepts valid keep value', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/snapshots/prune?keep=50`,
      });

      expect(res.statusCode).toBe(200);
    });

    it('uses default keep when not specified', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/snapshots/prune`,
      });

      expect(res.statusCode).toBe(200);
    });

    it('rejects keep = 0', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/snapshots/prune?keep=0`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects negative keep', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/snapshots/prune?keep=-5`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects keep > 10000', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/snapshots/prune?keep=10001`,
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects non-numeric keep', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/snapshots/prune?keep=abc`,
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
