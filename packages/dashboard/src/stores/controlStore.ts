import { create } from 'zustand';
import type { ExecutionState, ExecutionContext } from '@voltron/shared';

export interface ControlHistoryEntry {
  state: ExecutionState;
  timestamp: number;
  reason?: string;
  actor?: string;
}

interface ControlState {
  executionState: ExecutionState;
  context: ExecutionContext | null;
  history: ControlHistoryEntry[];

  setExecutionState: (state: ExecutionState) => void;
  setContext: (ctx: ExecutionContext) => void;
  setState: (state: ExecutionState, ctx: ExecutionContext) => void;
  addHistoryEntry: (entry: ControlHistoryEntry) => void;
  setHistory: (entries: ControlHistoryEntry[]) => void;
}

export const useControlStore = create<ControlState>((set) => ({
  executionState: 'IDLE',
  context: null,
  history: [],

  setExecutionState: (executionState) => set({ executionState }),

  setContext: (context) => set({ context }),

  setState: (executionState, context) => set({ executionState, context }),

  addHistoryEntry: (entry) =>
    set((state) => ({
      history: [entry, ...state.history].slice(0, 100),
    })),

  setHistory: (history) => set({ history }),
}));
