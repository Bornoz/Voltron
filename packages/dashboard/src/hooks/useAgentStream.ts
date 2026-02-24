import { useEffect } from 'react';
import type { VoltronWebSocket } from '../lib/ws';
import type { AgentStatus, AgentLocation, AgentPlan, AgentBreadcrumb } from '@voltron/shared';
import { useAgentStore } from '../stores/agentStore';
import type { AgentOutputEntry } from '../stores/agentStore';

/**
 * Subscribes to 7 AGENT_* WS message types and dispatches to agentStore.
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
      setStatus(p.status);
      if (p.sessionId && p.model && p.startedAt) {
        setSession(p.sessionId, p.model, p.startedAt);
      }
    }));

    unsubs.push(client.on('AGENT_LOCATION_UPDATE', (msg) => {
      const p = msg.payload as { location: AgentLocation };
      setLocation(p.location);
    }));

    unsubs.push(client.on('AGENT_PLAN_UPDATE', (msg) => {
      const p = msg.payload as { plan: AgentPlan };
      setPlan(p.plan);
    }));

    unsubs.push(client.on('AGENT_BREADCRUMB', (msg) => {
      const p = msg.payload as { breadcrumb: AgentBreadcrumb };
      addBreadcrumb(p.breadcrumb);
    }));

    unsubs.push(client.on('AGENT_OUTPUT', (msg) => {
      const p = msg.payload as AgentOutputEntry & { projectId: string };
      addOutput({
        text: p.text,
        type: p.type,
        timestamp: p.timestamp,
        toolName: p.toolName,
        input: p.input,
      });
    }));

    unsubs.push(client.on('AGENT_TOKEN_USAGE', (msg) => {
      const p = msg.payload as { inputTokens: number; outputTokens: number };
      setTokenUsage(p);
    }));

    unsubs.push(client.on('AGENT_ERROR', (msg) => {
      const p = msg.payload as { error: string };
      setError(p.error);
    }));

    unsubs.push(client.on('DEV_SERVER_STATUS', (msg) => {
      const p = msg.payload as {
        status: 'installing' | 'starting' | 'ready' | 'error' | 'stopped';
        port: number;
        url: string;
        projectType?: string;
        error?: string;
      };
      setDevServer(p.status === 'stopped' ? null : p);
    }));

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [client, setSession, setStatus, setLocation, setPlan, addBreadcrumb, addOutput, setTokenUsage, setError, setDevServer]);
}
