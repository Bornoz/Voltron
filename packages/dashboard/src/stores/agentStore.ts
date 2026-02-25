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

  setPlan: (plan) => set({ plan }),

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

  reset: () => set(initialState),
}));

export type { AgentOutputEntry, AgentTokenUsage };
