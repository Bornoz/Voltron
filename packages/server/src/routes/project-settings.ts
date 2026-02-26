import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ProjectRulesRepository } from '../db/repositories/project-rules.js';
import { ProjectMemoryRepository } from '../db/repositories/project-memory.js';

const MEMORY_CATEGORIES = ['architecture', 'conventions', 'bugs', 'patterns', 'general'] as const;

const MemoryCreateBody = z.object({
  category: z.enum(MEMORY_CATEGORIES).default('general'),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
});

const MemoryUpdateBody = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  pinned: z.boolean().optional(),
});

const RulesBody = z.object({
  content: z.string().max(50000),
});

export function projectSettingsRoutes(app: FastifyInstance): void {
  const rulesRepo = new ProjectRulesRepository();
  const memoryRepo = new ProjectMemoryRepository();

  // ── Rules ──────────────────────────────────────────

  // Get rules for project
  app.get<{ Params: { id: string } }>('/api/projects/:id/rules', async (request, reply) => {
    const rules = rulesRepo.getByProject(request.params.id);
    return reply.send(rules ?? { content: '', isActive: true });
  });

  // Update rules (upsert)
  app.put<{ Params: { id: string } }>('/api/projects/:id/rules', async (request, reply) => {
    const body = RulesBody.parse(request.body);
    const result = rulesRepo.upsert(request.params.id, body.content);
    return reply.send(result);
  });

  // Toggle rules active/inactive
  app.post<{ Params: { id: string } }>('/api/projects/:id/rules/toggle', async (request, reply) => {
    const current = rulesRepo.getByProject(request.params.id);
    if (!current) {
      return reply.status(404).send({ error: 'No rules found for this project' });
    }
    rulesRepo.setActive(request.params.id, !current.isActive);
    return reply.send({ isActive: !current.isActive });
  });

  // ── Memory ─────────────────────────────────────────

  // List memories for project
  app.get<{ Params: { id: string }; Querystring: { category?: string; limit?: string } }>(
    '/api/projects/:id/memory',
    async (request, reply) => {
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 100;
      let memories = memoryRepo.findByProject(request.params.id, limit);
      if (request.query.category) {
        memories = memories.filter((m) => m.category === request.query.category);
      }
      return reply.send(memories);
    },
  );

  // Create memory
  app.post<{ Params: { id: string } }>('/api/projects/:id/memory', async (request, reply) => {
    const body = MemoryCreateBody.parse(request.body);
    const entry = memoryRepo.create({
      projectId: request.params.id,
      category: body.category,
      title: body.title,
      content: body.content,
    });
    return reply.status(201).send(entry);
  });

  // Update memory
  app.put<{ Params: { id: string; memId: string } }>('/api/projects/:id/memory/:memId', async (request, reply) => {
    const body = MemoryUpdateBody.parse(request.body);
    const existing = memoryRepo.findById(request.params.memId);
    if (!existing || existing.projectId !== request.params.id) {
      return reply.status(404).send({ error: 'Memory entry not found' });
    }
    memoryRepo.update(request.params.memId, body);
    const updated = memoryRepo.findById(request.params.memId);
    return reply.send(updated);
  });

  // Delete memory
  app.delete<{ Params: { id: string; memId: string } }>('/api/projects/:id/memory/:memId', async (request, reply) => {
    const existing = memoryRepo.findById(request.params.memId);
    if (!existing || existing.projectId !== request.params.id) {
      return reply.status(404).send({ error: 'Memory entry not found' });
    }
    memoryRepo.delete(request.params.memId);
    return reply.send({ success: true });
  });

  // Toggle pin
  app.post<{ Params: { id: string; memId: string } }>('/api/projects/:id/memory/:memId/pin', async (request, reply) => {
    const existing = memoryRepo.findById(request.params.memId);
    if (!existing || existing.projectId !== request.params.id) {
      return reply.status(404).send({ error: 'Memory entry not found' });
    }
    const pinned = memoryRepo.togglePin(request.params.memId);
    return reply.send({ pinned });
  });
}
