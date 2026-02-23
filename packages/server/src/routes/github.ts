import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GitHubAnalyzer } from '../services/github-analyzer.js';
import { GitHubCacheRepository } from '../db/repositories/github-cache.js';
import { buildGitHubSearchPrompt, buildGitHubAdaptPrompt } from '../services/github-agent-prompts.js';
import type { AgentRunner } from '../services/agent-runner.js';
import type { ServerConfig } from '../config.js';

const AnalyzeBody = z.object({
  repoUrl: z.string().url(),
});

const RepoUrlQuery = z.object({
  repoUrl: z.string().url(),
});

const SearchAndAdaptBody = z.object({
  query: z.string().min(1).max(500),
  framework: z.string().optional(),
  targetDir: z.string().min(1),
  model: z.string().optional(),
  existingDeps: z.array(z.string()).optional(),
  stylePreferences: z.array(z.string()).optional(),
});

const AdaptRepoBody = z.object({
  repoUrl: z.string().url(),
  targetDir: z.string().min(1),
  instructions: z.string().optional(),
  model: z.string().optional(),
});

export function githubRoutes(app: FastifyInstance, config: ServerConfig, agentRunner?: AgentRunner): void {
  const analyzer = new GitHubAnalyzer({ token: config.githubToken });
  const cache = new GitHubCacheRepository();

  // Trigger full repo analysis (always fresh)
  app.post<{ Params: { id: string } }>('/api/projects/:id/github/analyze', async (request, reply) => {
    const { repoUrl } = AnalyzeBody.parse(request.body);
    const projectId = request.params.id;

    try {
      const result = await analyzer.analyzeRepo(projectId, repoUrl);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      return reply.status(500).send({ error: message });
    }
  });

  // Get cached dependency graph (cache-first, fallback to full analysis)
  app.get<{ Params: { id: string }; Querystring: { repoUrl: string } }>(
    '/api/projects/:id/github/dependencies',
    async (request, reply) => {
      const parsed = RepoUrlQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Valid repoUrl query param required' });
      const { repoUrl } = parsed.data;

      // Try cache first
      const cached = cache.get(repoUrl, 'dependencies');
      if (cached) {
        return reply.send({
          ...JSON.parse(cached.resultJson),
          _cached: true,
          _cachedAt: cached.createdAt,
          _expiresAt: cached.expiresAt,
        });
      }

      // Cache miss - run full analysis
      try {
        const result = await analyzer.analyzeRepo(request.params.id, repoUrl);
        return reply.send(result.dependencies);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        return reply.status(500).send({ error: message });
      }
    },
  );

  // Get cached breaking changes (cache-first, fallback to full analysis)
  app.get<{ Params: { id: string }; Querystring: { repoUrl: string } }>(
    '/api/projects/:id/github/breaking-changes',
    async (request, reply) => {
      const parsed = RepoUrlQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Valid repoUrl query param required' });
      const { repoUrl } = parsed.data;

      // Try cache first
      const cached = cache.get(repoUrl, 'breaking-changes');
      if (cached) {
        return reply.send({
          breakingChanges: JSON.parse(cached.resultJson),
          _cached: true,
          _cachedAt: cached.createdAt,
          _expiresAt: cached.expiresAt,
        });
      }

      // Cache miss - run full analysis
      try {
        const result = await analyzer.analyzeRepo(request.params.id, repoUrl);
        return reply.send({ breakingChanges: result.breakingChanges });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        return reply.status(500).send({ error: message });
      }
    },
  );

  // Get cached compliance results (cache-first, fallback to full analysis)
  app.get<{ Params: { id: string }; Querystring: { repoUrl: string } }>(
    '/api/projects/:id/github/compliance',
    async (request, reply) => {
      const parsed = RepoUrlQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Valid repoUrl query param required' });
      const { repoUrl } = parsed.data;

      // Try cache first
      const cached = cache.get(repoUrl, 'compliance');
      if (cached) {
        return reply.send({
          compliance: JSON.parse(cached.resultJson),
          _cached: true,
          _cachedAt: cached.createdAt,
          _expiresAt: cached.expiresAt,
        });
      }

      // Cache miss - run full analysis
      try {
        const result = await analyzer.analyzeRepo(request.params.id, repoUrl);
        return reply.send({ compliance: result.compliance });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Analysis failed';
        return reply.status(500).send({ error: message });
      }
    },
  );

  // Search GitHub and spawn agent to adapt the best match
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/github/search-and-adapt',
    async (request, reply) => {
      if (!agentRunner) {
        return reply.status(503).send({ error: 'Agent runner not available' });
      }

      const body = SearchAndAdaptBody.parse(request.body);
      const projectId = request.params.id;

      const prompt = buildGitHubSearchPrompt({
        query: body.query,
        framework: body.framework,
        targetDir: body.targetDir,
        projectId,
        existingDeps: body.existingDeps,
        stylePreferences: body.stylePreferences,
      });

      try {
        const sessionId = await agentRunner.spawn({
          projectId,
          model: body.model ?? config.agentModel,
          prompt,
          targetDir: body.targetDir,
          sessionId: crypto.randomUUID(),
        });

        return reply.status(201).send({
          sessionId,
          status: 'SPAWNING',
          message: `Agent spawned to search GitHub for "${body.query}" and adapt results`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to spawn agent';
        return reply.status(500).send({ error: message });
      }
    },
  );

  // Adapt a specific GitHub repo via agent
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/github/adapt-repo',
    async (request, reply) => {
      if (!agentRunner) {
        return reply.status(503).send({ error: 'Agent runner not available' });
      }

      const body = AdaptRepoBody.parse(request.body);
      const projectId = request.params.id;

      const prompt = buildGitHubAdaptPrompt(
        body.repoUrl,
        body.targetDir,
        body.instructions,
      );

      try {
        const sessionId = await agentRunner.spawn({
          projectId,
          model: body.model ?? config.agentModel,
          prompt,
          targetDir: body.targetDir,
          sessionId: crypto.randomUUID(),
        });

        return reply.status(201).send({
          sessionId,
          status: 'SPAWNING',
          message: `Agent spawned to adapt ${body.repoUrl}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to spawn agent';
        return reply.status(500).send({ error: message });
      }
    },
  );
}
