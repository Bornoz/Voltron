import { useEffect, useRef } from 'react';
import { useAgentStore } from '../stores/agentStore';
import * as api from '../lib/api';
import type { AgentBreadcrumb } from '@voltron/shared';

/**
 * Hydrates agentStore with historical data from the API when projectId changes.
 * This ensures that breadcrumbs, plan, session info, and injections persist
 * across page refreshes — they're loaded from the DB, not just WS events.
 */
export function useAgentHydration(projectId: string | null): void {
  const hydrate = useAgentStore((s) => s.hydrate);
  const currentStatus = useAgentStore((s) => s.status);
  const lastProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    // Only hydrate when project changes, not on every re-render
    if (lastProjectRef.current === projectId) return;
    lastProjectRef.current = projectId;

    let cancelled = false;

    const loadHistoricalData = async () => {
      try {
        // Fetch current session, breadcrumbs, plan, and injections in parallel
        const [session, breadcrumbs, plan, injections] = await Promise.all([
          api.getAgentSession(projectId).catch(() => null),
          api.getAgentBreadcrumbs(projectId).catch(() => []),
          api.getAgentPlan(projectId).catch(() => null),
          api.getAgentInjections(projectId).catch(() => []),
        ]);

        if (cancelled) return;

        // Don't overwrite active WS data if agent is already streaming
        const storeStatus = useAgentStore.getState().status;
        if (['RUNNING', 'SPAWNING', 'INJECTING'].includes(storeStatus)) {
          // Agent is actively streaming — don't overwrite with stale API data
          // But we can still fill in missing breadcrumbs
          const existing = useAgentStore.getState().breadcrumbs;
          if (existing.length === 0 && Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
            hydrate({
              breadcrumbs: normalizeBreadcrumbs(breadcrumbs).reverse(),
            });
          }
          return;
        }

        // Build hydration payload
        const hydrateData: Parameters<typeof hydrate>[0] = {};

        // Session info
        if (session && typeof session === 'object') {
          const s = session as Record<string, unknown>;
          if (s.sessionId) hydrateData.sessionId = s.sessionId as string;
          if (s.model) hydrateData.model = s.model as string;
          if (s.startedAt) hydrateData.startedAt = s.startedAt as number;
          if (typeof s.inputTokens === 'number' && typeof s.outputTokens === 'number') {
            hydrateData.tokenUsage = {
              inputTokens: s.inputTokens as number,
              outputTokens: s.outputTokens as number,
            };
          }
          // If server reports no active process (status not RUNNING/PAUSED/SPAWNING),
          // treat as completed to avoid showing stale "in-progress" data
          const serverStatus = (s.status as string) ?? 'IDLE';
          const isActiveOnServer = ['RUNNING', 'PAUSED', 'SPAWNING', 'INJECTING'].includes(serverStatus);
          if (isActiveOnServer) {
            hydrateData.status = serverStatus as any;
          } else {
            // Session exists but is not active — show as completed or idle
            hydrateData.status = (serverStatus === 'COMPLETED' ? 'COMPLETED' : serverStatus === 'CRASHED' ? 'CRASHED' : 'IDLE') as any;
          }
        } else {
          // No session at all — reset to idle
          hydrate({ status: 'IDLE' as any });
          return;
        }

        // Breadcrumbs (API returns DESC order, reverse for chronological)
        if (Array.isArray(breadcrumbs) && breadcrumbs.length > 0) {
          hydrateData.breadcrumbs = normalizeBreadcrumbs(breadcrumbs).reverse();
        }

        // Plan
        if (plan && typeof plan === 'object') {
          const p = plan as Record<string, unknown>;
          if (p.summary && Array.isArray(p.steps)) {
            hydrateData.plan = {
              summary: p.summary as string,
              steps: (p.steps as Array<Record<string, unknown>>).map((step, i) => ({
                index: (step.index as number) ?? i,
                description: (step.description as string) ?? '',
                status: ((step.status as string) ?? 'pending') as 'pending' | 'active' | 'completed' | 'skipped',
                filePath: step.filePath as string | undefined,
              })),
              currentStepIndex: (p.currentStepIndex as number) ?? 0,
              totalSteps: (p.totalSteps as number) ?? (p.steps as unknown[]).length,
              confidence: (p.confidence as number) ?? 0,
            };
          }
        }

        // Injections
        if (Array.isArray(injections) && injections.length > 0) {
          hydrateData.injections = (injections as Array<Record<string, unknown>>).map((inj) => ({
            id: (inj.id as string) ?? '',
            prompt: (inj.prompt as string) ?? '',
            queuedAt: (inj.injectedAt as number) ?? (inj.injected_at as number) ?? Date.now(),
            status: 'applied',
          }));
        }

        // Only hydrate if we have data
        if (Object.keys(hydrateData).length > 0) {
          hydrate(hydrateData);
        }
      } catch (err) {
        console.warn('[useAgentHydration] Failed to load historical data:', err);
      }
    };

    loadHistoricalData();

    return () => {
      cancelled = true;
    };
  }, [projectId, hydrate]);
}

/**
 * Normalize breadcrumb records from API (snake_case DB fields → camelCase).
 */
function normalizeBreadcrumbs(raw: unknown[]): AgentBreadcrumb[] {
  return raw.map((r) => {
    const rec = r as Record<string, unknown>;
    return {
      filePath: (rec.filePath ?? rec.file_path ?? '') as string,
      activity: (rec.activity ?? 'IDLE') as AgentBreadcrumb['activity'],
      timestamp: (rec.timestamp ?? Date.now()) as number,
      toolName: (rec.toolName ?? rec.tool_name) as string | undefined,
      lineRange: rec.lineStart
        ? { start: rec.lineStart as number, end: (rec.lineEnd ?? rec.lineStart) as number }
        : rec.line_start
          ? { start: rec.line_start as number, end: (rec.line_end ?? rec.line_start) as number }
          : undefined,
      contentSnippet: (rec.contentSnippet ?? rec.content_snippet) as string | undefined,
      editDiff: (rec.editDiff ?? rec.edit_diff) as string | undefined,
    };
  });
}
