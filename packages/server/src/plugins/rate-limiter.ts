import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface RateLimitConfig {
  max: number;       // max requests per window
  windowMs: number;  // window in milliseconds
}

const DEFAULT_CONFIG: RateLimitConfig = {
  max: 100,
  windowMs: 60_000, // 100 req/min per IP
};

// In-memory sliding window rate limiter
const windows = new Map<string, number[]>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of windows) {
    const filtered = timestamps.filter((t) => now - t < DEFAULT_CONFIG.windowMs);
    if (filtered.length === 0) {
      windows.delete(key);
    } else {
      windows.set(key, filtered);
    }
  }
}, 300_000);

export function registerRateLimiter(app: FastifyInstance, config: RateLimitConfig = DEFAULT_CONFIG): void {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip health checks and WebSocket upgrades
    if (request.url === '/api/health' || request.url === '/ws') return;

    const ip = request.ip || 'unknown';
    const now = Date.now();

    let timestamps = windows.get(ip);
    if (!timestamps) {
      timestamps = [];
      windows.set(ip, timestamps);
    }

    // Remove expired entries
    const windowStart = now - config.windowMs;
    while (timestamps.length > 0 && timestamps[0] < windowStart) {
      timestamps.shift();
    }

    if (timestamps.length >= config.max) {
      reply.header('Retry-After', Math.ceil(config.windowMs / 1000));
      reply.header('X-RateLimit-Limit', config.max);
      reply.header('X-RateLimit-Remaining', 0);
      return reply.status(429).send({
        error: 'Too many requests',
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    }

    timestamps.push(now);
    reply.header('X-RateLimit-Limit', config.max);
    reply.header('X-RateLimit-Remaining', config.max - timestamps.length);
  });
}
