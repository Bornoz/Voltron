import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestAppNoAuth as buildTestApp, cleanup } from './helpers.js';

describe('Protection Zones API', () => {
  let app: FastifyInstance;
  let projectId: string;

  beforeAll(async () => {
    app = await buildTestApp();

    // Create a project to use in zone tests
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Zone Test Project', rootPath: '/tmp/zone-test' },
    });
    projectId = res.json().id;
  });

  afterAll(async () => {
    await cleanup(app);
  });

  describe('CRUD lifecycle', () => {
    let zoneId: string;

    it('POST /api/projects/:id/zones — creates a zone', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/zones`,
        payload: {
          path: '/etc/nginx/**',
          level: 'DO_NOT_TOUCH',
          reason: 'Critical infrastructure',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('id');
      expect(body.path).toBe('/etc/nginx/**');
      expect(body.level).toBe('DO_NOT_TOUCH');
      expect(body.reason).toBe('Critical infrastructure');
      expect(body.projectId).toBe(projectId);
      zoneId = body.id;
    });

    it('GET /api/projects/:id/zones — lists zones for project', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/zones`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.some((z: { id: string }) => z.id === zoneId)).toBe(true);
    });

    it('PUT /api/projects/:id/zones/:zid — updates a zone', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}/zones/${zoneId}`,
        payload: { level: 'SURGICAL_ONLY', reason: 'Downgraded' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.level).toBe('SURGICAL_ONLY');
      expect(body.reason).toBe('Downgraded');
    });

    it('DELETE /api/projects/:id/zones/:zid — deletes the zone', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/zones/${zoneId}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // Verify deleted
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/zones`,
      });
      const zones = listRes.json();
      expect(zones.find((z: { id: string }) => z.id === zoneId)).toBeUndefined();
    });
  });

  describe('System zone protection', () => {
    it('cannot delete a system zone', async () => {
      // Create a system zone directly via DB (since the API doesn't expose isSystem)
      const { getDb } = await import('../db/connection.js');
      const db = getDb();
      const zoneId = '00000000-0000-0000-0000-systemzone01';
      const now = Date.now();
      db.prepare(`
        INSERT INTO protection_zones (id, project_id, path_pattern, level, reason, is_system, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 'system', ?, ?)
      `).run(zoneId, projectId, '/etc/systemd/**', 'DO_NOT_TOUCH', 'System zone', now, now);

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${projectId}/zones/${zoneId}`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/Cannot delete/i);

      // Verify still exists
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/zones`,
      });
      const zones = listRes.json();
      expect(zones.find((z: { id: string }) => z.id === zoneId)).toBeDefined();
    });
  });

  describe('Pattern testing', () => {
    it('POST /api/projects/:id/zones/test — tests glob patterns', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/zones/test`,
        payload: {
          pattern: 'src/**/*.ts',
          testPaths: [
            'src/index.ts',
            'src/utils/helper.ts',
            'package.json',
            'src/styles/main.css',
            'dist/index.js',
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.matches).toContain('src/index.ts');
      expect(body.matches).toContain('src/utils/helper.ts');
      expect(body.nonMatches).toContain('package.json');
      expect(body.nonMatches).toContain('src/styles/main.css');
      expect(body.nonMatches).toContain('dist/index.js');
    });

    it('rejects empty pattern', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/zones/test`,
        payload: { pattern: '', testPaths: ['file.ts'] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('Validation', () => {
    it('POST /api/projects/:id/zones — missing path returns 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/zones`,
        payload: { level: 'SURGICAL_ONLY' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('POST /api/projects/:id/zones — missing level returns 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/zones`,
        payload: { path: '/some/path' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('POST /api/projects/:id/zones — invalid level returns 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/zones`,
        payload: { path: '/some/path', level: 'INVALID_LEVEL' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('PUT /api/projects/:id/zones/:zid — unknown zoneId returns 404', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/projects/${projectId}/zones/00000000-0000-0000-0000-000000000000`,
        payload: { level: 'SURGICAL_ONLY' },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
