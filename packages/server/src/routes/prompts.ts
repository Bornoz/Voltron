import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PromptVersionRepository } from '../db/repositories/prompt-versions.js';

const CreatePromptBody = z.object({
  name: z.string().min(1).max(200),
  content: z.string().min(1),
});

const DiffQuery = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const LimitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
});

export function promptRoutes(app: FastifyInstance): void {
  const promptRepo = new PromptVersionRepository();

  // List prompt versions
  app.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/api/projects/:id/prompts',
    async (request, reply) => {
      const parsed = LimitQuery.safeParse(request.query);
      const limit = parsed.success ? parsed.data.limit! : 50;
      const versions = promptRepo.findByProject(request.params.id, limit);
      return reply.send(versions);
    },
  );

  // Get active prompt
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/prompts/active',
    async (request, reply) => {
      const active = promptRepo.getActive(request.params.id);
      return reply.send(active);
    },
  );

  // Create new prompt version
  app.post<{ Params: { id: string }; Body: { name: string; content: string } }>(
    '/api/projects/:id/prompts',
    async (request, reply) => {
      const parsed = CreatePromptBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'name and content are required', details: parsed.error.issues });
      }
      const version = promptRepo.create({
        projectId: request.params.id,
        name: parsed.data.name,
        content: parsed.data.content,
      });
      return reply.status(201).send(version);
    },
  );

  // Activate a specific version
  app.post<{ Params: { id: string; vid: string } }>(
    '/api/projects/:id/prompts/:vid/activate',
    async (request, reply) => {
      promptRepo.activate(request.params.vid);
      const active = promptRepo.findById(request.params.vid);
      return reply.send(active);
    },
  );

  // Get a specific version
  app.get<{ Params: { id: string; vid: string } }>(
    '/api/projects/:id/prompts/:vid',
    async (request, reply) => {
      const version = promptRepo.findById(request.params.vid);
      if (!version) return reply.status(404).send({ error: 'Version not found' });
      return reply.send(version);
    },
  );

  // Compare two versions
  app.get<{ Params: { id: string }; Querystring: { from: string; to: string } }>(
    '/api/projects/:id/prompts/diff',
    async (request, reply) => {
      const parsed = DiffQuery.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'from and to are required' });
      const diff = promptRepo.getDiff(parsed.data.from, parsed.data.to);
      return reply.send(diff);
    },
  );
}
