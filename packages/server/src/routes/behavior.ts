import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BehaviorScoreRepository } from '../db/repositories/behavior-scores.js';
import { BehaviorScorer } from '../services/behavior-scorer.js';

const LimitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
});

export function behaviorRoutes(app: FastifyInstance, scorer?: BehaviorScorer): void {
  const scoreRepo = new BehaviorScoreRepository();
  const _scorer = scorer ?? new BehaviorScorer();

  // Get behavior scores for a project
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/projects/:id/behavior/scores',
    async (request, reply) => {
      const parsed = LimitQuery.safeParse(request.query);
      const limit = parsed.success ? parsed.data.limit! : 50;
      const scores = scoreRepo.findByProject(request.params.id, limit);
      return reply.send(scores);
    },
  );

  // Get latest behavior score
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/behavior/latest',
    async (request, reply) => {
      const score = scoreRepo.getLatest(request.params.id);
      return reply.send(score ?? { overallScore: 0, riskScore: 0, velocityScore: 0, complianceScore: 0 });
    },
  );

  // Trigger manual score calculation
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/behavior/score',
    async (request, reply) => {
      _scorer.scoreProject(request.params.id);
      const score = scoreRepo.getLatest(request.params.id);
      return reply.send(score);
    },
  );
}
