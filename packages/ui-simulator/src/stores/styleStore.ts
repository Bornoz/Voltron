import { create } from 'zustand';

export interface StyleEntry {
  property: string;
  value: string;
  previousValue?: string;
  source: 'human' | 'ai' | 'initial';
  timestamp: number;
}

interface StyleStoreState {
  // Map of CSS selector -> Map of property -> StyleEntry
  activeStyles: Map<string, Map<string, StyleEntry>>;

  // Pending changes not yet applied
  pendingChanges: Map<string, Map<string, StyleEntry>>;

  // Actions
  setStyle: (selector: string, property: string, value: string, source?: 'human' | 'ai') => void;
  removeStyle: (selector: string, property: string) => void;
  getStylesForElement: (selector: string) => Map<string, StyleEntry>;
  applyPending: (selector: string) => StyleEntry[];
  clearPending: (selector: string) => void;
  clearAllStyles: () => void;
  bulkSetStyles: (selector: string, styles: Record<string, string>, source?: 'human' | 'ai') => void;
}

export const useStyleStore = create<StyleStoreState>((set, get) => ({
  activeStyles: new Map(),
  pendingChanges: new Map(),

  setStyle: (selector, property, value, source = 'human') => {
    set((state) => {
      const newPending = new Map(state.pendingChanges);
      const selectorMap = new Map(newPending.get(selector) ?? new Map());

      const existingActive = state.activeStyles.get(selector);
      const previousValue = existingActive?.get(property)?.value;

      selectorMap.set(property, {
        property,
        value,
        previousValue,
        source,
        timestamp: Date.now(),
      });

      newPending.set(selector, selectorMap);
      return { pendingChanges: newPending };
    });
  },

  removeStyle: (selector, property) => {
    set((state) => {
      const newActive = new Map(state.activeStyles);
      const selectorMap = newActive.get(selector);
      if (selectorMap) {
        const newSelectorMap = new Map(selectorMap);
        newSelectorMap.delete(property);
        if (newSelectorMap.size === 0) {
          newActive.delete(selector);
        } else {
          newActive.set(selector, newSelectorMap);
        }
      }

      const newPending = new Map(state.pendingChanges);
      const pendingSelectorMap = newPending.get(selector);
      if (pendingSelectorMap) {
        const newPendingSelectorMap = new Map(pendingSelectorMap);
        newPendingSelectorMap.delete(property);
        if (newPendingSelectorMap.size === 0) {
          newPending.delete(selector);
        } else {
          newPending.set(selector, newPendingSelectorMap);
        }
      }

      return { activeStyles: newActive, pendingChanges: newPending };
    });
  },

  getStylesForElement: (selector) => {
    return get().activeStyles.get(selector) ?? new Map();
  },

  applyPending: (selector) => {
    const state = get();
    const pending = state.pendingChanges.get(selector);
    if (!pending || pending.size === 0) return [];

    const applied: StyleEntry[] = [];

    set((s) => {
      const newActive = new Map(s.activeStyles);
      const existingMap = new Map(newActive.get(selector) ?? new Map());
      const pendingMap = s.pendingChanges.get(selector);

      if (pendingMap) {
        for (const [prop, entry] of pendingMap) {
          existingMap.set(prop, entry);
          applied.push(entry);
        }
      }

      newActive.set(selector, existingMap);

      const newPending = new Map(s.pendingChanges);
      newPending.delete(selector);

      return { activeStyles: newActive, pendingChanges: newPending };
    });

    return applied;
  },

  clearPending: (selector) => {
    set((state) => {
      const newPending = new Map(state.pendingChanges);
      newPending.delete(selector);
      return { pendingChanges: newPending };
    });
  },

  clearAllStyles: () => {
    set({ activeStyles: new Map(), pendingChanges: new Map() });
  },

  bulkSetStyles: (selector, styles, source = 'human') => {
    set((state) => {
      const newPending = new Map(state.pendingChanges);
      const selectorMap = new Map(newPending.get(selector) ?? new Map());
      const existingActive = state.activeStyles.get(selector);

      for (const [property, value] of Object.entries(styles)) {
        const previousValue = existingActive?.get(property)?.value;
        selectorMap.set(property, {
          property,
          value,
          previousValue,
          source,
          timestamp: Date.now(),
        });
      }

      newPending.set(selector, selectorMap);
      return { pendingChanges: newPending };
    });
  },
}));
