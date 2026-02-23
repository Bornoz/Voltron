import { create } from 'zustand';

export interface HistoryEntry {
  id: string;
  type: 'style' | 'layout' | 'prop' | 'add' | 'delete' | 'move' | 'duplicate';
  selector: string;
  description: string;
  timestamp: number;
  forward: ChangeRecord;
  backward: ChangeRecord;
}

export interface ChangeRecord {
  selector: string;
  changes: Array<{
    property: string;
    value: string;
  }>;
  // For add/delete/duplicate operations
  elementHTML?: string;
  parentSelector?: string;
  indexInParent?: number;
}

interface HistoryState {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  maxSize: number;

  push: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  getUndoDescription: () => string | null;
  getRedoDescription: () => string | null;
}

let entryCounter = 0;

export function createHistoryEntry(
  type: HistoryEntry['type'],
  selector: string,
  description: string,
  forward: ChangeRecord,
  backward: ChangeRecord,
): HistoryEntry {
  return {
    id: `hist_${Date.now()}_${entryCounter++}`,
    type,
    selector,
    description,
    timestamp: Date.now(),
    forward,
    backward,
  };
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxSize: 100,

  push: (entry) => {
    set((state) => {
      const newUndo = [...state.undoStack, entry];
      // Trim if exceeding max size
      if (newUndo.length > state.maxSize) {
        newUndo.shift();
      }
      return {
        undoStack: newUndo,
        redoStack: [], // Clear redo on new action
      };
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return null;

    const entry = state.undoStack[state.undoStack.length - 1];
    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    });
    return entry;
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return null;

    const entry = state.redoStack[state.redoStack.length - 1];
    set({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, entry],
    });
    return entry;
  },

  canUndo: () => get().undoStack.length > 0,

  canRedo: () => get().redoStack.length > 0,

  clear: () => set({ undoStack: [], redoStack: [] }),

  getUndoDescription: () => {
    const stack = get().undoStack;
    return stack.length > 0 ? stack[stack.length - 1].description : null;
  },

  getRedoDescription: () => {
    const stack = get().redoStack;
    return stack.length > 0 ? stack[stack.length - 1].description : null;
  },
}));
