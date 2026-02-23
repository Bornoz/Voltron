import type { FastifyInstance } from 'fastify';
import { CreateProjectInput, UpdateProjectInput } from '@voltron/shared';
import { ProjectRepository } from '../db/repositories/projects.js';

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  const repo = new ProjectRepository();

  app.post('/api/projects', async (request, reply) => {
    const input = CreateProjectInput.parse(request.body);
    const project = repo.create(input);
    return reply.status(201).send(project);
  });

  app.get('/api/projects', async (_request, reply) => {
    return reply.send(repo.findAll());
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const project = repo.findById(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return reply.send(project);
  });

  app.put<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const input = UpdateProjectInput.parse(request.body);
    const project = repo.update(request.params.id, input);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return reply.send(project);
  });

  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const ok = repo.deactivate(request.params.id);
    if (!ok) return reply.status(404).send({ error: 'Project not found' });
    return reply.send({ success: true });
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/stats', async (request, reply) => {
    const project = repo.findById(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return reply.send(repo.getStats(request.params.id));
  });
}
