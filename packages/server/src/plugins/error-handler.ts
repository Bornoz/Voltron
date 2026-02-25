import type { FastifyInstance, FastifyError } from 'fastify';
import { ZodError } from 'zod';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    // ZodError may arrive directly or as cause depending on Fastify version
    const zodError =
      error instanceof ZodError
        ? error
        : error.cause instanceof ZodError
          ? (error.cause as ZodError)
          : null;

    if (zodError) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: zodError.flatten(),
      });
    }

    app.log.error(error);

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
    });
  });
}
