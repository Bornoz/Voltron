import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AgentSpawnConfig, PromptInjection } from '@voltron/shared';
import type { AgentRunner } from '../services/agent-runner.js';

const SpawnBody = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  targetDir: z.string(),
  systemPrompt: z.string().optional(),
});

const InjectBody = z.object({
  prompt: z.string().min(1),
  context: z.object({
    filePath: z.string().optional(),
    lineRange: z.object({ start: z.number(), end: z.number() }).optional(),
    constraints: z.array(z.string()).optional(),
    referenceImageUrl: z.string().optional(),
    simulatorPatches: z.array(z.unknown()).optional(),
  }).optional(),
  urgency: z.enum(['low', 'normal', 'high']).optional(),
  includeConstraints: z.boolean().optional(),
});

export function agentRoutes(app: FastifyInstance, agentRunner: AgentRunner): void {
  // Spawn a new agent
  app.post<{ Params: { id: string } }>('/api/projects/:id/agent/spawn', async (request, reply) => {
    const body = SpawnBody.parse(request.body);
    const projectId = request.params.id;

    try {
      const sessionId = await agentRunner.spawn({
        projectId,
        model: body.model ?? 'claude-haiku-4-5-20251001',
        prompt: body.prompt,
        targetDir: body.targetDir,
      });
      return reply.send({ sessionId, status: 'SPAWNING' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Spawn failed';
      return reply.status(400).send({ error: message });
    }
  });

  // Pause agent (SIGTSTP)
  app.post<{ Params: { id: string } }>('/api/projects/:id/agent/stop', async (request, reply) => {
    try {
      agentRunner.pause(request.params.id);
      return reply.send({ status: 'PAUSED' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Stop failed';
      return reply.status(400).send({ error: message });
    }
  });

  // Resume agent (SIGCONT)
  app.post<{ Params: { id: string } }>('/api/projects/:id/agent/resume', async (request, reply) => {
    try {
      agentRunner.resume(request.params.id);
      return reply.send({ status: 'RUNNING' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resume failed';
      return reply.status(400).send({ error: message });
    }
  });

  // Kill agent (SIGTERM -> SIGKILL)
  app.post<{ Params: { id: string } }>('/api/projects/:id/agent/kill', async (request, reply) => {
    try {
      await agentRunner.kill(request.params.id);
      return reply.send({ status: 'COMPLETED' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kill failed';
      return reply.status(400).send({ error: message });
    }
  });

  // Inject prompt
  app.post<{ Params: { id: string } }>('/api/projects/:id/agent/inject', async (request, reply) => {
    const body = InjectBody.parse(request.body);
    try {
      await agentRunner.injectPrompt(request.params.id, {
        prompt: body.prompt,
        context: body.context,
        urgency: body.urgency ?? 'normal',
      });
      return reply.send({ status: 'INJECTING' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Inject failed';
      return reply.status(400).send({ error: message });
    }
  });

  // Get current session (in-memory or DB)
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/session', async (request, reply) => {
    const agent = agentRunner.getSession(request.params.id);
    if (agent) {
      return reply.send({
        id: agent.sessionDbId,
        sessionId: agent.sessionId,
        status: agent.status,
        model: agent.model,
        prompt: agent.prompt,
        targetDir: agent.targetDir,
        pid: agent.process?.pid ?? null,
        location: agent.location,
        plan: agent.plan,
        inputTokens: agent.inputTokens,
        outputTokens: agent.outputTokens,
        startedAt: agent.startedAt,
        breadcrumbCount: agent.breadcrumbs.length,
      });
    }
    // Fallback to DB
    const dbSession = agentRunner.getSessionFromDb(request.params.id);
    return reply.send(dbSession ?? null);
  });

  // Get session history
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/sessions', async (request, reply) => {
    return reply.send(agentRunner.getSessionHistory(request.params.id));
  });

  // Get current GPS location
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/location', async (request, reply) => {
    const agent = agentRunner.getSession(request.params.id);
    return reply.send(agent?.location ?? null);
  });

  // Get current plan
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/plan', async (request, reply) => {
    return reply.send(agentRunner.getPlan(request.params.id) ?? null);
  });

  // Get breadcrumbs
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/breadcrumbs', async (request, reply) => {
    return reply.send(agentRunner.getBreadcrumbs(request.params.id));
  });

  // Get injection history
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/injections', async (request, reply) => {
    return reply.send(agentRunner.getInjections(request.params.id));
  });
}
