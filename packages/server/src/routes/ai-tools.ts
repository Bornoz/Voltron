import type { FastifyInstance } from 'fastify';
import type { AiDetector } from '../services/ai-detector.js';

export function aiToolRoutes(app: FastifyInstance, detector: AiDetector): void {
  // Get detected AI tools (from cache, or trigger scan if not yet done)
  app.get('/api/ai-tools', async (_request, reply) => {
    let result = detector.getCached();
    if (!result) {
      result = await detector.scan();
    }
    return reply.send(result);
  });

  // Force a rescan of all AI tools
  app.post('/api/ai-tools/rescan', async (_request, reply) => {
    if (detector.isScanning) {
      return reply.status(409).send({ error: 'Scan already in progress' });
    }
    const result = await detector.rescan();
    return reply.send(result);
  });
}
