import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject, type E2EContext } from './e2e-helpers.js';
import { ActionRepository } from '../db/repositories/actions.js';
import { SnapshotRepository } from '../db/repositories/snapshots.js';
import { randomUUID, createHash } from 'node:crypto';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function sha1hex(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}

describe('E2E: Actions API', () => {
  let ctx: E2EContext;
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    ctx = await buildFullTestApp();
    token = await getToken(ctx.app);
    projectId = await createTestProject(ctx.app, token);

    // Create a snapshot first (action_log requires snapshot_id)
    const snapshotRepo = new SnapshotRepository();
    const snapshotId = randomUUID();
    snapshotRepo.insert({
      id: snapshotId,
      projectId,
      gitCommitHash: sha1hex('test-commit'),
      parentId: null,
      fileCount: 10,
      totalSize: 5000,
      isCritical: false,
      createdAt: Date.now(),
    });

    // Seed some action events directly in DB
    const actionRepo = new ActionRepository();
    for (let i = 0; i < 15; i++) {
      actionRepo.insert({
        id: randomUUID(),
        projectId,
        sequenceNumber: i + 1,
        snapshotId,
        action: i % 3 === 0 ? 'FILE_MODIFY' : i % 3 === 1 ? 'FILE_CREATE' : 'FILE_DELETE',
        file: i < 5 ? '/src/index.ts' : `/src/file-${i}.ts`,
        risk: i < 3 ? 'NONE' : i < 8 ? 'LOW' : i < 12 ? 'MEDIUM' : 'HIGH',
        riskReasons: i >= 12 ? ['Large cascade detected'] : undefined,
        diff: i % 3 === 0 ? `+line ${i}` : undefined,
        hash: sha256(`file-content-${i}`),
        timestamp: Date.now() - (15 - i) * 60_000,
      });
    }
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  describe('GET /api/projects/:id/actions', () => {
    it('returns paginated action list', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions?limit=5`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeLessThanOrEqual(5);
    });

    it('supports offset pagination', async () => {
      const page1 = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions?limit=5&offset=0`,
      });
      const page2 = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions?limit=5&offset=5`,
      });
      expect(page1.statusCode).toBe(200);
      expect(page2.statusCode).toBe(200);
      const ids1 = page1.json().map((a: any) => a.id);
      const ids2 = page2.json().map((a: any) => a.id);
      // No overlap
      for (const id of ids2) {
        expect(ids1).not.toContain(id);
      }
    });

    it('filters by risk level', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions?risk=HIGH`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      for (const action of body) {
        expect(action.risk).toBe('HIGH');
      }
    });

    it('returns empty for non-existent project', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${randomUUID()}/actions`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });
  });

  describe('GET /api/projects/:id/actions/:aid', () => {
    it('returns a single action by ID', async () => {
      const all = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions?limit=1`,
      });
      const firstId = all.json()[0].id;

      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/${firstId}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe(firstId);
    });

    it('returns 404 for non-existent action', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/${randomUUID()}`,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/projects/:id/actions/file', () => {
    it('returns actions for a specific file path', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/file?path=/src/index.ts`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      for (const action of body) {
        expect(action.file).toBe('/src/index.ts');
      }
    });

    it('returns 400 when path is missing', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/file`,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/projects/:id/actions/stats', () => {
    it('returns detailed statistics', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/stats`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('totalActions');
    });
  });

  describe('GET /api/projects/:id/actions/timeline', () => {
    it('returns hourly timeline by default', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/timeline`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('buckets');
      expect(Array.isArray(body.buckets)).toBe(true);
    });

    it('supports daily granularity', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/actions/timeline?granularity=daily`,
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
