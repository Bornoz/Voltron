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

export function authRoutes(app: FastifyInstance, config: ServerConfig): void {
  if (!config.authSecret) return;

  app.post('/api/auth/login', async (request, reply) => {
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
