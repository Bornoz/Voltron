import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async (_request, reply) => {
    return reply.send({
      status: 'healthy',
      service: 'voltron',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });
}
