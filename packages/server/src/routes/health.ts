import type { FastifyInstance } from 'fastify';
import type { Broadcaster } from '../ws/broadcaster.js';
import type { AgentRunner } from '../services/agent-runner.js';
import { getDb } from '../db/connection.js';

interface HealthDeps {
  broadcaster?: Broadcaster;
  agentRunner?: AgentRunner;
}

export async function healthRoutes(app: FastifyInstance, deps?: HealthDeps): Promise<void> {
  // Liveness probe — fast, minimal
  app.get('/api/health', async (_request, reply) => {
    return reply.send({
      status: 'healthy',
      service: 'voltron',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  // Readiness probe — detailed checks for Docker/k8s/monitoring
  app.get('/api/ready', async (_request, reply) => {
    const checks: Record<string, { status: string; [key: string]: unknown }> = {};
    let allOk = true;

    // DB check
    try {
      const db = getDb();
      const start = performance.now();
      db.prepare('SELECT 1').get();
      const responseMs = Math.round((performance.now() - start) * 100) / 100;
      checks.database = { status: 'ok', responseMs };
    } catch {
      checks.database = { status: 'error', error: 'Database unreachable' };
      allOk = false;
    }

    // WebSocket check
    if (deps?.broadcaster) {
      try {
        const stats = deps.broadcaster.getStats();
        checks.websocket = { status: 'ok', connections: stats.total };
      } catch {
        checks.websocket = { status: 'error', error: 'Broadcaster unavailable' };
        allOk = false;
      }
    } else {
      checks.websocket = { status: 'ok', connections: 0 };
    }

    // Agent check
    if (deps?.agentRunner) {
      try {
        const running = deps.agentRunner.getRunningCount();
        checks.agents = { status: 'ok', running };
      } catch {
        checks.agents = { status: 'ok', running: 0 };
      }
    } else {
      checks.agents = { status: 'ok', running: 0 };
    }

    const status = allOk ? 'ready' : 'degraded';
    const statusCode = allOk ? 200 : 503;

    return reply.status(statusCode).send({
      status,
      checks,
      version: '0.1.0',
      uptime: Math.round(process.uptime() * 100) / 100,
    });
  });
}
