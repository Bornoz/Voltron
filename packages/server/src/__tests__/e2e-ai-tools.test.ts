import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFullTestApp, cleanupE2E, getToken, authInject, type E2EContext } from './e2e-helpers.js';

describe('E2E: AI Tool Detection API', () => {
  let ctx: E2EContext;
  let token: string;

  beforeAll(async () => {
    ctx = await buildFullTestApp();
    token = await getToken(ctx.app);
  });

  afterAll(async () => {
    await cleanupE2E(ctx);
  });

  describe('GET /api/ai-tools', () => {
    it('returns scan results with tool list', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/ai-tools',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('tools');
      expect(body).toHaveProperty('scannedAt');
      expect(body).toHaveProperty('totalDurationMs');
      expect(body).toHaveProperty('platform');
      expect(Array.isArray(body.tools)).toBe(true);
      expect(body.tools.length).toBeGreaterThan(0);
    });

    it('each tool has required fields', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/ai-tools',
      });
      const { tools } = res.json();
      for (const tool of tools) {
        expect(tool).toHaveProperty('toolId');
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('status');
        expect(tool).toHaveProperty('tier');
        expect(tool).toHaveProperty('capabilities');
        expect(['detected', 'not_found', 'error', 'scanning']).toContain(tool.status);
        expect(['spawn', 'monitor', 'readonly']).toContain(tool.tier);
        expect(tool.capabilities).toHaveProperty('canSpawn');
        expect(tool.capabilities).toHaveProperty('canMonitor');
        expect(tool.capabilities).toHaveProperty('structuredOutput');
      }
    });

    it('returns cached result on second call (fast)', async () => {
      const start = Date.now();
      const res = await authInject(ctx.app, token, {
        method: 'GET',
        url: '/api/ai-tools',
      });
      const elapsed = Date.now() - start;
      expect(res.statusCode).toBe(200);
      // Second call should be near-instant (cached)
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('POST /api/ai-tools/rescan', () => {
    it('triggers a fresh scan', async () => {
      const res = await authInject(ctx.app, token, {
        method: 'POST',
        url: '/api/ai-tools/rescan',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('tools');
      expect(body).toHaveProperty('scannedAt');
    });
  });
});
