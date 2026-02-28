import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { ServerConfig } from '../config.js';

const PUBLIC_PATHS = new Set(['/api/health', '/api/ready', '/api/auth/login', '/api/auth/register', '/api/auth/setup-required', '/api/auth/whoami', '/api/stats', '/health']);

interface TokenPayload {
  username: string;
  iat: number; // issued at (ms)
}

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createToken(username: string, secret: string): { token: string; expiresAt: number } {
  const iat = Date.now();
  const payload = Buffer.from(JSON.stringify({ username, iat } satisfies TokenPayload)).toString('base64url');
  const signature = sign(payload, secret);
  const token = `${payload}.${signature}`;
  return { token, expiresAt: iat + TOKEN_EXPIRY_MS };
}

export function verifyToken(token: string, secret: string): TokenPayload | null {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;

  const payload = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);

  const expected = sign(payload, secret);

  // Timing-safe comparison
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenPayload;

    // Check expiry
    if (Date.now() - decoded.iat > TOKEN_EXPIRY_MS) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

export function registerAuth(app: FastifyInstance, config: ServerConfig): void {
  if (!config.authSecret) {
    app.log.warn('VOLTRON_AUTH_SECRET not set — authentication is DISABLED (dev mode)');
    return;
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip WebSocket upgrade requests (WS has its own auth in handler.ts)
    if (request.headers.upgrade?.toLowerCase() === 'websocket') return;

    // Skip public paths
    const path = request.url.split('?')[0];
    if (PUBLIC_PATHS.has(path)) return;

    // Skip non-API requests (static files served by @fastify/static)
    if (!path.startsWith('/api/')) return;

    const authHeader = request.headers.authorization;
    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      // Fallback: accept token from query parameter (needed for iframe src loads)
      const queryToken = (request.query as Record<string, unknown>)?.token;
      if (typeof queryToken === 'string' && queryToken.length > 0) {
        token = queryToken;
      }
    }

    if (!token) {
      return reply.status(401).send({ error: 'Authentication required' });
    }
    const payload = verifyToken(token, config.authSecret);
    if (!payload) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }

    // Attach user info to request for downstream use
    (request as any).user = payload;
  });
}
