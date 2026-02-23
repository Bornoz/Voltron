import { loadConfig } from './config.js';
import { Interceptor } from './interceptor.js';

async function main() {
  const config = loadConfig();
  const interceptor = new Interceptor(config);

  const shutdown = async () => {
    console.log('[interceptor] Shutting down...');
    await interceptor.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await interceptor.start();
}

main().catch((err) => {
  console.error('[interceptor] Fatal error:', err);
  process.exit(1);
});
