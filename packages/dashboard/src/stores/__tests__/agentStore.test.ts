import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from '../agentStore';
import type { AgentLocation, AgentPlan, AgentBreadcrumb, PhaseExecution } from '@voltron/shared';

function getState() {
  return useAgentStore.getState();
}

function act<T>(fn: () => T): T {
  return fn();
}

describe('agentStore', () => {
  beforeEach(() => {
    act(() => getState().reset());
  });

  // ── Session ─────────────────────────────────────────────
  describe('session management', () => {
    it('should set session with SPAWNING status', () => {
      act(() => getState().setSession('sess-1', 'claude-haiku', 1000));
      const s = getState();
      expect(s.sessionId).toBe('sess-1');
      expect(s.model).toBe('claude-haiku');
      expect(s.startedAt).toBe(1000);
      expect(s.status).toBe('SPAWNING');
    });

    it('should reset to initial state', () => {
      act(() => getState().setSession('sess-1', 'claude-haiku', 1000));
      act(() => getState().setStatus('RUNNING'));
      act(() => getState().reset());
      const s = getState();
      expect(s.sessionId).toBeNull();
      expect(s.status).toBe('IDLE');
      expect(s.model).toBeNull();
      expect(s.breadcrumbs).toHaveLength(0);
      expect(s.output).toHaveLength(0);
    });
  });

  // ── Status ──────────────────────────────────────────────
  describe('status transitions', () => {
    it('should set status to RUNNING', () => {
      act(() => getState().setStatus('RUNNING'));
      expect(getState().status).toBe('RUNNING');
    });

    it('should reset activity to IDLE on COMPLETED', () => {
      act(() => getState().setStatus('RUNNING'));
      act(() => getState().setStatus('COMPLETED'));
      const s = getState();
      expect(s.status).toBe('COMPLETED');
      expect(s.activity).toBe('IDLE');
    });

    it('should reset activity to IDLE on CRASHED', () => {
      act(() => getState().setStatus('RUNNING'));
      act(() => getState().setStatus('CRASHED'));
      expect(getState().activity).toBe('IDLE');
    });

    it('should not reset activity for non-terminal states', () => {
      const loc: AgentLocation = {
        filePath: '/src/index.ts',
        activity: 'WRITING',
        timestamp: Date.now(),
      };
      act(() => getState().setLocation(loc));
      act(() => getState().setStatus('PAUSED'));
      expect(getState().activity).toBe('WRITING');
    });
  });

  // ── Location / GPS ─────────────────────────────────────
  describe('location', () => {
    it('should set location and update currentFile + activity', () => {
      const loc: AgentLocation = {
        filePath: '/src/app.ts',
        activity: 'READING',
        timestamp: 1234567890,
      };
      act(() => getState().setLocation(loc));
      const s = getState();
      expect(s.location).toEqual(loc);
      expect(s.currentFile).toBe('/src/app.ts');
      expect(s.activity).toBe('READING');
    });
  });

  // ── Plan ───────────────────────────────────────────────
  describe('plan', () => {
    it('should set plan', () => {
      const plan: AgentPlan = {
        summary: 'Test plan',
        steps: [{ index: 0, description: 'Step 1', status: 'pending' }],
        currentStepIndex: 0,
        totalSteps: 1,
        confidence: 0.9,
      };
      act(() => getState().setPlan(plan));
      expect(getState().plan).toEqual(plan);
    });
  });

  // ── Breadcrumbs ────────────────────────────────────────
  describe('breadcrumbs', () => {
    it('should add a breadcrumb', () => {
      const crumb: AgentBreadcrumb = {
        filePath: '/src/index.ts',
        activity: 'READING',
        timestamp: Date.now(),
      };
      act(() => getState().addBreadcrumb(crumb));
      expect(getState().breadcrumbs).toHaveLength(1);
      expect(getState().breadcrumbs[0]).toEqual(crumb);
    });

    it('should cap breadcrumbs at 500', () => {
      for (let i = 0; i < 510; i++) {
        act(() =>
          getState().addBreadcrumb({
            filePath: `/file-${i}`,
            activity: 'READING',
            timestamp: i,
          }),
        );
      }
      expect(getState().breadcrumbs.length).toBeLessThanOrEqual(500);
    });
  });

  // ── Output ─────────────────────────────────────────────
  describe('output', () => {
    it('should add output entry', () => {
      act(() =>
        getState().addOutput({
          text: 'hello',
          type: 'text',
          timestamp: Date.now(),
        }),
      );
      expect(getState().output).toHaveLength(1);
      expect(getState().output[0].text).toBe('hello');
    });

    it('should cap output at 1000', () => {
      for (let i = 0; i < 1010; i++) {
        act(() =>
          getState().addOutput({
            text: `line-${i}`,
            type: 'text',
            timestamp: i,
          }),
        );
      }
      expect(getState().output.length).toBeLessThanOrEqual(1000);
    });
  });

  // ── Token Usage ────────────────────────────────────────
  describe('tokenUsage', () => {
    it('should set token usage', () => {
      act(() => getState().setTokenUsage({ inputTokens: 500, outputTokens: 200 }));
      const s = getState();
      expect(s.tokenUsage.inputTokens).toBe(500);
      expect(s.tokenUsage.outputTokens).toBe(200);
    });
  });

  // ── Error ──────────────────────────────────────────────
  describe('error', () => {
    it('should set last error', () => {
      act(() => getState().setError('spawn failed'));
      expect(getState().lastError).toBe('spawn failed');
    });
  });

  // ── Dev Server ─────────────────────────────────────────
  describe('devServer', () => {
    it('should set dev server state', () => {
      const info = { status: 'ready' as const, port: 3000, url: 'http://localhost:3000' };
      act(() => getState().setDevServer(info));
      expect(getState().devServer).toEqual(info);
    });

    it('should clear dev server to null', () => {
      act(() => getState().setDevServer({ status: 'ready', port: 3000, url: 'http://localhost:3000' }));
      act(() => getState().setDevServer(null));
      expect(getState().devServer).toBeNull();
    });
  });

  // ── Phase Execution ────────────────────────────────────
  describe('phase execution', () => {
    const sampleExecution: PhaseExecution = {
      phases: [
        { id: 'p1', title: 'Phase 1', edits: [], status: 'running' },
        { id: 'p2', title: 'Phase 2', edits: [], status: 'pending' },
        { id: 'p3', title: 'Phase 3', edits: [], status: 'pending' },
      ],
      currentPhaseIndex: 0,
      status: 'running',
    };

    it('should set phase execution', () => {
      act(() => getState().setPhaseExecution(sampleExecution));
      const s = getState();
      expect(s.phaseExecution.phases).toHaveLength(3);
      expect(s.phaseExecution.status).toBe('running');
    });

    it('should approve a phase', () => {
      act(() => getState().setPhaseExecution(sampleExecution));
      act(() => getState().approvePhase('p1'));
      const phase = getState().phaseExecution.phases.find((p) => p.id === 'p1');
      expect(phase?.status).toBe('approved');
    });

    it('should reject a phase and set execution to failed', () => {
      act(() => getState().setPhaseExecution(sampleExecution));
      act(() => getState().rejectPhase('p1'));
      const s = getState();
      expect(s.phaseExecution.phases.find((p) => p.id === 'p1')?.status).toBe('rejected');
      expect(s.phaseExecution.status).toBe('failed');
    });

    it('should advance to next phase', () => {
      act(() => getState().setPhaseExecution(sampleExecution));
      act(() => getState().nextPhase());
      const s = getState();
      expect(s.phaseExecution.currentPhaseIndex).toBe(1);
      expect(s.phaseExecution.phases[1].status).toBe('running');
    });

    it('should set completed when advancing past last phase', () => {
      act(() =>
        getState().setPhaseExecution({
          phases: [{ id: 'p1', title: 'Phase 1', edits: [], status: 'approved' }],
          currentPhaseIndex: 0,
          status: 'running',
        }),
      );
      act(() => getState().nextPhase());
      expect(getState().phaseExecution.status).toBe('completed');
      expect(getState().phaseExecution.currentPhaseIndex).toBe(1);
    });
  });

  // ── Prompt Pins ────────────────────────────────────────
  describe('prompt pins', () => {
    const pin = {
      id: 'pin-1',
      x: 100,
      y: 200,
      pageX: 100,
      pageY: 200,
      prompt: 'Make this button bigger',
      nearestSelector: '.btn-primary',
      nearestElementDesc: 'button.btn-primary',
      createdAt: Date.now(),
    };

    it('should add a prompt pin', () => {
      act(() => getState().addPromptPin(pin));
      expect(getState().promptPins).toHaveLength(1);
      expect(getState().promptPins[0].id).toBe('pin-1');
    });

    it('should update prompt pin with string', () => {
      act(() => getState().addPromptPin(pin));
      act(() => getState().updatePromptPin('pin-1', 'Updated prompt'));
      expect(getState().promptPins[0].prompt).toBe('Updated prompt');
    });

    it('should update prompt pin with object', () => {
      act(() => getState().addPromptPin(pin));
      act(() => getState().updatePromptPin('pin-1', { x: 150, y: 250 }));
      const updated = getState().promptPins[0];
      expect(updated.x).toBe(150);
      expect(updated.y).toBe(250);
      expect(updated.prompt).toBe('Make this button bigger');
    });

    it('should not update non-existent pin', () => {
      act(() => getState().addPromptPin(pin));
      act(() => getState().updatePromptPin('non-existent', 'test'));
      expect(getState().promptPins).toHaveLength(1);
      expect(getState().promptPins[0].prompt).toBe('Make this button bigger');
    });

    it('should remove a prompt pin', () => {
      act(() => getState().addPromptPin(pin));
      act(() => getState().removePromptPin('pin-1'));
      expect(getState().promptPins).toHaveLength(0);
    });

    it('should clear all prompt pins', () => {
      act(() => getState().addPromptPin(pin));
      act(() => getState().addPromptPin({ ...pin, id: 'pin-2' }));
      act(() => getState().clearPromptPins());
      expect(getState().promptPins).toHaveLength(0);
    });
  });

  // ── Reference Image ───────────────────────────────────
  describe('reference image', () => {
    it('should set reference image', () => {
      act(() => getState().setReferenceImage({ dataUrl: 'data:image/png;base64,...', opacity: 0.5 }));
      expect(getState().referenceImage?.dataUrl).toBe('data:image/png;base64,...');
      expect(getState().referenceImage?.opacity).toBe(0.5);
    });

    it('should clear reference image', () => {
      act(() => getState().setReferenceImage({ dataUrl: 'data:test', opacity: 0.5 }));
      act(() => getState().setReferenceImage(null));
      expect(getState().referenceImage).toBeNull();
    });

    it('should set reference opacity', () => {
      act(() => getState().setReferenceImage({ dataUrl: 'data:test', opacity: 0.5 }));
      act(() => getState().setReferenceOpacity(0.8));
      expect(getState().referenceImage?.opacity).toBe(0.8);
    });

    it('should not crash when setting opacity with no image', () => {
      act(() => getState().setReferenceOpacity(0.8));
      expect(getState().referenceImage).toBeNull();
    });
  });
});
