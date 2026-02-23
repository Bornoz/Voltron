import { create } from 'zustand';

export interface DesignChange {
  type: 'add' | 'delete' | 'move' | 'duplicate' | 'style';
  selector: string;
  description: string;
  timestamp: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

interface DesignSnapshotState {
  changes: DesignChange[];
  hasChanges: () => boolean;
  addChange: (change: DesignChange) => void;
  clearChanges: () => void;
  getSnapshot: () => { changes: DesignChange[]; count: number; timestamp: number };
}

export const useDesignSnapshotStore = create<DesignSnapshotState>((set, get) => ({
  changes: [],

  hasChanges: () => get().changes.length > 0,

  addChange: (change) =>
    set((state) => ({
      changes: [...state.changes, change],
    })),

  clearChanges: () => set({ changes: [] }),

  getSnapshot: () => {
    const { changes } = get();
    return {
      changes,
      count: changes.length,
      timestamp: Date.now(),
    };
  },
}));
