import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { initDb, closeDb } from '../db/connection.js';
import { createSchema } from '../db/schema.js';
import { registerAuth } from '../plugins/auth.js';
import { registerErrorHandler } from '../plugins/error-handler.js';
import { projectRoutes } from '../routes/projects.js';
import { smartSetupRoutes } from '../routes/smart-setup.js';

const TEST_DIR = '/tmp/voltron-api-smart-setup-test';

describe('Smart Setup API', () => {
  let app: FastifyInstance;
  let projectId: string;

  beforeAll(async () => {
    // Clean test directory
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });

    // Create a project structure
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'test-api-project',
      dependencies: { react: '^18.0.0', fastify: '^5.0.0' },
      devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
    }, null, 2));
    writeFileSync(join(TEST_DIR, 'tsconfig.json'), '{}');
    writeFileSync(join(TEST_DIR, 'pnpm-lock.yaml'), '');
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'export default {};\n');

    // Init in-memory DB
    const db = initDb(':memory:');
    createSchema(db);

    // Build app
    app = Fastify({ logger: false });
    registerAuth(app, {
      port: 8600, host: '127.0.0.1', dbPath: ':memory:', logLevel: 'silent',
      interceptorSecret: '', githubToken: null,
      corsOrigins: ['http://localhost:6400'], claudePath: 'claude',
      agentModel: 'test-model', agentTimeoutMs: 60_000,
      authSecret: '', adminUser: '', adminPass: '',
    });
    registerErrorHandler(app);
    await app.register(projectRoutes);
    smartSetupRoutes(app, null); // no GitHub token

    await app.ready();

    // Create project
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Test Project', rootPath: TEST_DIR },
    });
    projectId = res.json().id;
  });

  afterAll(async () => {
    await app.close();
    closeDb();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  // ── GET /api/projects/:id/smart-setup/profile ──────

  describe('GET /profile', () => {
    it('should return project profile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/smart-setup/profile`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('languages');
      expect(body).toHaveProperty('frameworks');
      expect(body).toHaveProperty('packageManager');
      expect(body.languages).toContain('TypeScript');
      expect(body.frameworks).toContain('React');
      expect(body.packageManager).toBe('pnpm');
      expect(body.hasTests).toBe(true);
      expect(body.testFramework).toBe('vitest');
    });

    it('should 500 for non-existent project', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/projects/nonexistent/smart-setup/profile',
      });
      expect(res.statusCode).toBe(500);
    });
  });

  // ── POST /api/projects/:id/smart-setup/run ─────────

  describe('POST /run', () => {
    it('should start pipeline and return runId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: { skipGithub: true },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty('runId');
      expect(typeof body.runId).toBe('string');
    });

    it('should start pipeline without skipGithub (default)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: {},
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toHaveProperty('runId');
    });

    it('should work with empty body', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toHaveProperty('runId');
    });
  });

  // ── GET /api/projects/:id/smart-setup/runs ─────────

  describe('GET /runs', () => {
    it('should list runs for project', async () => {
      // Create a run first
      await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: { skipGithub: true },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/smart-setup/runs`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body[0]).toHaveProperty('id');
      expect(body[0]).toHaveProperty('status');
      expect(body[0]).toHaveProperty('projectId');
    });
  });

  // ── GET /api/projects/:id/smart-setup/runs/:runId ──

  describe('GET /runs/:runId', () => {
    it('should return run detail', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: { skipGithub: true },
      });
      const { runId } = createRes.json();

      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/smart-setup/runs/${runId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(runId);
      expect(body.projectId).toBe(projectId);
      expect(body.status).toBe('ready');
      expect(body.profile).toBeTruthy();
      expect(body.profile.languages).toContain('TypeScript');
    });

    it('should 404 for non-existent run', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/smart-setup/runs/nonexistent`,
      });
      expect(res.statusCode).toBe(404);
    });

    it('should 403 for wrong project', async () => {
      // Create run on real project
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: { skipGithub: true },
      });
      const { runId } = createRes.json();

      // Try to access via different project ID
      const res = await app.inject({
        method: 'GET',
        url: `/api/projects/wrong-project-id/smart-setup/runs/${runId}`,
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── POST /api/projects/:id/smart-setup/runs/:runId/apply ──

  describe('POST /runs/:runId/apply', () => {
    it('should apply with empty repoIds (nothing to do)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: { skipGithub: true },
      });
      const { runId } = createRes.json();

      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/runs/${runId}/apply`,
        payload: { repoIds: [] },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ success: true });
    });

    it('should 404 for non-existent run', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/runs/nonexistent/apply`,
        payload: { repoIds: [] },
      });
      expect(res.statusCode).toBe(404);
    });

    it('should validate repoIds body', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: { skipGithub: true },
      });
      const { runId } = createRes.json();

      // Missing repoIds
      const res = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/runs/${runId}/apply`,
        payload: {},
      });
      // Zod validation should fail
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Full workflow integration ──────────────────────

  describe('Full workflow', () => {
    it('should run analyze → list → get → apply lifecycle', async () => {
      // 1. Start run with skipGithub
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/run`,
        payload: { skipGithub: true },
      });
      expect(startRes.statusCode).toBe(201);
      const { runId } = startRes.json();

      // 2. Get run detail
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/smart-setup/runs/${runId}`,
      });
      expect(detailRes.statusCode).toBe(200);
      const run = detailRes.json();
      expect(run.status).toBe('ready');
      expect(run.profile).toBeTruthy();
      expect(run.discoveries).toHaveLength(0);

      // 3. List runs
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/smart-setup/runs`,
      });
      expect(listRes.statusCode).toBe(200);
      const runs = listRes.json();
      expect(runs.some((r: { id: string }) => r.id === runId)).toBe(true);

      // 4. Apply (empty, since no discoveries)
      const applyRes = await app.inject({
        method: 'POST',
        url: `/api/projects/${projectId}/smart-setup/runs/${runId}/apply`,
        payload: { repoIds: [] },
      });
      expect(applyRes.statusCode).toBe(200);

      // 5. Verify completed status
      const afterApply = await app.inject({
        method: 'GET',
        url: `/api/projects/${projectId}/smart-setup/runs/${runId}`,
      });
      expect(afterApply.json().status).toBe('completed');
    });
  });
});
