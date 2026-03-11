import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject, type E2EContext } from './e2e-helpers.js';

describe('E2E: Project Settings API (Rules & Memory)', () => {
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

  // ─── Rules ───────────────────────────────────────────

  describe('Rules CRUD', () => {
    it('GET /api/projects/:id/rules — returns empty rules initially', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/rules`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toBe('');
      expect(body.isActive).toBe(true);
    });

    it('PUT /api/projects/:id/rules — creates/updates rules', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'PUT',
        url: `/api/projects/${projectId}/rules`,
        payload: { content: 'Always use TypeScript strict mode.\nNever skip error handling.' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toContain('TypeScript strict mode');
    });

    it('GET returns updated rules', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/rules`,
      });
      expect(res.json().content).toContain('TypeScript strict mode');
    });

    it('POST /api/projects/:id/rules/toggle — toggles rules active state', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/rules/toggle`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().isActive).toBe(false);
    });

    it('toggle again — back to active', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/rules/toggle`,
      });
      expect(res.json().isActive).toBe(true);
    });
  });

  // ─── Memory ──────────────────────────────────────────

  describe('Memory CRUD', () => {
    let memoryId: string;

    it('POST /api/projects/:id/memory — creates a memory entry', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory`,
        payload: {
          category: 'architecture',
          title: 'Database Pattern',
          content: 'All queries must use prepared statements via better-sqlite3.',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('id');
      expect(body.category).toBe('architecture');
      expect(body.title).toBe('Database Pattern');
      memoryId = body.id;
    });

    it('creates multiple memories', async () => {
      await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory`,
        payload: { category: 'conventions', title: 'Naming', content: 'Use camelCase for variables.' },
      });
      await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory`,
        payload: { category: 'bugs', title: 'Known Race', content: 'Agent spawn has a race condition.' },
      });
    });

    it('GET /api/projects/:id/memory — lists all memories', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/memory`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(3);
    });

    it('filters by category', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/memory?category=architecture`,
      });
      expect(res.statusCode).toBe(200);
      for (const m of res.json()) {
        expect(m.category).toBe('architecture');
      }
    });

    it('PUT /api/projects/:id/memory/:memId — updates memory', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'PUT',
        url: `/api/projects/${projectId}/memory/${memoryId}`,
        payload: { title: 'Database Pattern (Updated)', content: 'Use prepared statements. Never use string interpolation.' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Database Pattern (Updated)');
    });

    it('POST /api/projects/:id/memory/:memId/pin — toggles pin', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory/${memoryId}/pin`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().pinned).toBe(true);
    });

    it('pin toggle again — unpins', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory/${memoryId}/pin`,
      });
      expect(res.json().pinned).toBe(false);
    });

    it('DELETE /api/projects/:id/memory/:memId — deletes memory', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'DELETE',
        url: `/api/projects/${projectId}/memory/${memoryId}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('returns 404 after deletion', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'PUT',
        url: `/api/projects/${projectId}/memory/${memoryId}`,
        payload: { title: 'Ghost' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects cross-project memory access', async () => {
      const otherId = await createTestProject(ctx.app, token, 'Other', '/tmp/other');

      // Create memory in the other project
      const createRes = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${otherId}/memory`,
        payload: { title: 'Other Mem', content: 'Test', category: 'general' },
      });
      const otherMemId = createRes.json().id;

      // Try to update via wrong project
      const res = await authInject(ctx.app, token, {
        method: 'PUT',
        url: `/api/projects/${projectId}/memory/${otherMemId}`,
        payload: { title: 'Hijacked' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Memory validation', () => {
    it('rejects empty title', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory`,
        payload: { category: 'general', title: '', content: 'Valid content' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects empty content', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/memory`,
        payload: { category: 'general', title: 'Valid Title', content: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });
});
