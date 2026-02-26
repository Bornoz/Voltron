import { create } from 'zustand';
import type { AgentStatus, AgentActivity, AgentLocation, AgentPlan, AgentBreadcrumb, Phase, PhaseEdit, PhaseExecution } from '@voltron/shared';

// Re-export shared Phase types for consumers
export type { Phase, PhaseEdit, PhaseExecution };

interface AgentTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

interface AgentOutputEntry {
  text: string;
  type: 'text' | 'delta' | 'tool' | 'error' | 'thinking';
  timestamp: number;
  toolName?: string;
  input?: Record<string, unknown>;
}

interface DevServerState {
  status: 'installing' | 'starting' | 'ready' | 'error' | 'stopped';
  port: number;
  url: string;
  projectType?: string;
  error?: string;
}

/* ─── Prompt Pin Types ─── */

export interface PromptPin {
  id: string;
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  prompt: string;
  nearestSelector: string;
  nearestElementDesc: string;
  createdAt: number;
}

/* ─── Reference Image ─── */

export interface ReferenceImage {
  dataUrl: string;
  opacity: number;
}

interface AgentState {
  // Session
  sessionId: string | null;
  status: AgentStatus;
  model: string | null;
  startedAt: number | null;

  // GPS
  location: AgentLocation | null;
  currentFile: string | null;
  activity: AgentActivity;

  // Plan
  plan: AgentPlan | null;

  // Breadcrumbs
  breadcrumbs: AgentBreadcrumb[];

  // Output
  output: AgentOutputEntry[];

  // Tokens
  tokenUsage: AgentTokenUsage;

  // Last error
  lastError: string | null;

  // Dev Server
  devServer: DevServerState | null;

  // Phase Execution
  phaseExecution: PhaseExecution;

  // Prompt Pins
  promptPins: PromptPin[];

  // Reference Image
  referenceImage: ReferenceImage | null;

  // Breakpoints
  breakpoints: Set<string>;

  // Injection Queue
  injectionQueue: Array<{ id: string; prompt: string; queuedAt: number; status: string }>;

  // Actions
  setSession: (sessionId: string, model: string, startedAt: number) => void;
  setStatus: (status: AgentStatus) => void;
  setLocation: (location: AgentLocation) => void;
  setPlan: (plan: AgentPlan) => void;
  addBreadcrumb: (crumb: AgentBreadcrumb) => void;
  addOutput: (entry: AgentOutputEntry) => void;
  setTokenUsage: (usage: AgentTokenUsage) => void;
  setError: (error: string) => void;
  setDevServer: (info: DevServerState | null) => void;

  // Phase Actions
  setPhaseExecution: (pe: PhaseExecution) => void;
  approvePhase: (phaseId: string) => void;
  rejectPhase: (phaseId: string) => void;
  nextPhase: () => void;

  // Prompt Pin Actions
  addPromptPin: (pin: PromptPin) => void;
  updatePromptPin: (id: string, update: string | { x?: number; y?: number; prompt?: string }) => void;
  removePromptPin: (id: string) => void;
  clearPromptPins: () => void;

  // Reference Image Actions
  setReferenceImage: (img: ReferenceImage | null) => void;
  setReferenceOpacity: (opacity: number) => void;

  // Breakpoint Actions
  addBreakpoint: (filePath: string) => void;
  removeBreakpoint: (filePath: string) => void;

  // Injection Queue Actions
  addToInjectionQueue: (entry: { id: string; prompt: string; queuedAt: number; status: string }) => void;
  updateInjectionQueueEntry: (id: string, status: string) => void;

  // Hydration Actions (load historical data from API)
  hydrate: (data: {
    sessionId?: string | null;
    status?: AgentStatus;
    model?: string | null;
    startedAt?: number | null;
    breadcrumbs?: AgentBreadcrumb[];
    plan?: AgentPlan | null;
    tokenUsage?: AgentTokenUsage;
    injections?: Array<{ id: string; prompt: string; queuedAt: number; status: string }>;
    output?: AgentOutputEntry[];
  }) => void;

  reset: () => void;
}

const initialPhaseExecution: PhaseExecution = {
  phases: [],
  currentPhaseIndex: 0,
  status: 'idle',
};

const initialState = {
  sessionId: null,
  status: 'IDLE' as AgentStatus,
  model: null,
  startedAt: null,
  location: null,
  currentFile: null,
  activity: 'IDLE' as AgentActivity,
  plan: null,
  breadcrumbs: [],
  output: [],
  tokenUsage: { inputTokens: 0, outputTokens: 0 },
  lastError: null,
  devServer: null,
  phaseExecution: initialPhaseExecution,
  promptPins: [] as PromptPin[],
  referenceImage: null as ReferenceImage | null,
  breakpoints: new Set<string>(),
  injectionQueue: [] as Array<{ id: string; prompt: string; queuedAt: number; status: string }>,
};

