import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.cause instanceof ZodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: (error.cause as ZodError).flatten(),
      });
    }

    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
    });
  });
}
