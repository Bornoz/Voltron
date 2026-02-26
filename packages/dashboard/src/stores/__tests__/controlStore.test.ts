import { describe, it, expect, beforeEach } from 'vitest';
import { useControlStore } from '../controlStore';
import type { ExecutionContext } from '@voltron/shared';

function getState() {
  return useControlStore.getState();
}

describe('controlStore', () => {
  beforeEach(() => {
    useControlStore.setState({
      executionState: 'IDLE',
      context: null,
      history: [],
    });
  });

  describe('state transitions', () => {
    it('should start in IDLE state', () => {
      expect(getState().executionState).toBe('IDLE');
    });

    it('should set execution state', () => {
      getState().setExecutionState('RUNNING');
      expect(getState().executionState).toBe('RUNNING');
    });

    it('should set execution state to STOPPED', () => {
      getState().setExecutionState('STOPPED');
      expect(getState().executionState).toBe('STOPPED');
    });

    it('should set execution state to ERROR', () => {
      getState().setExecutionState('ERROR');
      expect(getState().executionState).toBe('ERROR');
    });

    it('should set execution state to RESUMING', () => {
      getState().setExecutionState('RESUMING');
      expect(getState().executionState).toBe('RESUMING');
    });
  });

  describe('context', () => {
    const baseCtx: ExecutionContext = {
      lastSnapshotId: null,
      lastActionEventId: null,
      pendingActions: 3,
      stoppedAt: null,
      stopReason: null,
      errorMessage: null,
      errorTimestamp: null,
      totalActionsProcessed: 42,
      sessionStartedAt: null,
      autoStopRiskThreshold: 'HIGH',
      rateLimit: 50,
    };

    it('should set context', () => {
      getState().setContext(baseCtx);
      expect(getState().context).toEqual(baseCtx);
    });

    it('should set state and context together', () => {
      const ctx: ExecutionContext = {
        ...baseCtx,
        totalActionsProcessed: 10,
        pendingActions: 0,
        autoStopRiskThreshold: 'CRITICAL',
        stopReason: 'operator',
        stoppedAt: Date.now(),
      };
      getState().setState('STOPPED', ctx);
      expect(getState().executionState).toBe('STOPPED');
      expect(getState().context?.stopReason).toBe('operator');
    });
  });

  describe('history', () => {
    it('should add history entry at the beginning', () => {
      getState().addHistoryEntry({
        state: 'RUNNING',
        timestamp: 1000,
        reason: 'auto',
        actor: 'system',
      });
      expect(getState().history).toHaveLength(1);
      expect(getState().history[0].state).toBe('RUNNING');
    });

    it('should prepend new entries (newest first)', () => {
      getState().addHistoryEntry({ state: 'RUNNING', timestamp: 1000 });
      getState().addHistoryEntry({ state: 'STOPPED', timestamp: 2000, reason: 'manual' });
      expect(getState().history[0].state).toBe('STOPPED');
      expect(getState().history[1].state).toBe('RUNNING');
    });

    it('should cap history at 100 entries', () => {
      for (let i = 0; i < 110; i++) {
        getState().addHistoryEntry({ state: 'RUNNING', timestamp: i });
      }
      expect(getState().history).toHaveLength(100);
    });

    it('should bulk set history', () => {
      const entries = [
        { state: 'RUNNING' as const, timestamp: 1000 },
        { state: 'STOPPED' as const, timestamp: 2000, reason: 'operator' },
      ];
      getState().setHistory(entries);
      expect(getState().history).toHaveLength(2);
      expect(getState().history[0].state).toBe('RUNNING');
    });

    it('should preserve actor and reason in history entries', () => {
      getState().addHistoryEntry({
        state: 'STOPPED',
        timestamp: 1000,
        reason: 'auto_stop',
        actor: 'risk-engine',
      });
      const entry = getState().history[0];
      expect(entry.reason).toBe('auto_stop');
      expect(entry.actor).toBe('risk-engine');
    });
  });
});
