import { describe, it, expect, beforeEach } from 'vitest';
import { createActor } from 'xstate';
import { executionMachine } from '../state-machine.js';

function createTestActor() {
  const actor = createActor(executionMachine);
  actor.start();
  return actor;
}

describe('executionMachine', () => {
  let actor: ReturnType<typeof createTestActor>;

  beforeEach(() => {
    actor = createTestActor();
  });

  // ─── Initial State ──────────────────────────────────────────

  describe('initial state', () => {
    it('should start in idle state', () => {
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('should have correct initial context', () => {
      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingActions).toBe(0);
      expect(ctx.totalActionsProcessed).toBe(0);
      expect(ctx.lastSnapshotId).toBeNull();
      expect(ctx.lastActionEventId).toBeNull();
      expect(ctx.stoppedAt).toBeNull();
      expect(ctx.stopReason).toBeNull();
      expect(ctx.errorMessage).toBeNull();
      expect(ctx.errorTimestamp).toBeNull();
      expect(ctx.sessionStartedAt).toBeNull();
      expect(ctx.autoStopRiskThreshold).toBe('CRITICAL');
      expect(ctx.rateLimit).toBe(50);
      expect(ctx.agentSessionId).toBeNull();
    });
  });

  // ─── IDLE → RUNNING ────────────────────────────────────────

  describe('idle → running', () => {
    it('should transition on ACTION_EVENT', () => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
      expect(actor.getSnapshot().value).toBe('running');
    });

    it('should set context on ACTION_EVENT', () => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
      const ctx = actor.getSnapshot().context;
      expect(ctx.lastSnapshotId).toBe('snap-1');
      expect(ctx.lastActionEventId).toBe('evt-1');
      expect(ctx.pendingActions).toBe(1);
      expect(ctx.totalActionsProcessed).toBe(1);
      expect(ctx.sessionStartedAt).toBeTypeOf('number');
    });

    it('should transition on AGENT_SPAWNED', () => {
      actor.send({ type: 'AGENT_SPAWNED', sessionId: 'sess-1' });
      expect(actor.getSnapshot().value).toBe('running');
      expect(actor.getSnapshot().context.agentSessionId).toBe('sess-1');
      expect(actor.getSnapshot().context.sessionStartedAt).toBeTypeOf('number');
    });

    it('should ignore STOP_CMD in idle state', () => {
      actor.send({ type: 'STOP_CMD', reason: 'test', timestamp: Date.now() });
      expect(actor.getSnapshot().value).toBe('idle');
    });
  });

  // ─── RUNNING State Behavior ────────────────────────────────

  describe('running state', () => {
    beforeEach(() => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
    });

    it('should accumulate pending actions', () => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-2', eventId: 'evt-2' });
      expect(actor.getSnapshot().context.pendingActions).toBe(2);
      expect(actor.getSnapshot().context.totalActionsProcessed).toBe(2);
    });

    it('should decrement pending on ACTION_COMPLETE', () => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-2', eventId: 'evt-2' });
      actor.send({ type: 'ACTION_COMPLETE' });
      expect(actor.getSnapshot().context.pendingActions).toBe(1);
    });

    it('should not go below 0 pending actions', () => {
      actor.send({ type: 'ACTION_COMPLETE' });
      actor.send({ type: 'ACTION_COMPLETE' });
      expect(actor.getSnapshot().context.pendingActions).toBe(0);
    });

    it('should return to idle on ALL_ACTIONS_COMPLETE', () => {
      actor.send({ type: 'ALL_ACTIONS_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.pendingActions).toBe(0);
    });

    it('should update snapshot/event IDs on subsequent ACTION_EVENT', () => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-2', eventId: 'evt-2' });
      const ctx = actor.getSnapshot().context;
      expect(ctx.lastSnapshotId).toBe('snap-2');
      expect(ctx.lastActionEventId).toBe('evt-2');
    });
  });

  // ─── RUNNING → STOPPED ────────────────────────────────────

  describe('running → stopped', () => {
    beforeEach(() => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
    });

    it('should transition on STOP_CMD', () => {
      const ts = Date.now();
      actor.send({ type: 'STOP_CMD', reason: 'manual stop', timestamp: ts });
      expect(actor.getSnapshot().value).toBe('stopped');
      expect(actor.getSnapshot().context.stoppedAt).toBe(ts);
      expect(actor.getSnapshot().context.stopReason).toBe('manual stop');
    });

    it('should transition on AUTO_STOP', () => {
      const ts = Date.now();
      actor.send({ type: 'AUTO_STOP', reason: 'risk threshold', timestamp: ts });
      expect(actor.getSnapshot().value).toBe('stopped');
      expect(actor.getSnapshot().context.stopReason).toBe('risk threshold');
    });
  });

  // ─── STOPPED → RESUMING → RUNNING ─────────────────────────

  describe('stopped → resuming → running', () => {
    beforeEach(() => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
      actor.send({ type: 'STOP_CMD', reason: 'test', timestamp: Date.now() });
    });

    it('should transition to resuming on CONTINUE_CMD', () => {
      actor.send({ type: 'CONTINUE_CMD' });
      expect(actor.getSnapshot().value).toBe('resuming');
    });

    it('should transition to running on RESUME_COMPLETE', () => {
      actor.send({ type: 'CONTINUE_CMD' });
      actor.send({ type: 'RESUME_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('running');
      expect(actor.getSnapshot().context.stoppedAt).toBeNull();
      expect(actor.getSnapshot().context.stopReason).toBeNull();
    });

    it('should transition to idle on RESET_CMD', () => {
      actor.send({ type: 'RESET_CMD' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.stoppedAt).toBeNull();
      expect(actor.getSnapshot().context.stopReason).toBeNull();
      expect(actor.getSnapshot().context.pendingActions).toBe(0);
    });

    it('should handle STOP_CMD during resuming', () => {
      actor.send({ type: 'CONTINUE_CMD' });
      actor.send({ type: 'STOP_CMD', reason: 'stop again', timestamp: Date.now() });
      expect(actor.getSnapshot().value).toBe('stopped');
    });

    it('should handle ERROR_OCCURRED during resuming', () => {
      actor.send({ type: 'CONTINUE_CMD' });
      actor.send({ type: 'ERROR_OCCURRED', message: 'resume failed' });
      expect(actor.getSnapshot().value).toBe('error');
      expect(actor.getSnapshot().context.errorMessage).toBe('resume failed');
    });
  });

  // ─── Error State ───────────────────────────────────────────

  describe('error state', () => {
    beforeEach(() => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
      actor.send({ type: 'ERROR_OCCURRED', message: 'something broke' });
    });

    it('should transition from running to error', () => {
      expect(actor.getSnapshot().value).toBe('error');
      expect(actor.getSnapshot().context.errorMessage).toBe('something broke');
      expect(actor.getSnapshot().context.errorTimestamp).toBeTypeOf('number');
    });

    it('should transition to idle on RESET_CMD', () => {
      actor.send({ type: 'RESET_CMD' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.errorMessage).toBeNull();
      expect(actor.getSnapshot().context.errorTimestamp).toBeNull();
      expect(actor.getSnapshot().context.pendingActions).toBe(0);
    });

    it('should allow CONTINUE_CMD from error to resuming', () => {
      actor.send({ type: 'CONTINUE_CMD' });
      expect(actor.getSnapshot().value).toBe('resuming');
    });
  });

  // ─── Agent Events ──────────────────────────────────────────

  describe('agent events', () => {
    it('should handle AGENT_COMPLETED → back to idle', () => {
      actor.send({ type: 'AGENT_SPAWNED', sessionId: 'sess-1' });
      expect(actor.getSnapshot().value).toBe('running');
      actor.send({ type: 'AGENT_COMPLETED', sessionId: 'sess-1' });
      expect(actor.getSnapshot().value).toBe('idle');
      expect(actor.getSnapshot().context.agentSessionId).toBeNull();
    });

    it('should handle AGENT_CRASHED → error state', () => {
      actor.send({ type: 'AGENT_SPAWNED', sessionId: 'sess-1' });
      actor.send({ type: 'AGENT_CRASHED', sessionId: 'sess-1', error: 'OOM killed' });
      expect(actor.getSnapshot().value).toBe('error');
      expect(actor.getSnapshot().context.errorMessage).toBe('OOM killed');
      expect(actor.getSnapshot().context.agentSessionId).toBeNull();
    });
  });

  // ─── Snapshot Persistence ──────────────────────────────────

  describe('snapshot persistence', () => {
    it('should be restorable from snapshot', () => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-2', eventId: 'evt-2' });
      const snapshot = actor.getSnapshot();

      // Create new actor from snapshot
      const restored = createActor(executionMachine, { snapshot });
      restored.start();

      expect(restored.getSnapshot().value).toBe('running');
      expect(restored.getSnapshot().context.pendingActions).toBe(2);
      expect(restored.getSnapshot().context.totalActionsProcessed).toBe(2);
      expect(restored.getSnapshot().context.lastSnapshotId).toBe('snap-2');
    });

    it('should continue from restored state', () => {
      actor.send({ type: 'ACTION_EVENT', snapshotId: 'snap-1', eventId: 'evt-1' });
      const snapshot = actor.getSnapshot();

      const restored = createActor(executionMachine, { snapshot });
      restored.start();
      restored.send({ type: 'STOP_CMD', reason: 'restored stop', timestamp: Date.now() });

      expect(restored.getSnapshot().value).toBe('stopped');
      expect(restored.getSnapshot().context.stopReason).toBe('restored stop');
    });
  });

  // ─── Full Lifecycle ────────────────────────────────────────

  describe('full lifecycle', () => {
    it('should complete idle → running → stopped → resuming → running → idle', () => {
      // idle → running
      actor.send({ type: 'ACTION_EVENT', snapshotId: 's1', eventId: 'e1' });
      expect(actor.getSnapshot().value).toBe('running');

      // running → stopped
      actor.send({ type: 'STOP_CMD', reason: 'pause', timestamp: Date.now() });
      expect(actor.getSnapshot().value).toBe('stopped');

      // stopped → resuming
      actor.send({ type: 'CONTINUE_CMD' });
      expect(actor.getSnapshot().value).toBe('resuming');

      // resuming → running
      actor.send({ type: 'RESUME_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('running');

      // running → idle
      actor.send({ type: 'ALL_ACTIONS_COMPLETE' });
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('should handle agent spawn lifecycle', () => {
      actor.send({ type: 'AGENT_SPAWNED', sessionId: 'sess-1' });
      expect(actor.getSnapshot().value).toBe('running');

      actor.send({ type: 'ACTION_EVENT', snapshotId: 's1', eventId: 'e1' });
      expect(actor.getSnapshot().context.totalActionsProcessed).toBe(1);

      actor.send({ type: 'AGENT_COMPLETED', sessionId: 'sess-1' });
      expect(actor.getSnapshot().value).toBe('idle');
    });
  });
});
