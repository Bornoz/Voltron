import { resolve, isAbsolute, normalize, relative, extname } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AgentSpawnConfig, PromptInjection } from '@voltron/shared';
import type { AgentRunner } from '../services/agent-runner.js';
import type { DevServerManager } from '../services/dev-server-manager.js';
import { ProjectRepository } from '../db/repositories/projects.js';

import { EDITOR_SCRIPT } from './editor-script.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webp': 'image/webp',
};

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

export function agentRoutes(app: FastifyInstance, agentRunner: AgentRunner, devServerManager?: DevServerManager): void {
  const projectRepo = new ProjectRepository();

  // Spawn a new agent
  app.post<{ Params: { id: string } }>('/api/projects/:id/agent/spawn', async (request, reply) => {
    const body = SpawnBody.parse(request.body);
    const projectId = request.params.id;

    // Resolve targetDir relative to project rootPath
    const project = projectRepo.findById(projectId);
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }
    const resolvedTargetDir = isAbsolute(body.targetDir)
      ? body.targetDir
      : resolve(project.rootPath, body.targetDir);

    try {
      const sessionId = await agentRunner.spawn({
        projectId,
        model: body.model ?? 'claude-haiku-4-5-20251001',
        prompt: body.prompt,
        targetDir: resolvedTargetDir,
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

  // Get dev server status
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/devserver', async (request, reply) => {
    if (!devServerManager) {
      return reply.send(null);
    }
    const info = devServerManager.getInfo(request.params.id);
    if (!info) {
      return reply.send(null);
    }
    return reply.send({
      status: info.status,
      port: info.port,
      url: info.url,
      projectType: info.projectType,
      error: info.error ?? null,
    });
  });

  // Restart dev server
  app.post<{ Params: { id: string } }>('/api/projects/:id/agent/devserver/restart', async (request, reply) => {
    if (!devServerManager) {
      return reply.status(400).send({ error: 'Dev server manager not available' });
    }
    const projectId = request.params.id;
    // Get targetDir from active session or DB
    const agent = agentRunner.getSession(projectId);
    const targetDir = agent?.targetDir
      ?? agentRunner.getSessionFromDb(projectId)?.targetDir;

    if (!targetDir) {
      return reply.status(404).send({ error: 'No agent session found' });
    }

    try {
      const info = await devServerManager.startForProject(projectId, targetDir);
      return reply.send({
        status: info.status,
        port: info.port,
        url: info.url,
        projectType: info.projectType,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Restart failed';
      return reply.status(500).send({ error: message });
    }
  });

  // Preview agent files — serves files from agent's targetDir
  app.get<{ Params: { id: string; '*': string } }>('/api/projects/:id/agent/preview/*', async (request, reply) => {
    const projectId = request.params.id;
    const filePath = request.params['*'];

    // Get targetDir from active session or latest DB session
    const agent = agentRunner.getSession(projectId);
    const targetDir = agent?.targetDir
      ?? agentRunner.getSessionFromDb(projectId)?.targetDir;

    if (!targetDir) {
      return reply.status(404).send({ error: 'No agent session found' });
    }

    // Path traversal protection
    const requested = normalize(resolve(targetDir, filePath));
    const rel = relative(targetDir, requested);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return reply.status(403).send({ error: 'Path traversal denied' });
    }

    try {
      const fileStat = await stat(requested);
      if (!fileStat.isFile()) {
        return reply.status(404).send({ error: 'Not a file' });
      }

      const ext = extname(requested).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

      // For HTML files, inject the visual editor script before </body>
      if (ext === '.html') {
        let html = await readFile(requested, 'utf-8');
        if (!html.includes('data-voltron-editor')) {
          if (html.includes('</body>')) {
            html = html.replace('</body>', EDITOR_SCRIPT + '\n</body>');
          } else {
            html += EDITOR_SCRIPT;
          }
        }
        return reply
          .header('Content-Type', contentType)
          .header('Cache-Control', 'no-cache')
          .send(html);
      }

      const content = await readFile(requested);
      return reply
        .header('Content-Type', contentType)
        .header('Cache-Control', 'no-cache')
        .send(content);
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
  });

  // List files in agent's targetDir
  app.get<{ Params: { id: string } }>('/api/projects/:id/agent/files', async (request, reply) => {
    const projectId = request.params.id;
    const agent = agentRunner.getSession(projectId);
    const targetDir = agent?.targetDir
      ?? agentRunner.getSessionFromDb(projectId)?.targetDir;

    if (!targetDir) {
      return reply.status(404).send({ error: 'No agent session found' });
    }

    try {
      const entries = await readdir(targetDir, { withFileTypes: true, recursive: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => {
          const fullPath = resolve(e.parentPath ?? e.path, e.name);
          return relative(targetDir, fullPath);
        })
        .sort();
      return reply.send({ targetDir, files });
    } catch {
      return reply.send({ targetDir, files: [] });
    }
  });
}
