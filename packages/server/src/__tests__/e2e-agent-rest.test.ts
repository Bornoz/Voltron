import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, createTestProject, type E2EContext } from './e2e-helpers.js';

describe('E2E: Agent REST API', () => {
  let ctx: E2EContext;
  let token: string;
  let projectId: string;

  beforeAll(async () => {
    ctx = await buildFullTestApp();
    token = await getToken(ctx.app);
    projectId = await createTestProject(ctx.app, token, 'Agent E2E', '/tmp/agent-e2e');
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  describe('POST /api/projects/:id/agent/spawn', () => {
    it('spawns an agent and returns session info', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/spawn`,
        payload: {
          model: 'claude-haiku-4-5-20251001',
          prompt: 'Fix all TypeScript errors in the project',
          targetDir: '/tmp/agent-e2e',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('sessionId');
      expect(ctx.mockRunner.spawn).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          prompt: 'Fix all TypeScript errors in the project',
        }),
      );
    });

    it('spawn with system prompt', async () => {
      (ctx.mockRunner.spawn as any).mockClear();
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/spawn`,
        payload: {
          prompt: 'Review code',
          targetDir: '/tmp/agent-e2e',
          systemPrompt: 'You are a senior code reviewer.',
        },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('POST /api/projects/:id/agent/stop', () => {
    it('pauses the agent', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/stop`,
      });
      expect(res.statusCode).toBe(200);
      expect(ctx.mockRunner.pause).toHaveBeenCalledWith(projectId);
    });
  });

  describe('POST /api/projects/:id/agent/resume', () => {
    it('resumes the agent', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/resume`,
      });
      expect(res.statusCode).toBe(200);
      expect(ctx.mockRunner.resume).toHaveBeenCalledWith(projectId);
    });
  });

  describe('POST /api/projects/:id/agent/kill', () => {
    it('kills the agent', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/kill`,
      });
      expect(res.statusCode).toBe(200);
      expect(ctx.mockRunner.kill).toHaveBeenCalledWith(projectId);
    });
  });

  describe('POST /api/projects/:id/agent/inject', () => {
    it('injects a prompt into the running agent', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/inject`,
        payload: {
          prompt: 'Also add error handling to the API routes',
          context: { filePath: '/src/routes/api.ts' },
          urgency: 'high',
        },
      });
      expect(res.statusCode).toBe(200);
      expect(ctx.mockRunner.injectPrompt).toHaveBeenCalledWith(
        projectId,
        expect.objectContaining({
          prompt: 'Also add error handling to the API routes',
          urgency: 'high',
        }),
      );
    });
  });

  describe('GET /api/projects/:id/agent/session', () => {
    it('returns current session (or null)', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/agent/session`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/projects/:id/agent/sessions', () => {
    it('returns session history', async () => {
      (ctx.mockRunner.getSessionHistory as any).mockReturnValueOnce([
        { sessionId: 's1', status: 'COMPLETED', model: 'claude-haiku-4-5-20251001', createdAt: Date.now() - 3600_000 },
        { sessionId: 's2', status: 'RUNNING', model: 'claude-sonnet-4-6', createdAt: Date.now() },
      ]);

      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/agent/sessions`,
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('Breakpoints CRUD', () => {
    it('GET /api/projects/:id/agent/breakpoints — lists breakpoints', async () => {
      (ctx.mockRunner.getBreakpoints as any).mockReturnValueOnce([]);
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/agent/breakpoints`,
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('POST /api/projects/:id/agent/breakpoints — sets a breakpoint', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: `/api/projects/${projectId}/agent/breakpoints`,
        payload: { filePath: '/src/critical.ts' },
      });
      expect(res.statusCode).toBe(200);
      expect(ctx.mockRunner.setBreakpoint).toHaveBeenCalled();
    });

    it('DELETE /api/projects/:id/agent/breakpoints — removes a breakpoint', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'DELETE',
        url: `/api/projects/${projectId}/agent/breakpoints`,
        payload: { filePath: '/src/critical.ts' },
      });
      expect(res.statusCode).toBe(200);
      expect(ctx.mockRunner.removeBreakpoint).toHaveBeenCalled();
    });
  });

  describe('GET /api/projects/:id/agent/breadcrumbs', () => {
    it('returns empty breadcrumbs when no session', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/agent/breadcrumbs`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/projects/:id/agent/plan', () => {
    it('returns plan or null', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/agent/plan`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/projects/:id/agent/injections', () => {
    it('returns injection history', async () => {
      (ctx.mockRunner.getInjections as any).mockReturnValueOnce([]);
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/agent/injections`,
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/projects/:id/agent/devserver', () => {
    it('returns dev server status', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: `/api/projects/${projectId}/agent/devserver`,
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
