import { setup, assign, createActor, type AnyActorRef } from 'xstate';
import type { RiskLevel } from '@voltron/shared';
import { ExecutionStateRepository } from '../db/repositories/execution-state.js';
import { StateHistoryRepository } from '../db/repositories/state-history.js';
import { EventBus } from './event-bus.js';

interface ExecutionContext {
  lastSnapshotId: string | null;
  lastActionEventId: string | null;
  pendingActions: number;
  stoppedAt: number | null;
  stopReason: string | null;
  errorMessage: string | null;
  errorTimestamp: number | null;
  totalActionsProcessed: number;
  sessionStartedAt: number | null;
  autoStopRiskThreshold: RiskLevel;
  rateLimit: number;
  agentSessionId: string | null;
}

type ExecutionEvent =
  | { type: 'ACTION_EVENT'; snapshotId: string; eventId: string }
  | { type: 'ACTION_COMPLETE' }
  | { type: 'ALL_ACTIONS_COMPLETE' }
  | { type: 'STOP_CMD'; reason: string; timestamp: number }
  | { type: 'AUTO_STOP'; reason: string; timestamp: number }
  | { type: 'CONTINUE_CMD' }
  | { type: 'RESET_CMD' }
  | { type: 'RESUME_COMPLETE' }
  | { type: 'ERROR_OCCURRED'; message: string }
  | { type: 'AGENT_SPAWNED'; sessionId: string }
  | { type: 'AGENT_COMPLETED'; sessionId: string }
  | { type: 'AGENT_CRASHED'; sessionId: string; error: string };

export const executionMachine = setup({
  types: {
    context: {} as ExecutionContext,
    events: {} as ExecutionEvent,
  },
}).createMachine({
  id: 'voltron-execution',
  initial: 'idle',
  context: {
    lastSnapshotId: null,
    lastActionEventId: null,
    pendingActions: 0,
    stoppedAt: null,
    stopReason: null,
    errorMessage: null,
    errorTimestamp: null,
    totalActionsProcessed: 0,
    sessionStartedAt: null,
    autoStopRiskThreshold: 'CRITICAL',
    rateLimit: 50,
    agentSessionId: null,
  },
  states: {
    idle: {
      on: {
        ACTION_EVENT: {
          target: 'running',
          actions: assign({
            lastSnapshotId: ({ event }) => event.snapshotId,
            lastActionEventId: ({ event }) => event.eventId,
            pendingActions: 1,
            totalActionsProcessed: ({ context }) => context.totalActionsProcessed + 1,
            sessionStartedAt: () => Date.now(),
          }),
        },
        AGENT_SPAWNED: {
          target: 'running',
          actions: assign({
            agentSessionId: ({ event }) => event.sessionId,
            sessionStartedAt: () => Date.now(),
          }),
        },
      },
    },
    running: {
      on: {
        ACTION_EVENT: {
          actions: assign({
            lastSnapshotId: ({ event }) => event.snapshotId,
            lastActionEventId: ({ event }) => event.eventId,
            pendingActions: ({ context }) => context.pendingActions + 1,
            totalActionsProcessed: ({ context }) => context.totalActionsProcessed + 1,
          }),
        },
        ACTION_COMPLETE: {
          actions: assign({
            pendingActions: ({ context }) => Math.max(0, context.pendingActions - 1),
          }),
        },
        ALL_ACTIONS_COMPLETE: {
          target: 'idle',
          actions: assign({ pendingActions: 0 }),
        },
        STOP_CMD: {
          target: 'stopped',
          actions: assign({
            stoppedAt: ({ event }) => event.timestamp,
            stopReason: ({ event }) => event.reason,
          }),
        },
        AUTO_STOP: {
          target: 'stopped',
          actions: assign({
            stoppedAt: ({ event }) => event.timestamp,
            stopReason: ({ event }) => event.reason,
          }),
        },
        ERROR_OCCURRED: {
          target: 'error',
          actions: assign({
            errorMessage: ({ event }) => event.message,
            errorTimestamp: () => Date.now(),
          }),
        },
        AGENT_COMPLETED: {
          target: 'idle',
          actions: assign({
            agentSessionId: null,
          }),
        },
        AGENT_CRASHED: {
          target: 'error',
          actions: assign({
            errorMessage: ({ event }) => event.error,
            errorTimestamp: () => Date.now(),
            agentSessionId: null,
          }),
        },
      },
    },
    stopped: {
      on: {
        CONTINUE_CMD: { target: 'resuming' },
        RESET_CMD: {
          target: 'idle',
          actions: assign({
            stoppedAt: null,
            stopReason: null,
            errorMessage: null,
            errorTimestamp: null,
            pendingActions: 0,
          }),
        },
      },
    },
    resuming: {
      on: {
        RESUME_COMPLETE: {
          target: 'running',
          actions: assign({ stoppedAt: null, stopReason: null }),
        },
        STOP_CMD: {
          target: 'stopped',
          actions: assign({
            stoppedAt: ({ event }) => event.timestamp,
            stopReason: ({ event }) => event.reason,
          }),
        },
        ERROR_OCCURRED: {
          target: 'error',
          actions: assign({
            errorMessage: ({ event }) => event.message,
            errorTimestamp: () => Date.now(),
          }),
        },
      },
    },
    error: {
      on: {
        RESET_CMD: {
          target: 'idle',
          actions: assign({
            stoppedAt: null,
            stopReason: null,
            errorMessage: null,
            errorTimestamp: null,
            pendingActions: 0,
          }),
        },
        CONTINUE_CMD: { target: 'resuming' },
      },
    },
  },
});

