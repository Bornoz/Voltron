import { create } from 'zustand';
import type { AgentStatus, AgentActivity, AgentLocation, AgentPlan, AgentBreadcrumb } from '@voltron/shared';

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
  reset: () => void;
}

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

  reset: () => set(initialState),
}));

export type { AgentOutputEntry, AgentTokenUsage };
