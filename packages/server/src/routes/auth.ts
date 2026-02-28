import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createToken, verifyToken } from '../plugins/auth.js';
import { getDb } from '../db/connection.js';
import type { ServerConfig } from '../config.js';

const LoginBody = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

const RegisterBody = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(6).max(200),
});

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
});

/* ─── Password Hashing (scrypt) ─── */

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, 'hex');
  const derivedBuf = scryptSync(password, salt, 64);
  if (hashBuf.length !== derivedBuf.length) return false;
  return timingSafeEqual(hashBuf, derivedBuf);
}

/* ─── Legacy env-var comparison ─── */

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ─── Rate Limiter ─── */

const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW_MS = 60_000;

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.windowStart >= LOGIN_RATE_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  return entry.count <= LOGIN_RATE_LIMIT;
}

/* ─── DB Helpers ─── */

function getUserCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number } | undefined;
  return row?.cnt ?? 0;
}

function getUserByUsername(username: string): { id: string; username: string; password_hash: string; role: string } | undefined {
  const db = getDb();
  return db.prepare('SELECT id, username, password_hash, role FROM users WHERE username = ?').get(username) as any;
}

/* ─── Routes ─── */

export function authRoutes(app: FastifyInstance, config: ServerConfig): void {
  // whoami: if the request reaches here, any upstream auth was passed
  app.get('/api/auth/whoami', async (_request, reply) => {
    return reply.send({ authenticated: true, timestamp: Date.now() });
  });

  // setup-required: check if first-time setup is needed (public endpoint)
  app.get('/api/auth/setup-required', async (_request, reply) => {
    const userCount = getUserCount();
    // Setup is required if no DB users AND no env-var admin configured
    const hasEnvAdmin = !!(config.adminUser && config.adminPass);
    return reply.send({ setupRequired: userCount === 0 && !hasEnvAdmin });
  });

  if (!config.authSecret) return;

  // Register: first-time admin creation (only works when no users exist in DB)
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request. Username min 3 chars, password min 6 chars.' });
    }

    const userCount = getUserCount();
    if (userCount > 0) {
      return reply.status(403).send({ error: 'Registration is disabled. Admin account already exists.' });
    }

    // Also block if env-var admin is configured
    if (config.adminUser && config.adminPass) {
      return reply.status(403).send({ error: 'Registration is disabled. Admin configured via environment.' });
    }

    const { username, password } = parsed.data;
    const db = getDb();
    const now = Date.now();
    const id = randomUUID();
    const passwordHash = hashPassword(password);

    db.prepare(
      'INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, username, passwordHash, 'admin', now, now);

    app.log.info(`First admin user registered: ${username}`);

    const { token, expiresAt } = createToken(username, config.authSecret);
    return reply.send({ token, expiresAt, username });
  });

  // Login: check DB first, then fall back to env vars
  app.post('/api/auth/login', async (request, reply) => {
    const ip = request.ip ?? 'unknown';
    if (!checkLoginRateLimit(ip)) {
      return reply.status(429).send({ error: 'Too many login attempts. Try again later.' });
    }

    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const { username, password } = parsed.data;

    // Strategy 1: Check database users
    const dbUser = getUserByUsername(username);
    if (dbUser) {
      if (verifyPassword(password, dbUser.password_hash)) {
        const { token, expiresAt } = createToken(username, config.authSecret);
        return reply.send({ token, expiresAt });
      }
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Strategy 2: Fall back to env var admin (backwards compatibility)
    if (config.adminUser && config.adminPass) {
      const userOk = safeEqual(username, config.adminUser);
      const passOk = safeEqual(password, config.adminPass);

      if (userOk && passOk) {
        const { token, expiresAt } = createToken(username, config.authSecret);
        return reply.send({ token, expiresAt });
      }
    }

    return reply.status(401).send({ error: 'Invalid credentials' });
  });

  // Change password (requires authentication)
  app.post('/api/auth/change-password', async (request, reply) => {
    const user = (request as any).user;
    if (!user?.username) {
      return reply.status(401).send({ error: 'Authentication required' });
    }

    const parsed = ChangePasswordBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request. New password must be at least 6 characters.' });
    }

    const { currentPassword, newPassword } = parsed.data;

    // Check current password
    const dbUser = getUserByUsername(user.username);
    if (dbUser) {
      // DB user: verify current password
      if (!verifyPassword(currentPassword, dbUser.password_hash)) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // Update password
      const db = getDb();
      const newHash = hashPassword(newPassword);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, Date.now(), dbUser.id);
      app.log.info(`Password changed for user: ${user.username}`);
      return reply.send({ success: true });
    }

    // Env-var admin: verify against env var, then create DB record
    if (config.adminUser && config.adminPass) {
      if (!safeEqual(currentPassword, config.adminPass)) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // Migrate env-var admin to DB
      const db = getDb();
      const now = Date.now();
      const id = randomUUID();
      const newHash = hashPassword(newPassword);
      db.prepare(
        'INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, user.username, newHash, 'admin', now, now);

      app.log.info(`Env-var admin migrated to DB with new password: ${user.username}`);
      return reply.send({ success: true });
    }

    return reply.status(400).send({ error: 'Cannot change password for this account' });
  });
}
