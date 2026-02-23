import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { initDb } from './db/connection.js';
import { createSchema } from './db/schema.js';
import { registerCors } from './plugins/cors.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerRateLimiter } from './plugins/rate-limiter.js';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';
import { actionRoutes } from './routes/actions.js';
import { snapshotRoutes } from './routes/snapshots.js';
import { protectionRoutes } from './routes/protection.js';
import { controlRoutes } from './routes/control.js';
import { githubRoutes } from './routes/github.js';
import { behaviorRoutes } from './routes/behavior.js';
import { promptRoutes } from './routes/prompts.js';
import { agentRoutes } from './routes/agent.js';
import { createWsServices, registerWsHandler } from './ws/handler.js';
import { EventBus } from './services/event-bus.js';
import { AgentRunner } from './services/agent-runner.js';
import { SnapshotPruner } from './services/snapshot-pruner.js';
import { BehaviorScorer } from './services/behavior-scorer.js';
import type { ServerConfig } from './config.js';

export async function buildApp(config: ServerConfig) {
  // Database
  const db = initDb(config.dbPath);
  createSchema(db);

  // Fastify
  const app = Fastify({
    logger: {
      level: config.logLevel,
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Plugins
  await registerCors(app, config);
  await app.register(websocket);
  registerErrorHandler(app);
  registerRateLimiter(app, { max: 200, windowMs: 60_000 });

  // Services
  const eventBus = new EventBus();
  const agentRunner = new AgentRunner(eventBus, config.claudePath);
  const wsServices = createWsServices(config, eventBus, agentRunner);
  const snapshotPruner = new SnapshotPruner();
  const behaviorScorer = new BehaviorScorer();

  // Routes
  await app.register(healthRoutes);
  await app.register(projectRoutes);
  await app.register(actionRoutes);
  await app.register(snapshotRoutes);
  await app.register(protectionRoutes);
  controlRoutes(app, wsServices.stateMachine, wsServices.broadcaster, wsServices.circuitBreaker);
  githubRoutes(app, config, agentRunner);
  behaviorRoutes(app, behaviorScorer);
  promptRoutes(app);
  agentRoutes(app, agentRunner);

  // WebSocket
  registerWsHandler(app, config, wsServices);

  // Stats endpoint
  app.get('/api/stats', async (_request, reply) => {
    return reply.send({
      ws: wsServices.broadcaster.getStats(),
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  app.get('/api/sessions', async (_request, reply) => {
    return reply.send(wsServices.sessionRepo.getActive());
  });

  // Interceptor status per project - used by dashboard to show AI agent activity
  app.get<{ Params: { id: string } }>('/api/projects/:id/interceptor/status', async (request, reply) => {
    const connections = wsServices.broadcaster.getConnectionCounts();
    const projectConns = connections.byProject[request.params.id];
    const controlState = wsServices.stateMachine.getState(request.params.id);
    const circuitRate = wsServices.circuitBreaker.getCurrentRate();

    return reply.send({
      interceptorConnected: (projectConns?.interceptors ?? 0) > 0,
      dashboardConnected: (projectConns?.dashboards ?? 0) > 0,
      simulatorConnected: (projectConns?.simulators ?? 0) > 0,
      totalConnections: projectConns?.total ?? 0,
      executionState: controlState?.state ?? 'IDLE',
      currentRate: circuitRate,
      timestamp: Date.now(),
    });
  });

  // Start background services
  snapshotPruner.start();
  behaviorScorer.start();

  // Cleanup on shutdown
  app.addHook('onClose', async () => {
    snapshotPruner.stop();
    behaviorScorer.stop();
  });

  return { app, eventBus, wsServices, agentRunner };
}
