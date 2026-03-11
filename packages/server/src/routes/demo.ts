import type { FastifyInstance } from 'fastify';
import { DemoRunner } from '../services/demo-runner.js';
import type { Broadcaster } from '../ws/broadcaster.js';

export function demoRoutes(app: FastifyInstance, broadcaster: Broadcaster): void {
  let demoRunner: DemoRunner | null = null;

  // Start demo mode
  app.post('/api/demo/start', async (_request, reply) => {
    if (demoRunner?.isRunning) {
      return reply.status(409).send({ error: 'Demo already running', sessionId: demoRunner.sessionId });
    }

    demoRunner = new DemoRunner(broadcaster);
    const sessionId = demoRunner.start(() => {
      // Auto-cleanup on complete
      demoRunner = null;
    });

    return reply.send({ running: true, sessionId, status: 'running', phase: demoRunner.phase });
  });

  // Stop demo mode
  app.post('/api/demo/stop', async (_request, reply) => {
    if (!demoRunner?.isRunning) {
      return reply.status(404).send({ error: 'No demo running' });
    }

    demoRunner.stop();
    demoRunner = null;
    return reply.send({ status: 'stopped' });
  });

  // Get demo status
  app.get('/api/demo/status', async (_request, reply) => {
    return reply.send({
      running: demoRunner?.isRunning ?? false,
      phase: demoRunner?.phase ?? 'idle',
      sessionId: demoRunner?.sessionId ?? null,
    });
  });
}
