import type { FastifyInstance } from 'fastify';
import { StateMachineService } from '../services/state-machine.js';
import { Broadcaster } from '../ws/broadcaster.js';
import { CircuitBreaker } from '../services/rate-monitor.js';

export function controlRoutes(
  app: FastifyInstance,
  stateMachine: StateMachineService,
  broadcaster: Broadcaster,
  circuitBreaker: CircuitBreaker,
): void {
  app.post<{ Params: { id: string } }>('/api/projects/:id/control/stop', async (request, reply) => {
    const projectId = request.params.id;
    stateMachine.send(projectId, { type: 'STOP_CMD', reason: 'operator_api', timestamp: Date.now() }, 'api');
    broadcaster.broadcast('interceptor', projectId, {
      type: 'COMMAND_STOP', payload: { reason: 'operator' }, timestamp: Date.now(),
    });
    return reply.send(stateMachine.getState(projectId));
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/control/continue', async (request, reply) => {
    const projectId = request.params.id;
    stateMachine.send(projectId, { type: 'CONTINUE_CMD' }, 'api');
    setTimeout(() => stateMachine.send(projectId, { type: 'RESUME_COMPLETE' }, 'system'), 500);
    broadcaster.broadcast('interceptor', projectId, {
      type: 'COMMAND_CONTINUE', payload: {}, timestamp: Date.now(),
    });
    return reply.send(stateMachine.getState(projectId));
  });

  app.post<{ Params: { id: string } }>('/api/projects/:id/control/reset', async (request, reply) => {
    const projectId = request.params.id;
    stateMachine.send(projectId, { type: 'RESET_CMD' }, 'api');
    circuitBreaker.reset();
    return reply.send(stateMachine.getState(projectId));
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/control/state', async (request, reply) => {
    return reply.send(stateMachine.getState(request.params.id));
  });

  app.get<{ Params: { id: string } }>('/api/projects/:id/control/history', async (request, reply) => {
    return reply.send(stateMachine.getHistory(request.params.id));
  });
}
