import { useEffect } from 'react';
import type { VoltronWebSocket } from '../lib/ws';
import type { AgentStatus, AgentLocation, AgentPlan, AgentBreadcrumb, PhaseExecution } from '@voltron/shared';
import { useAgentStore } from '../stores/agentStore';
import type { AgentOutputEntry } from '../stores/agentStore';
import { useChatStore } from '../stores/chatStore';

/**
 * Subscribes to AGENT_* WS message types and dispatches to agentStore.
 * Includes conflict detection, breakpoint, and injection queue handlers.
 * All handlers log to console for debugging.
 */
export function useAgentStream(client: VoltronWebSocket): void {
  const setSession = useAgentStore((s) => s.setSession);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setLocation = useAgentStore((s) => s.setLocation);
  const setPlan = useAgentStore((s) => s.setPlan);
  const addBreadcrumb = useAgentStore((s) => s.addBreadcrumb);
  const addOutput = useAgentStore((s) => s.addOutput);
  const setTokenUsage = useAgentStore((s) => s.setTokenUsage);
  const setError = useAgentStore((s) => s.setError);
  const setDevServer = useAgentStore((s) => s.setDevServer);
  const setPhaseExecution = useAgentStore((s) => s.setPhaseExecution);
  const addToInjectionQueue = useAgentStore((s) => s.addToInjectionQueue);
  const updateInjectionQueueEntry = useAgentStore((s) => s.updateInjectionQueueEntry);
  const addAgentChatMessage = useChatStore((s) => s.addAgentMessage);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(client.on('AGENT_STATUS_CHANGE', (msg) => {
      const p = msg.payload as {
        projectId: string;
        status: AgentStatus;
        sessionId?: string;
        model?: string;
        startedAt?: number;
      };
      console.log('[WS] AGENT_STATUS_CHANGE:', p.status, p.sessionId ?? '');
      setStatus(p.status);
      if (p.sessionId && p.model && p.startedAt) {
        setSession(p.sessionId, p.model, p.startedAt);
      }
    }));

    unsubs.push(client.on('AGENT_LOCATION_UPDATE', (msg) => {
      const p = msg.payload as { location: AgentLocation; projectId?: string };
      console.log('[WS] AGENT_LOCATION_UPDATE:', p.location.activity, p.location.filePath?.split('/').pop());
      setLocation(p.location);

      // Conflict detection: warn if agent is writing to a file with visual edits
      const projectId = (msg.payload as Record<string, unknown>).projectId ?? '';
      const visualEdits = localStorage.getItem(`voltron_visual_edits_${projectId}`);
      if (p.location.activity === 'WRITING' && visualEdits) {
        try {
          const edits = JSON.parse(visualEdits) as Array<{ selector: string }>;
          if (edits.length > 0) {
            addOutput({
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
      setPlan(p.plan);
    }));

    unsubs.push(client.on('AGENT_BREADCRUMB', (msg) => {
      const p = msg.payload as { breadcrumb: AgentBreadcrumb };
      console.log('[WS] AGENT_BREADCRUMB:', p.breadcrumb.activity, p.breadcrumb.filePath?.split('/').pop());
      addBreadcrumb(p.breadcrumb);
    }));

    unsubs.push(client.on('AGENT_OUTPUT', (msg) => {
      const p = msg.payload as AgentOutputEntry & { projectId: string };
      console.log('[WS] AGENT_OUTPUT:', p.type, p.text?.substring(0, 80));
      addOutput({
        text: p.text,
        type: p.type,
        timestamp: p.timestamp,
        toolName: p.toolName,
        input: p.input,
      });
      // Forward text and delta outputs to chat
      if ((p.type === 'text' || p.type === 'delta') && p.text) {
        addAgentChatMessage(p.text);
      }
    }));

    unsubs.push(client.on('AGENT_TOKEN_USAGE', (msg) => {
      const p = msg.payload as { inputTokens: number; outputTokens: number };
      console.log('[WS] AGENT_TOKEN_USAGE:', p.inputTokens, '/', p.outputTokens);
      setTokenUsage(p);
    }));

    unsubs.push(client.on('AGENT_ERROR', (msg) => {
      const p = msg.payload as { error: string };
      console.error('[WS] AGENT_ERROR:', p.error.substring(0, 200));
      setError(p.error);
    }));

    unsubs.push(client.on('AGENT_PHASE_UPDATE', (msg) => {
      const p = msg.payload as PhaseExecution;
      console.log('[WS] AGENT_PHASE_UPDATE:', p.status, p.phases.length, 'phases');
      setPhaseExecution(p);
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
      setDevServer(p.status === 'stopped' ? null : p);
    }));

    // Breakpoint hit
    unsubs.push(client.on('AGENT_BREAKPOINT_HIT', (msg) => {
      const p = msg.payload as { filePath: string; timestamp: number };
      console.log('[WS] AGENT_BREAKPOINT_HIT:', p.filePath);
      addOutput({
        text: `Breakpoint hit: ${p.filePath}`,
        type: 'error',
        timestamp: p.timestamp,
      });
    }));

    // Injection queued
    unsubs.push(client.on('AGENT_INJECTION_QUEUED', (msg) => {
      const p = msg.payload as { id: string; prompt: string; queuedAt: number };
      console.log('[WS] AGENT_INJECTION_QUEUED:', p.id, p.prompt.substring(0, 60));
      addToInjectionQueue({ id: p.id, prompt: p.prompt, queuedAt: p.queuedAt, status: 'queued' });
    }));

    // Injection applied
    unsubs.push(client.on('AGENT_INJECTION_APPLIED', (msg) => {
      const p = msg.payload as { id: string };
      console.log('[WS] AGENT_INJECTION_APPLIED:', p.id);
      updateInjectionQueueEntry(p.id, 'applied');
    }));

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [client, setSession, setStatus, setLocation, setPlan, addBreadcrumb, addOutput, setTokenUsage, setError, setDevServer, setPhaseExecution, addToInjectionQueue, updateInjectionQueueEntry, addAgentChatMessage]);
}
