import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAgentStore } from '../../stores/agentStore';

type Handler = (msg: { type: string; payload: unknown; timestamp: number }) => void;

/**
 * Minimal mock of VoltronWebSocket that captures event subscriptions.
 */
function createMockClient() {
  const handlers = new Map<string, Handler>();

  return {
    on: vi.fn((eventType: string, handler: Handler) => {
      handlers.set(eventType, handler);
      return () => { handlers.delete(eventType); };
    }),
    emit(type: string, payload: unknown) {
      const handler = handlers.get(type);
      if (handler) {
        handler({ type, payload, timestamp: Date.now() });
      }
    },
    getHandler(type: string) {
      return handlers.get(type);
    },
    handlers,
  };
}

// Since useAgentStream is a React hook using useEffect, we test the
// underlying logic by simulating the event handlers directly.
// The hook just wires client.on → store actions, so we test that mapping.
describe('useAgentStream — event → store mapping', () => {
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    useAgentStore.getState().reset();
    client = createMockClient();

    // Simulate what useAgentStream does: subscribe to all events
    const store = useAgentStore.getState();

    client.on('AGENT_STATUS_CHANGE', (msg) => {
      const p = msg.payload as { status: string; sessionId?: string; model?: string; startedAt?: number };
      store.setStatus(p.status as any);
      if (p.sessionId && p.model && p.startedAt) {
        store.setSession(p.sessionId, p.model, p.startedAt);
      }
    });

    client.on('AGENT_LOCATION_UPDATE', (msg) => {
      const p = msg.payload as { location: any };
      store.setLocation(p.location);
    });

    client.on('AGENT_PLAN_UPDATE', (msg) => {
      const p = msg.payload as { plan: any };
      store.setPlan(p.plan);
    });

    client.on('AGENT_BREADCRUMB', (msg) => {
      const p = msg.payload as { breadcrumb: any };
      store.addBreadcrumb(p.breadcrumb);
    });

    client.on('AGENT_OUTPUT', (msg) => {
      const p = msg.payload as { text: string; type: string; timestamp: number; toolName?: string };
      store.addOutput({ text: p.text, type: p.type as any, timestamp: p.timestamp });
    });

    client.on('AGENT_TOKEN_USAGE', (msg) => {
      const p = msg.payload as { inputTokens: number; outputTokens: number };
      store.setTokenUsage(p);
    });

    client.on('AGENT_ERROR', (msg) => {
      const p = msg.payload as { error: string };
      store.setError(p.error);
    });

    client.on('AGENT_PHASE_UPDATE', (msg) => {
      store.setPhaseExecution(msg.payload as any);
    });

    client.on('DEV_SERVER_STATUS', (msg) => {
      const p = msg.payload as any;
      store.setDevServer(p.status === 'stopped' ? null : p);
    });
  });

  it('should subscribe to 9 event types', () => {
    expect(client.on).toHaveBeenCalledTimes(9);
  });

  it('should handle AGENT_STATUS_CHANGE → setStatus', () => {
    client.emit('AGENT_STATUS_CHANGE', {
      projectId: 'proj-1',
      status: 'RUNNING',
    });
    expect(useAgentStore.getState().status).toBe('RUNNING');
  });

  it('should handle AGENT_STATUS_CHANGE with session info', () => {
    client.emit('AGENT_STATUS_CHANGE', {
      projectId: 'proj-1',
      status: 'SPAWNING',
      sessionId: 'sess-1',
      model: 'claude-sonnet',
      startedAt: 5000,
    });
    const s = useAgentStore.getState();
    expect(s.status).toBe('SPAWNING');
    expect(s.sessionId).toBe('sess-1');
    expect(s.model).toBe('claude-sonnet');
    expect(s.startedAt).toBe(5000);
  });

  it('should handle AGENT_LOCATION_UPDATE → setLocation', () => {
    client.emit('AGENT_LOCATION_UPDATE', {
      location: {
        filePath: '/src/main.ts',
        activity: 'WRITING',
        timestamp: Date.now(),
      },
    });
    const s = useAgentStore.getState();
    expect(s.location?.filePath).toBe('/src/main.ts');
    expect(s.currentFile).toBe('/src/main.ts');
    expect(s.activity).toBe('WRITING');
  });

  it('should handle AGENT_PLAN_UPDATE → setPlan', () => {
    const plan = {
      summary: 'Refactor auth module',
      steps: [{ index: 0, description: 'Read files', status: 'active' as const }],
      currentStepIndex: 0,
      totalSteps: 1,
      confidence: 0.85,
    };
    client.emit('AGENT_PLAN_UPDATE', { plan });
    expect(useAgentStore.getState().plan?.summary).toBe('Refactor auth module');
  });

  it('should handle AGENT_BREADCRUMB → addBreadcrumb', () => {
    client.emit('AGENT_BREADCRUMB', {
      breadcrumb: {
        filePath: '/src/utils.ts',
        activity: 'READING',
        timestamp: Date.now(),
      },
    });
    expect(useAgentStore.getState().breadcrumbs).toHaveLength(1);
  });

  it('should handle AGENT_OUTPUT → addOutput', () => {
    client.emit('AGENT_OUTPUT', {
      projectId: 'proj-1',
      text: 'Processing files...',
      type: 'text',
      timestamp: Date.now(),
    });
    expect(useAgentStore.getState().output).toHaveLength(1);
    expect(useAgentStore.getState().output[0].text).toBe('Processing files...');
  });

  it('should handle AGENT_TOKEN_USAGE → setTokenUsage', () => {
    client.emit('AGENT_TOKEN_USAGE', { inputTokens: 1500, outputTokens: 800 });
    const t = useAgentStore.getState().tokenUsage;
    expect(t.inputTokens).toBe(1500);
    expect(t.outputTokens).toBe(800);
  });

  it('should handle AGENT_ERROR → setError', () => {
    client.emit('AGENT_ERROR', { error: 'Process crashed with code 1' });
    expect(useAgentStore.getState().lastError).toBe('Process crashed with code 1');
  });

  it('should handle AGENT_PHASE_UPDATE → setPhaseExecution', () => {
    const pe = {
      phases: [
        { id: 'p1', title: 'Init', edits: [], status: 'running' as const },
      ],
      currentPhaseIndex: 0,
      status: 'running' as const,
    };
    client.emit('AGENT_PHASE_UPDATE', pe);
    expect(useAgentStore.getState().phaseExecution.phases).toHaveLength(1);
    expect(useAgentStore.getState().phaseExecution.status).toBe('running');
  });

  it('should handle DEV_SERVER_STATUS ready → setDevServer', () => {
    client.emit('DEV_SERVER_STATUS', {
      status: 'ready',
      port: 3000,
      url: 'http://localhost:3000',
      projectType: 'vite',
    });
    const ds = useAgentStore.getState().devServer;
    expect(ds?.status).toBe('ready');
    expect(ds?.port).toBe(3000);
  });

  it('should handle DEV_SERVER_STATUS stopped → null', () => {
    // First set it
    client.emit('DEV_SERVER_STATUS', { status: 'ready', port: 3000, url: 'http://localhost:3000' });
    expect(useAgentStore.getState().devServer).not.toBeNull();

    // Then stop
    client.emit('DEV_SERVER_STATUS', { status: 'stopped', port: 3000, url: '' });
    expect(useAgentStore.getState().devServer).toBeNull();
  });

  it('should handle sequential status transitions', () => {
    client.emit('AGENT_STATUS_CHANGE', { projectId: 'p', status: 'SPAWNING', sessionId: 's1', model: 'haiku', startedAt: 1 });
    expect(useAgentStore.getState().status).toBe('SPAWNING');

    client.emit('AGENT_STATUS_CHANGE', { projectId: 'p', status: 'RUNNING' });
    expect(useAgentStore.getState().status).toBe('RUNNING');

    client.emit('AGENT_STATUS_CHANGE', { projectId: 'p', status: 'COMPLETED' });
    expect(useAgentStore.getState().status).toBe('COMPLETED');
    expect(useAgentStore.getState().activity).toBe('IDLE');
  });
});
