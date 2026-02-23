import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { RiskLevel } from '@voltron/shared';
import { ActionRepository } from '../db/repositories/actions.js';

const ActionQuery = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
  risk: RiskLevel.optional(),
});

const TimelineQuery = z.object({
  granularity: z.enum(['hourly', 'daily']).optional().default('hourly'),
  hours: z.coerce.number().int().min(1).max(720).optional().default(24),
});

const FileQuery = z.object({
  path: z.string().min(1),
});

export async function actionRoutes(app: FastifyInstance): Promise<void> {
  const repo = new ActionRepository();

  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/api/projects/:id/actions',
    async (request, reply) => {
      const { id } = request.params;
      const parsed = ActionQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid query params', details: parsed.error.issues });

      const { limit, offset, risk } = parsed.data;
      if (risk) {
        return reply.send(repo.findByRisk(id, risk, limit));
      }
      return reply.send(repo.findByProject(id, limit, offset));
    },
  );

  app.get<{ Params: { id: string; aid: string } }>(
    '/api/projects/:id/actions/:aid',
    async (request, reply) => {
      const event = repo.findById(request.params.aid);
      if (!event) return reply.status(404).send({ error: 'Action not found' });
      return reply.send(event);
    },
  );

  app.get<{ Params: { id: string }; Querystring: { path: string } }>(
    '/api/projects/:id/actions/file',
    async (request, reply) => {
      const parsed = FileQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'path query param required' });
      return reply.send(repo.findByFile(request.params.id, parsed.data.path));
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/actions/stats',
    async (request, reply) => {
      return reply.send(repo.getDetailedStats(request.params.id));
    },
  );

  // Timeline view: hourly/daily bucketed action counts with risk breakdown
  app.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/api/projects/:id/actions/timeline',
    async (request, reply) => {
      const parsed = TimelineQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid query params' });
      return reply.send(repo.getTimeline(request.params.id, parsed.data.granularity, parsed.data.hours));
    },
  );
}