export const useAgentStore = create<AgentState>((set) => ({
  ...initialState,

  setSession: (sessionId, model, startedAt) =>
    set({ sessionId, model, startedAt, status: 'SPAWNING' }),

  setStatus: (status) =>
    set((state) => {
      if (status === 'COMPLETED' || status === 'CRASHED') {
        return { status, activity: 'IDLE' };
      }
      return { status };
    }),

  setLocation: (location) =>
    set({
      location,
      currentFile: location.filePath,
      activity: location.activity,
    }),

  setPlan: (plan) =>
    set((state) => {
      // Auto-generate phases from plan steps so PhaseTracker renders
      if (plan?.steps && plan.steps.length > 0) {
        const phases = plan.steps.map((step: { description: string }, i: number) => ({
          id: `phase_${i}_${Date.now()}`,
          title: step.description,
          edits: [] as PhaseEdit[],
          status: (i === 0 ? 'running' : 'pending') as Phase['status'],
        }));
        return {
          plan,
          phaseExecution: {
            phases,
            currentPhaseIndex: 0,
            status: 'running' as const,
          },
        };
      }
      return { plan };
    }),

  addBreadcrumb: (crumb) =>
    set((state) => ({
      breadcrumbs: [...state.breadcrumbs.slice(-499), crumb],
    })),

  addOutput: (entry) =>
    set((state) => ({
      output: [...state.output.slice(-999), entry],
    })),

  setTokenUsage: (tokenUsage) => set({ tokenUsage }),

  setError: (lastError) => set({ lastError }),

  setDevServer: (devServer) => set({ devServer }),

  // Phase Execution
  setPhaseExecution: (phaseExecution) => set({ phaseExecution }),

  approvePhase: (phaseId) =>
    set((state) => {
      const phases = state.phaseExecution.phases.map((p) =>
        p.id === phaseId ? { ...p, status: 'approved' as const } : p,
      );
      return { phaseExecution: { ...state.phaseExecution, phases } };
    }),

  rejectPhase: (phaseId) =>
    set((state) => {
      const phases = state.phaseExecution.phases.map((p) =>
        p.id === phaseId ? { ...p, status: 'rejected' as const } : p,
      );
      return {
        phaseExecution: { ...state.phaseExecution, phases, status: 'failed' },
      };
    }),

  nextPhase: () =>
    set((state) => {
      const nextIdx = state.phaseExecution.currentPhaseIndex + 1;
      if (nextIdx >= state.phaseExecution.phases.length) {
        return {
          phaseExecution: { ...state.phaseExecution, currentPhaseIndex: nextIdx, status: 'completed' },
        };
      }
      const phases = state.phaseExecution.phases.map((p, i) =>
        i === nextIdx ? { ...p, status: 'running' as const } : p,
      );
      return {
        phaseExecution: { ...state.phaseExecution, phases, currentPhaseIndex: nextIdx },
      };
    }),

  // Prompt Pins
  addPromptPin: (pin) =>
    set((state) => ({ promptPins: [...state.promptPins, pin] })),

  updatePromptPin: (id, update) =>
    set((state) => ({
      promptPins: state.promptPins.map((p) => {
        if (p.id !== id) return p;
        if (typeof update === 'string') return { ...p, prompt: update };
        return { ...p, ...update };
      }),
    })),

  removePromptPin: (id) =>
    set((state) => ({
      promptPins: state.promptPins.filter((p) => p.id !== id),
    })),

  clearPromptPins: () => set({ promptPins: [] }),

  // Reference Image
  setReferenceImage: (referenceImage) => set({ referenceImage }),

  setReferenceOpacity: (opacity) =>
    set((state) => {
      if (!state.referenceImage) return {};
      return { referenceImage: { ...state.referenceImage, opacity } };
    }),

  // Breakpoints
  addBreakpoint: (filePath) =>
    set((state) => {
      const next = new Set(state.breakpoints);
      next.add(filePath);
      return { breakpoints: next };
    }),

  removeBreakpoint: (filePath) =>
    set((state) => {
      const next = new Set(state.breakpoints);
      next.delete(filePath);
      return { breakpoints: next };
    }),

  // Injection Queue
  addToInjectionQueue: (entry) =>
    set((state) => ({
      injectionQueue: [...state.injectionQueue, entry],
    })),

  updateInjectionQueueEntry: (id, status) =>
    set((state) => ({
      injectionQueue: state.injectionQueue.map((e) =>
        e.id === id ? { ...e, status } : e,
      ),
    })),

  // Hydration: bulk-load historical data from API
  hydrate: (data) =>
    set((state) => {
      const updates: Partial<AgentState> = {};
      if (data.sessionId !== undefined) updates.sessionId = data.sessionId;
      if (data.status !== undefined) updates.status = data.status;
      if (data.model !== undefined) updates.model = data.model;
      if (data.startedAt !== undefined) updates.startedAt = data.startedAt;
      if (data.breadcrumbs && data.breadcrumbs.length > 0) {
        updates.breadcrumbs = data.breadcrumbs;
        // Derive current file and activity from last breadcrumb
        const last = data.breadcrumbs[data.breadcrumbs.length - 1];
        if (last) {
          updates.currentFile = last.filePath;
          updates.activity = last.activity;
        }
      }
      if (data.plan) {
        updates.plan = data.plan;
        // Auto-generate phases from plan
        if (data.plan.steps && data.plan.steps.length > 0) {
          const phases = data.plan.steps.map((step: { description: string; status?: string }, i: number) => ({
            id: `phase_${i}_hydrated`,
            title: step.description,
            edits: [] as PhaseEdit[],
            status: (step.status === 'completed' ? 'completed' : step.status === 'active' ? 'running' : 'pending') as Phase['status'],
          }));
          const currentIdx = phases.findIndex((p: Phase) => p.status === 'running');
          updates.phaseExecution = {
            phases,
            currentPhaseIndex: currentIdx >= 0 ? currentIdx : 0,
            status: data.plan.steps.some((s: { status?: string }) => s.status === 'active') ? 'running' : 'idle',
          };
        }
      }
      if (data.tokenUsage) updates.tokenUsage = data.tokenUsage;
      if (data.injections && data.injections.length > 0) updates.injectionQueue = data.injections;
      if (data.output && data.output.length > 0) updates.output = data.output;
      return updates;
    }),

  reset: () => set(initialState),
}));

export type { AgentOutputEntry, AgentTokenUsage };
