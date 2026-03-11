import { useEffect, useRef } from 'react';
import type { VoltronWebSocket } from '../lib/ws';
import type { AgentStatus, AgentLocation, AgentPlan, AgentBreadcrumb, PhaseExecution } from '@voltron/shared';
import { useAgentStore } from '../stores/agentStore';
import type { AgentOutputEntry } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';
import { useNotificationStore } from '../stores/notificationStore';

/**
 * Subscribes to AGENT_* WS message types and dispatches to agentStore.
 * Uses refs for callbacks to avoid teardown/rebuild on every store selector change.
 */
export function useAgentStream(client: VoltronWebSocket): void {
  // Use refs to always have latest callbacks without re-subscribing
  const storeRef = useRef({
    setSession: useAgentStore.getState().setSession,
    setStatus: useAgentStore.getState().setStatus,
    setLocation: useAgentStore.getState().setLocation,
    setPlan: useAgentStore.getState().setPlan,
    addBreadcrumb: useAgentStore.getState().addBreadcrumb,
    addOutput: useAgentStore.getState().addOutput,
    setTokenUsage: useAgentStore.getState().setTokenUsage,
    setError: useAgentStore.getState().setError,
    setDevServer: useAgentStore.getState().setDevServer,
    setPhaseExecution: useAgentStore.getState().setPhaseExecution,
    addToInjectionQueue: useAgentStore.getState().addToInjectionQueue,
    updateInjectionQueueEntry: useAgentStore.getState().updateInjectionQueueEntry,
    addAgentChatMessage: useChatStore.getState().addAgentMessage,
  });

  // Keep refs up to date (Zustand stores are stable, but just in case)
  useEffect(() => {
    storeRef.current = {
      setSession: useAgentStore.getState().setSession,
      setStatus: useAgentStore.getState().setStatus,
      setLocation: useAgentStore.getState().setLocation,
      setPlan: useAgentStore.getState().setPlan,
      addBreadcrumb: useAgentStore.getState().addBreadcrumb,
      addOutput: useAgentStore.getState().addOutput,
      setTokenUsage: useAgentStore.getState().setTokenUsage,
      setError: useAgentStore.getState().setError,
      setDevServer: useAgentStore.getState().setDevServer,
      setPhaseExecution: useAgentStore.getState().setPhaseExecution,
      addToInjectionQueue: useAgentStore.getState().addToInjectionQueue,
      updateInjectionQueueEntry: useAgentStore.getState().updateInjectionQueueEntry,
      addAgentChatMessage: useChatStore.getState().addAgentMessage,
    };
  });

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    const s = () => storeRef.current;

    unsubs.push(client.on('AGENT_STATUS_CHANGE', (msg) => {
      const p = msg.payload as {
        projectId: string;
        status: AgentStatus;
        sessionId?: string;
        model?: string;
        startedAt?: number;
      };
      console.log('[WS] AGENT_STATUS_CHANGE:', p.status, p.sessionId ?? '');
      s().setStatus(p.status);
      if (p.sessionId && p.model && p.startedAt) {
        s().setSession(p.sessionId, p.model, p.startedAt);
      }
    }));

    unsubs.push(client.on('AGENT_LOCATION_UPDATE', (msg) => {
      const p = msg.payload as { location: AgentLocation; projectId?: string };
      console.log('[WS] AGENT_LOCATION_UPDATE:', p.location.activity, p.location.filePath?.split('/').pop());
      s().setLocation(p.location);

      // Conflict detection: warn if agent is writing to a file with visual edits
      const projectId = (msg.payload as Record<string, unknown>).projectId ?? '';
      const visualEdits = localStorage.getItem(`voltron_visual_edits_${projectId}`);
      if (p.location.activity === 'WRITING' && visualEdits) {
        try {
          const edits = JSON.parse(visualEdits) as Array<{ selector: string }>;
          if (edits.length > 0) {
            s().addOutput({
              text: `Warning: Agent is writing while you have ${edits.length} visual edits pending`,
              type: 'error',
              timestamp: Date.now(),
            });
          }
        } catch { /* ignore */ }
      }
    }));

    unsubs.push(client.on('AGENT_PLAN_UPDATE', (msg) => {
      const p = msg.payload as { plan: AgentPlan };
      console.log('[WS] AGENT_PLAN_UPDATE:', p.plan.summary, `${p.plan.steps.length} steps, confidence=${p.plan.confidence}`);
      s().setPlan(p.plan);
    }));

    unsubs.push(client.on('AGENT_BREADCRUMB', (msg) => {
      const p = msg.payload as { breadcrumb: AgentBreadcrumb };
      console.log('[WS] AGENT_BREADCRUMB:', p.breadcrumb.activity, p.breadcrumb.filePath?.split('/').pop());
      s().addBreadcrumb(p.breadcrumb);
    }));

    unsubs.push(client.on('AGENT_OUTPUT', (msg) => {
      const p = msg.payload as AgentOutputEntry & { projectId: string };
      console.log('[WS] AGENT_OUTPUT:', p.type, p.text?.substring(0, 80));
      s().addOutput({
        text: p.text,
        type: p.type,
        timestamp: p.timestamp,
        toolName: p.toolName,
        input: p.input,
      });
      // Forward text and delta outputs to chat
      if ((p.type === 'text' || p.type === 'delta') && p.text) {
        s().addAgentChatMessage(p.text);
      }
    }));

    unsubs.push(client.on('AGENT_TOKEN_USAGE', (msg) => {
      const p = msg.payload as { inputTokens: number; outputTokens: number };
      console.log('[WS] AGENT_TOKEN_USAGE:', p.inputTokens, '/', p.outputTokens);
      s().setTokenUsage(p);
    }));

    unsubs.push(client.on('AGENT_ERROR', (msg) => {
      const p = msg.payload as { error: string };
      console.error('[WS] AGENT_ERROR:', p.error.substring(0, 200));
      s().setError(p.error);
    }));

    unsubs.push(client.on('AGENT_PHASE_UPDATE', (msg) => {
      const p = msg.payload as PhaseExecution;
      console.log('[WS] AGENT_PHASE_UPDATE:', p.status, p.phases.length, 'phases');
      s().setPhaseExecution(p);
    }));

    unsubs.push(client.on('DEV_SERVER_STATUS', (msg) => {
      const p = msg.payload as {
        status: 'installing' | 'starting' | 'ready' | 'error' | 'stopped';
        port: number;
        url: string;
        projectType?: string;
        error?: string;
      };
      console.log('[WS] DEV_SERVER_STATUS:', p.status, p.port);
      s().setDevServer(p.status === 'stopped' ? null : p);
    }));

    // Breakpoint hit — agent auto-paused by server
    unsubs.push(client.on('AGENT_BREAKPOINT_HIT', (msg) => {
      const p = msg.payload as { filePath: string; timestamp: number };
      console.log('[WS] AGENT_BREAKPOINT_HIT:', p.filePath);
      const fileName = p.filePath.split('/').pop() ?? p.filePath;
      s().addOutput({
        text: `Breakpoint hit: ${p.filePath} — Agent paused`,
        type: 'error',
        timestamp: p.timestamp,
      });
      useNotificationStore.getState().addNotification({
        type: 'warning',
        title: 'Breakpoint triggered',
        message: `Agent paused at "${fileName}". Use Resume to continue.`,
      });
    }));

    // Breakpoint set (server confirmed)
    unsubs.push(client.on('AGENT_BREAKPOINT_SET', (msg) => {
      const p = msg.payload as { filePath: string };
      console.log('[WS] AGENT_BREAKPOINT_SET:', p.filePath);
      useAgentStore.getState().addBreakpoint(p.filePath);
    }));

    // Breakpoint removed (server confirmed)
    unsubs.push(client.on('AGENT_BREAKPOINT_REMOVED', (msg) => {
      const p = msg.payload as { filePath: string };
      console.log('[WS] AGENT_BREAKPOINT_REMOVED:', p.filePath);
      useAgentStore.getState().removeBreakpoint(p.filePath);
    }));

    // Agent redirected to file
    unsubs.push(client.on('AGENT_REDIRECTED', (msg) => {
      const p = msg.payload as { filePath: string };
      console.log('[WS] AGENT_REDIRECTED:', p.filePath);
      s().addOutput({
        text: `Agent redirected: ${p.filePath}`,
        type: 'text',
        timestamp: Date.now(),
      });
    }));

    // Injection queued
    unsubs.push(client.on('AGENT_INJECTION_QUEUED', (msg) => {
      const p = msg.payload as { id: string; prompt: string; queuedAt: number };
      console.log('[WS] AGENT_INJECTION_QUEUED:', p.id, p.prompt.substring(0, 60));
      s().addToInjectionQueue({ id: p.id, prompt: p.prompt, queuedAt: p.queuedAt, status: 'queued' });
    }));

    // Injection applied
    unsubs.push(client.on('AGENT_INJECTION_APPLIED', (msg) => {
      const p = msg.payload as { id: string };
      console.log('[WS] AGENT_INJECTION_APPLIED:', p.id);
      s().updateInjectionQueueEntry(p.id, 'applied');
    }));

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [client]); // Only re-subscribe when client changes
}
