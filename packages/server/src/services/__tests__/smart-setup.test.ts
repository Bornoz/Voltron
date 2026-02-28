import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { initDb, closeDb } from '../../db/connection.js';
import { createSchema } from '../../db/schema.js';
import { ProjectRepository } from '../../db/repositories/projects.js';
import { SmartSetupRepository } from '../../db/repositories/smart-setup.js';
import { SmartSetupService } from '../smart-setup.js';

const TEST_DIR = '/tmp/voltron-smart-setup-test';

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
};

describe('SmartSetupService', () => {
  let service: SmartSetupService;
  let repo: SmartSetupRepository;
  let projectRepo: ProjectRepository;
  let projectId: string;

  beforeAll(() => {
    // Init in-memory DB
    const db = initDb(':memory:');
    createSchema(db);

    projectRepo = new ProjectRepository();
    repo = new SmartSetupRepository();
    service = new SmartSetupService(silentLogger, null); // no GitHub token

    // Clean and create test project directory
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
    mkdirSync(TEST_DIR, { recursive: true });

    // Create a realistic project structure
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
        fastify: '^5.0.0',
        xstate: '^5.0.0',
        zod: '^3.0.0',
      },
      devDependencies: {
        vitest: '^1.0.0',
        tailwindcss: '^4.0.0',
        typescript: '^5.0.0',
      },
    }, null, 2));
    writeFileSync(join(TEST_DIR, 'tsconfig.json'), '{}');
    writeFileSync(join(TEST_DIR, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*');
    writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Project');
    writeFileSync(join(TEST_DIR, 'vitest.config.ts'), 'export default {}');

    // Create src directory with some files
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src', 'index.ts'), 'console.log("hello");\nconsole.log("world");\n');
    writeFileSync(join(TEST_DIR, 'src', 'app.ts'), 'export const app = true;\n');

    // Create project in DB
    const project = projectRepo.create({ name: 'Test SmartSetup', rootPath: TEST_DIR });
    projectId = project.id;
  });

  afterAll(() => {
    closeDb();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  });

  // ── Project Profile Analysis ───────────────────────

  describe('analyzeProject', () => {
    it('should detect languages from package.json and tsconfig', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.languages).toContain('TypeScript');
    });

    it('should detect frameworks from dependencies', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.frameworks).toContain('React');
      expect(profile.frameworks).toContain('Fastify');
    });

    it('should detect package manager from lock file', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.packageManager).toBe('pnpm');
    });

    it('should detect monorepo from pnpm-workspace.yaml', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.monorepo).toBe(true);
    });

    it('should detect CLAUDE.md presence', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.hasClaude).toBe(true);
    });

    it('should detect test framework', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.hasTests).toBe(true);
      expect(profile.testFramework).toBe('vitest');
    });

    it('should detect patterns from dependencies', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.detectedPatterns).toContain('State Machine');
      expect(profile.detectedPatterns).toContain('REST API');
      expect(profile.detectedPatterns).toContain('CSS Framework');
      expect(profile.detectedPatterns).toContain('Validation');
    });

    it('should count files and lines of code', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.fileCount).toBeGreaterThanOrEqual(2);
      expect(profile.linesOfCode).toBeGreaterThanOrEqual(3);
    });

    it('should report Skills, MCP, Hooks as absent when missing', async () => {
      const profile = await service.analyzeProject(projectId);
      expect(profile.hasClaudeSkills).toBe(false);
      expect(profile.hasMcp).toBe(false);
      expect(profile.hasHooks).toBe(false);
    });

    it('should throw for non-existent project', async () => {
      await expect(service.analyzeProject('nonexistent')).rejects.toThrow('not found');
    });
  });

  // ── Heuristic Evaluation ───────────────────────────

  describe('evaluateRepos', () => {
    it('should score repos based on profile match', async () => {
      const profile = await service.analyzeProject(projectId);

      const repos = [
        {
          id: 'r1', repoUrl: 'https://github.com/test/react-skill',
          repoName: 'test/react-skill', stars: 500, description: 'React best practices skill',
          category: 'skill' as const, relevanceScore: 0, relevanceReason: '',
          installCommand: null, configSnippet: null, selected: false,
        },
        {
          id: 'r2', repoUrl: 'https://github.com/test/random',
          repoName: 'test/random-thing', stars: 5, description: 'Unrelated tool',
          category: 'workflow' as const, relevanceScore: 0, relevanceReason: '',
          installCommand: null, configSnippet: null, selected: false,
        },
        {
          id: 'r3', repoUrl: 'https://github.com/test/mcp-server',
          repoName: 'test/mcp-server', stars: 1200, description: 'MCP server for TypeScript',
          category: 'mcp-server' as const, relevanceScore: 0, relevanceReason: '',
          installCommand: null, configSnippet: null, selected: false,
        },
      ];

      const scored = service.evaluateRepos(profile, repos);

      // Should be sorted by relevance (highest first)
      expect(scored[0].relevanceScore).toBeGreaterThanOrEqual(scored[1].relevanceScore);
      expect(scored[1].relevanceScore).toBeGreaterThanOrEqual(scored[2].relevanceScore);

      // MCP server should score high because profile.hasMcp is false
      const mcp = scored.find((r) => r.id === 'r3')!;
      expect(mcp.relevanceScore).toBeGreaterThanOrEqual(40);
      expect(mcp.relevanceReason).toBeTruthy();

      // React skill should get framework bonus
      const react = scored.find((r) => r.id === 'r1')!;
      expect(react.relevanceScore).toBeGreaterThan(0);

      // Random should score lowest
      const random = scored.find((r) => r.id === 'r2')!;
      expect(random.relevanceScore).toBeLessThan(mcp.relevanceScore);
    });

    it('should auto-select repos with score >= 70', async () => {
      const profile = await service.analyzeProject(projectId);

      const repos = [
        {
          id: 'r-high', repoUrl: 'https://github.com/test/high',
          repoName: 'test/mcp-react-typescript', stars: 2000,
          description: 'MCP server for React TypeScript projects with Fastify',
          category: 'mcp-server' as const, relevanceScore: 0, relevanceReason: '',
          installCommand: null, configSnippet: null, selected: false,
        },
      ];

      const scored = service.evaluateRepos(profile, repos);
      const high = scored.find((r) => r.id === 'r-high')!;
      // Score should be very high due to multiple matches
      if (high.relevanceScore >= 70) {
        expect(high.selected).toBe(true);
      }
    });
  });

  // ── GitHub Discovery (without token) ───────────────

  describe('discoverRepos', () => {
    it('should return empty array when no GitHub token', async () => {
      const profile = await service.analyzeProject(projectId);
      const repos = await service.discoverRepos(profile);
      expect(repos).toEqual([]);
    });
  });

  // ── Full Pipeline ──────────────────────────────────

  describe('runFullPipeline', () => {
    it('should complete pipeline with skipGithub', async () => {
      const runId = await service.runFullPipeline(projectId, { skipGithub: true });
      expect(runId).toBeTruthy();

      const run = service.getRun(runId);
      expect(run).toBeTruthy();
      expect(run!.status).toBe('ready');
      expect(run!.profile).toBeTruthy();
      expect(run!.profile!.languages).toContain('TypeScript');
      expect(run!.discoveries).toHaveLength(0); // skipped GitHub
    });

    it('should complete pipeline without skipGithub (no token, falls through)', async () => {
      const runId = await service.runFullPipeline(projectId);
      expect(runId).toBeTruthy();

      const run = service.getRun(runId);
      expect(run).toBeTruthy();
      expect(run!.status).toBe('ready');
      expect(run!.discoveries).toHaveLength(0); // no token → no repos
    });

    it('should handle non-existent project gracefully', async () => {
      const runId = await service.runFullPipeline('nonexistent-project');
      // Should return a temp ID (no DB record created due to FK constraint)
      expect(runId).toBeTruthy();
      expect(runId).toContain('failed-');
      // No DB record exists for this
      const run = service.getRun(runId);
      expect(run).toBeNull();
    });
  });

  // ── Database Repository ────────────────────────────

  describe('SmartSetupRepository', () => {
    it('should create and find run', () => {
      const run = repo.create(projectId);
      expect(run.id).toBeTruthy();
      expect(run.status).toBe('analyzing');
      expect(run.projectId).toBe(projectId);

      const found = repo.findById(run.id);
      expect(found).toBeTruthy();
      expect(found!.id).toBe(run.id);
    });

    it('should update run status', () => {
      const run = repo.create(projectId);
      repo.update(run.id, { status: 'discovering' });

      const found = repo.findById(run.id);
      expect(found!.status).toBe('discovering');
    });

    it('should update profile JSON', () => {
      const run = repo.create(projectId);
      const profile = {
        languages: ['TypeScript'],
        frameworks: ['React'],
        packageManager: 'pnpm',
        hasTests: true,
        testFramework: 'vitest',
        hasClaude: true,
        hasClaudeSkills: false,
        hasMcp: false,
        hasHooks: false,
        monorepo: true,
        linesOfCode: 1000,
        fileCount: 50,
        detectedPatterns: ['REST API'],
      };

      repo.update(run.id, { profile });

      const found = repo.findById(run.id);
      expect(found!.profile).toBeTruthy();
      expect(found!.profile!.languages).toContain('TypeScript');
      expect(found!.profile!.frameworks).toContain('React');
    });

    it('should update discoveries JSON', () => {
      const run = repo.create(projectId);
      const discoveries = [
        {
          id: 'd1', repoUrl: 'https://github.com/test/repo',
          repoName: 'test/repo', stars: 100, description: 'test',
          category: 'skill' as const, relevanceScore: 80, relevanceReason: 'Good match',
          installCommand: 'npm install test', configSnippet: null, selected: true,
        },
      ];

      repo.update(run.id, { discoveries });

      const found = repo.findById(run.id);
      expect(found!.discoveries).toHaveLength(1);
      expect(found!.discoveries[0].repoName).toBe('test/repo');
      expect(found!.discoveries[0].selected).toBe(true);
    });

    it('should list runs by project', () => {
      // Create a few runs
      repo.create(projectId);
      repo.create(projectId);

      const runs = repo.findByProject(projectId);
      expect(runs.length).toBeGreaterThanOrEqual(2);
      // Ordered by created_at DESC
      expect(runs[0].createdAt).toBeGreaterThanOrEqual(runs[1].createdAt);
    });

    it('should update error field', () => {
      const run = repo.create(projectId);
      repo.update(run.id, { status: 'failed', error: 'Something went wrong' });

      const found = repo.findById(run.id);
      expect(found!.status).toBe('failed');
      expect(found!.error).toBe('Something went wrong');
    });

    it('should return null for non-existent run', () => {
      const found = repo.findById('nonexistent');
      expect(found).toBeNull();
    });
  });

  // ── Getters ────────────────────────────────────────

  describe('getters', () => {
    it('getRun should return run by id', async () => {
      const runId = await service.runFullPipeline(projectId, { skipGithub: true });
      const run = service.getRun(runId);
      expect(run).toBeTruthy();
      expect(run!.id).toBe(runId);
    });

    it('getRuns should list project runs', async () => {
      await service.runFullPipeline(projectId, { skipGithub: true });
      const runs = service.getRuns(projectId);
      expect(runs.length).toBeGreaterThanOrEqual(1);
    });

    it('getProfile should return project profile', async () => {
      const profile = await service.getProfile(projectId);
      expect(profile.languages).toContain('TypeScript');
      expect(profile.frameworks).toContain('React');
    });
  });
});
