import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SmartSetupService } from '../services/smart-setup.js';

export function smartSetupRoutes(app: FastifyInstance, githubToken: string | null): void {
  const service = new SmartSetupService(app.log, githubToken);

  // Start full pipeline (async — returns immediately)
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/smart-setup/run',
    async (request, reply) => {
      const body = z.object({
        skipGithub: z.boolean().optional().default(false),
      }).parse(request.body ?? {});

      // Fire & forget — pipeline runs in background
      const runId = await service.runFullPipeline(request.params.id, {
        skipGithub: body.skipGithub,
      });

      return reply.status(201).send({ runId });
    },
  );

  // List all runs for project
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/smart-setup/runs',
    async (request, reply) => {
      const runs = service.getRuns(request.params.id);
      return reply.send(runs);
    },
  );

  // Get single run detail
  app.get<{ Params: { id: string; runId: string } }>(
    '/api/projects/:id/smart-setup/runs/:runId',
    async (request, reply) => {
      const run = service.getRun(request.params.runId);
      if (!run) return reply.status(404).send({ error: 'Run not found' });
      if (run.projectId !== request.params.id) return reply.status(403).send({ error: 'Unauthorized' });
      return reply.send(run);
    },
  );

  // Apply selected repos
  app.post<{ Params: { id: string; runId: string } }>(
    '/api/projects/:id/smart-setup/runs/:runId/apply',
    async (request, reply) => {
      const body = z.object({
        repoIds: z.array(z.string()),
      }).parse(request.body);

      const run = service.getRun(request.params.runId);
      if (!run) return reply.status(404).send({ error: 'Run not found' });
      if (run.projectId !== request.params.id) return reply.status(403).send({ error: 'Unauthorized' });

      await service.applySetup(request.params.runId, body.repoIds);
      return reply.send({ success: true });
    },
  );

  // Quick profile analysis only
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/smart-setup/profile',
    async (request, reply) => {
      const profile = await service.getProfile(request.params.id);
      return reply.send(profile);
    },
  );
}