export class StateMachineService {
  private actors = new Map<string, AnyActorRef>();
  private stateRepo = new ExecutionStateRepository();
  private historyRepo = new StateHistoryRepository();

  constructor(private eventBus: EventBus) {}

  getOrCreate(projectId: string): AnyActorRef {
    let actor = this.actors.get(projectId);
    if (actor) return actor;

    // Try restoring from DB
    const persisted = this.stateRepo.findByProject(projectId);
    if (persisted) {
      try {
        const snapshot = JSON.parse(persisted.stateJson);
        actor = createActor(executionMachine, { snapshot });
      } catch {
        actor = createActor(executionMachine);
      }
    } else {
      actor = createActor(executionMachine);
    }

    actor.subscribe((state) => {
      this.persistState(projectId, state);
      this.eventBus.emit('STATE_CHANGE', {
        projectId,
        state: String(state.value).toUpperCase(),
        context: state.context,
      });
    });

    actor.start();
    this.actors.set(projectId, actor);
    return actor;
  }

  send(projectId: string, event: ExecutionEvent, triggeredBy = 'system'): void {
    const actor = this.getOrCreate(projectId);
    const fromState = String(actor.getSnapshot().value).toUpperCase();
    actor.send(event);
    const toState = String(actor.getSnapshot().value).toUpperCase();

    if (fromState !== toState) {
      this.historyRepo.insert({
        projectId,
        fromState,
        toState,
        triggerEvent: event.type,
        triggeredBy,
        snapshotId: ('snapshotId' in event ? event.snapshotId : null) as string | null,
      });
    }
  }

  getState(projectId: string): { state: string; context: ExecutionContext } {
    const actor = this.getOrCreate(projectId);
    const snapshot = actor.getSnapshot();
    return {
      state: String(snapshot.value).toUpperCase() as string,
      context: snapshot.context as ExecutionContext,
    };
  }

  getHistory(projectId: string, limit = 50) {
    return this.historyRepo.findByProject(projectId, limit);
  }

  private persistState(projectId: string, state: { value: unknown; context: unknown }): void {
    try {
      const ctx = state.context as ExecutionContext;
      this.stateRepo.upsert({
        projectId,
        stateJson: JSON.stringify(state),
        lastSnapshotId: ctx.lastSnapshotId,
        lastEventId: ctx.lastActionEventId,
        stoppedAt: ctx.stoppedAt,
        errorMessage: ctx.errorMessage,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to persist state:', err);
    }
  }
}
