import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { initDb } from './db/connection.js';
import { createSchema } from './db/schema.js';
import { registerCors } from './plugins/cors.js';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerRateLimiter } from './plugins/rate-limiter.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { actionRoutes } from './routes/actions.js';
import { snapshotRoutes } from './routes/snapshots.js';
import { protectionRoutes } from './routes/protection.js';
import { controlRoutes } from './routes/control.js';
import { githubRoutes } from './routes/github.js';
import { behaviorRoutes } from './routes/behavior.js';
import { promptRoutes } from './routes/prompts.js';
import { agentRoutes } from './routes/agent.js';
import { projectSettingsRoutes } from './routes/project-settings.js';
import { uploadRoutes } from './routes/uploads.js';
import { smartSetupRoutes } from './routes/smart-setup.js';
import { createWsServices, registerWsHandler } from './ws/handler.js';
import { EventBus } from './services/event-bus.js';
import { AgentRunner } from './services/agent-runner.js';
import { DevServerManager } from './services/dev-server-manager.js';
import { SnapshotPruner } from './services/snapshot-pruner.js';
import { BehaviorScorer } from './services/behavior-scorer.js';
import type { ServerConfig } from './config.js';

export async function buildApp(config: ServerConfig) {
  // Database
  const db = initDb(config.dbPath);
  createSchema(db);

  // Fastify
  const app = Fastify({
    bodyLimit: 1_048_576, // 1 MiB
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
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  registerAuth(app, config);
  registerErrorHandler(app);
  registerRateLimiter(app, { max: 200, windowMs: 60_000 });

  // Services
  const eventBus = new EventBus(app.log);
  const devServerManager = new DevServerManager(eventBus);
  const agentRunner = new AgentRunner(eventBus, config.claudePath, devServerManager);
  const wsServices = createWsServices(config, eventBus, agentRunner);
  const snapshotPruner = new SnapshotPruner();
  const behaviorScorer = new BehaviorScorer();

  // Auth routes (before protected routes, after auth middleware)
  authRoutes(app, config);

  // Routes
  await app.register((instance) => healthRoutes(instance, { broadcaster: wsServices.broadcaster, agentRunner }));
  await app.register(projectRoutes);
  await app.register(actionRoutes);
  await app.register(snapshotRoutes);
  await app.register(protectionRoutes);
  controlRoutes(app, wsServices.stateMachine, wsServices.broadcaster, wsServices.circuitBreaker);
  githubRoutes(app, config, agentRunner);
  behaviorRoutes(app, behaviorScorer);
  promptRoutes(app);
  agentRoutes(app, agentRunner, devServerManager);
  projectSettingsRoutes(app);
  uploadRoutes(app);
  smartSetupRoutes(app, config.githubToken);

  // Serve dashboard static files in production
  const dashboardDist = resolve(import.meta.dirname, '../../dashboard/dist');
  if (existsSync(dashboardDist)) {
    await app.register(fastifyStatic, {
      root: dashboardDist,
      prefix: '/',
      decorateReply: false,
      wildcard: false,
    });

    // SPA fallback: serve index.html for all non-API, non-WS routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/ws')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html', dashboardDist);
    });
  }

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
    await devServerManager.stopAll();
  });

  return { app, eventBus, wsServices, agentRunner };
}
