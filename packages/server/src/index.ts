import { loadConfig } from './config.js';
import { buildApp } from './app.js';
import { closeDb, performBackup } from './db/connection.js';

async function main() {
  const config = loadConfig();
  const { app, wsServices, agentRunner } = await buildApp(config);

  let isShuttingDown = false;

  // Graceful shutdown with full cleanup
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return; // Prevent double shutdown
    isShuttingDown = true;

    app.log.info(`${signal} received, initiating graceful shutdown...`);

    // Phase 0: Shutdown all running agents
    app.log.info('Shutting down running agents...');
    await agentRunner.shutdownAll();

    // Phase 1: Notify all WS clients with 1001 "Going Away"
    app.log.info('Closing WebSocket connections...');
    const { broadcaster } = wsServices;
    const allClients = [
      ...broadcaster.getClientsByType('interceptor'),
      ...broadcaster.getClientsByType('dashboard'),
      ...broadcaster.getClientsByType('simulator'),
    ];
    for (const client of allClients) {
      try {
        client.ws.close(1001, 'Server shutting down');
      } catch {
        // Client may already be disconnected
      }
    }

    // Phase 2: Wait for pending events to drain (max 5s)
    app.log.info('Draining pending events (max 5s)...');
    const drainStart = Date.now();
    const DRAIN_TIMEOUT_MS = 5000;
    await new Promise<void>((resolve) => {
      const checkDrain = () => {
        const elapsed = Date.now() - drainStart;
        // Check if all clients have disconnected or timeout reached
        const stats = broadcaster.getStats();
        if (stats.total === 0 || elapsed >= DRAIN_TIMEOUT_MS) {
          if (elapsed >= DRAIN_TIMEOUT_MS && stats.total > 0) {
            app.log.warn(`Drain timeout reached with ${stats.total} clients still connected. Forcing close.`);
          }
          resolve();
          return;
        }
        setTimeout(checkDrain, 100);
      };
      checkDrain();
    });

    // Phase 3: Close Fastify (HTTP + remaining WS)
    app.log.info('Closing Fastify server...');
    await app.close();

    // Phase 4: Final DB backup before close
    app.log.info('Performing final DB backup...');
    performBackup();

    // Phase 5: Close SQLite connection cleanly
    app.log.info('Closing database connection...');
    closeDb();

    app.log.info('Graceful shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors - attempt graceful shutdown
  process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught exception:', err);
    shutdown('UNCAUGHT_EXCEPTION').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled rejection:', reason);
    shutdown('UNHANDLED_REJECTION').catch(() => process.exit(1));
  });

  // Listen with retry for EADDRINUSE (port still in TIME_WAIT from previous process)
  const MAX_LISTEN_RETRIES = 5;
  const LISTEN_RETRY_DELAY_MS = 3000;
  try {
    for (let attempt = 1; attempt <= MAX_LISTEN_RETRIES; attempt++) {
      try {
        await app.listen({ port: config.port, host: config.host });
        break; // success
      } catch (listenErr: unknown) {
        const isAddrInUse = listenErr instanceof Error && 'code' in listenErr && (listenErr as NodeJS.ErrnoException).code === 'EADDRINUSE';
        if (isAddrInUse && attempt < MAX_LISTEN_RETRIES) {
          app.log.warn(`Port ${config.port} in use (attempt ${attempt}/${MAX_LISTEN_RETRIES}), retrying in ${LISTEN_RETRY_DELAY_MS}ms...`);
          await new Promise((r) => setTimeout(r, LISTEN_RETRY_DELAY_MS));
        } else {
          throw listenErr;
        }
      }
    }

    // Startup banner
    const banner = [
      '',
      '  ╔══════════════════════════════════════╗',
      '  ║     VOLTRON — AI Operation Center    ║',
      '  ╚══════════════════════════════════════╝',
      '',
      `  Version   : 0.1.0`,
      `  Port      : ${config.port}`,
      `  Host      : ${config.host}`,
      `  DB        : ${config.dbPath}`,
      `  Log Level : ${config.logLevel}`,
      `  ENV       : ${process.env.NODE_ENV ?? 'development'}`,
      `  Secret    : ${config.interceptorSecret ? '***configured***' : '(none)'}`,
      `  GitHub    : ${config.githubToken ? '***configured***' : '(none)'}`,
      `  Claude    : ${config.claudePath}`,
      '',
    ];
    for (const line of banner) {
      app.log.info(line);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
