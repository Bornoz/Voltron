import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createToken } from '../plugins/auth.js';
import type { ServerConfig } from '../config.js';

const LoginBody = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Per-IP login rate limiter: max 5 attempts per 60 seconds
const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 60_000;

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart >= LOGIN_RATE_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }
  entry.count++;
  return entry.count <= LOGIN_RATE_LIMIT;
}

export function authRoutes(app: FastifyInstance, config: ServerConfig): void {
  // whoami: if the request reaches here, any upstream auth (e.g. nginx basic) was passed
  app.get('/api/auth/whoami', async (_request, reply) => {
    return reply.send({ authenticated: true, timestamp: Date.now() });
  });

  if (!config.authSecret) return;

  app.post('/api/auth/login', async (request, reply) => {
    // Rate limiting per IP
    const ip = request.ip ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      return reply.status(429).send({ error: 'Too many login attempts. Try again later.' });
    }

    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const { username, password } = parsed.data;

    if (!config.adminUser || !config.adminPass) {
      return reply.status(503).send({ error: 'Admin credentials not configured' });
    }

    const userOk = safeEqual(username, config.adminUser);
    const passOk = safeEqual(password, config.adminPass);

    if (!userOk || !passOk) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const { token, expiresAt } = createToken(username, config.authSecret);
    return reply.send({ token, expiresAt });
  });
}
