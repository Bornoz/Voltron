import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import picomatch from 'picomatch';
import { ProtectionLevel, OperationType } from '@voltron/shared';
import { ProtectionZoneRepository } from '../db/repositories/protection-zones.js';
import { getDb } from '../db/connection.js';

const CreateZoneBody = z.object({
  path: z.string().min(1),
  level: ProtectionLevel,
  reason: z.string().optional(),
  allowedOperations: z.array(OperationType).optional(),
});

const UpdateZoneBody = z.object({
  path: z.string().min(1).optional(),
  level: ProtectionLevel.optional(),
  reason: z.string().optional(),
  allowedOperations: z.array(OperationType).optional(),
});

export async function protectionRoutes(app: FastifyInstance): Promise<void> {
  const repo = new ProtectionZoneRepository();

  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/zones',
    async (request, reply) => {
      return reply.send(repo.findByProject(request.params.id));
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/zones',
    async (request, reply) => {
      const body = CreateZoneBody.parse(request.body);
      const zone = repo.create({ projectId: request.params.id, ...body });
      return reply.status(201).send(zone);
    },
  );

  app.put<{ Params: { id: string; zid: string } }>(
    '/api/projects/:id/zones/:zid',
    async (request, reply) => {
      const body = UpdateZoneBody.parse(request.body);
      const zone = repo.update(request.params.zid, body);
      if (!zone) return reply.status(404).send({ error: 'Zone not found' });
      return reply.send(zone);
    },
  );

  app.delete<{ Params: { id: string; zid: string } }>(
    '/api/projects/:id/zones/:zid',
    async (request, reply) => {
      const ok = repo.delete(request.params.zid);
      if (!ok) return reply.status(400).send({ error: 'Cannot delete system zone or zone not found' });
      return reply.send({ success: true });
    },
  );

  // Test a glob pattern against a list of paths
  const TestPatternBody = z.object({
    pattern: z.string().min(1),
    testPaths: z.array(z.string().min(1)),
  });

  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/zones/test',
    async (request, reply) => {
      const { pattern, testPaths } = TestPatternBody.parse(request.body);

      const isMatch = picomatch(pattern);
      const matches: string[] = [];
      const nonMatches: string[] = [];

      for (const p of testPaths) {
        if (isMatch(p)) {
          matches.push(p);
        } else {
          nonMatches.push(p);
        }
      }

      return reply.send({ matches, nonMatches });
    },
  );

  const ViolationQuery = z.object({
    limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  });

  // Recent protection zone violation events (last 100)
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/projects/:id/zones/violations',
    async (request, reply) => {
      const parsed = ViolationQuery.safeParse(request.query);
      const limit = parsed.success ? parsed.data.limit! : 100;
      const db = getDb();

      const rows = db.prepare(`
        SELECT id, sequence_number, action, file_path, risk_level, protection_zone, risk_reasons, created_at
        FROM action_log
        WHERE project_id = ? AND protection_zone IS NOT NULL AND protection_zone != 'NONE'
        ORDER BY created_at DESC
        LIMIT ?
      `).all(request.params.id, limit) as Record<string, unknown>[];

      const violations = rows.map(row => ({
        id: row.id as string,
        sequenceNumber: row.sequence_number as number,
        action: row.action as string,
        filePath: row.file_path as string,
        riskLevel: row.risk_level as string,
        protectionZone: row.protection_zone as string,
        riskReasons: row.risk_reasons ? JSON.parse(row.risk_reasons as string) : [],
        timestamp: row.created_at as number,
      }));

      return reply.send({ violations, count: violations.length });
    },
  );
}
