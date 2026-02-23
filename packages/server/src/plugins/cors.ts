import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { ServerConfig } from '../config.js';

export async function registerCors(app: FastifyInstance, config: ServerConfig): Promise<void> {
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
}
