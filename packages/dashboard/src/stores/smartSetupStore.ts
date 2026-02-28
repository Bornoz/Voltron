import { create } from 'zustand';
import type { SmartSetupRunResponse } from '../lib/api';
import {
  startSmartSetup,
  getSmartSetupRuns,
  getSmartSetupRun,
  applySmartSetup,
} from '../lib/api';

interface SmartSetupState {
  currentRun: SmartSetupRunResponse | null;
  runs: SmartSetupRunResponse[];
  isLoading: boolean;
  error: string | null;
  pollingTimer: ReturnType<typeof setInterval> | null;

  // Actions
  startRun: (projectId: string, skipGithub: boolean) => Promise<void>;
  loadRuns: (projectId: string) => Promise<void>;
  loadRun: (projectId: string, runId: string) => Promise<void>;
  toggleRepoSelection: (repoId: string) => void;
  applySelected: (projectId: string, runId: string) => Promise<void>;
  setCurrentRun: (run: SmartSetupRunResponse | null) => void;
  stopPolling: () => void;
  reset: () => void;
}

export const useSmartSetupStore = create<SmartSetupState>((set, get) => ({
  currentRun: null,
  runs: [],
  isLoading: false,
  error: null,
  pollingTimer: null,

  startRun: async (projectId, skipGithub) => {
    set({ isLoading: true, error: null });
    try {
      const { runId } = await startSmartSetup(projectId, skipGithub);

      // Start polling for status updates
      const poll = async () => {
        try {
          const run = await getSmartSetupRun(projectId, runId);
          set({ currentRun: run });

          // Stop polling when terminal state reached
          if (['ready', 'completed', 'failed'].includes(run.status)) {
            get().stopPolling();
            set({ isLoading: false });
          }
        } catch {
          // polling error — keep trying
        }
      };

      // Initial fetch
      await poll();

      // Continue polling every 2s
      const timer = setInterval(poll, 2000);
      set({ pollingTimer: timer });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        isLoading: false,
      });
    }
  },

  loadRuns: async (projectId) => {
    try {
      const runs = await getSmartSetupRuns(projectId);
      set({ runs });
    } catch {
      // silent
    }
  },

  loadRun: async (projectId, runId) => {
    try {
      const run = await getSmartSetupRun(projectId, runId);
      set({ currentRun: run });
    } catch {
      // silent
    }
  },

  toggleRepoSelection: (repoId) => {
    set((state) => {
      if (!state.currentRun) return state;
      const discoveries = state.currentRun.discoveries.map((d) =>
        d.id === repoId ? { ...d, selected: !d.selected } : d,
      );
      return { currentRun: { ...state.currentRun, discoveries } };
    });
  },

  applySelected: async (projectId, runId) => {
    const run = get().currentRun;
    if (!run) return;

    const selectedIds = run.discoveries.filter((d) => d.selected).map((d) => d.id);
    if (selectedIds.length === 0) return;

    set({ isLoading: true, error: null });
    try {
      await applySmartSetup(projectId, runId, selectedIds);
      // Reload to get updated status
      const updated = await getSmartSetupRun(projectId, runId);
      set({ currentRun: updated, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Apply failed',
        isLoading: false,
      });
    }
  },

  setCurrentRun: (run) => set({ currentRun: run }),

  stopPolling: () => {
    const timer = get().pollingTimer;
    if (timer) {
      clearInterval(timer);
      set({ pollingTimer: null });
    }
  },

  reset: () => {
    get().stopPolling();
    set({ currentRun: null, runs: [], isLoading: false, error: null });
  },
}));
