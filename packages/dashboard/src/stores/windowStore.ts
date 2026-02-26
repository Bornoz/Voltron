import { create } from 'zustand';

/* ─── Panel IDs ─── */

export type PanelId =
  | 'visual-editor'
  | 'gps-navigator'
  | 'agent-tracker'
  | 'phase-viewer'
  | 'prompt-injector'
  | 'activity-timeline'
  | 'agent-output'
  | 'rules-editor'
  | 'memory-manager'
  | 'session-history';

/* ─── Panel State ─── */

export interface PanelState {
  id: PanelId;
  title: string; // i18n key
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  visible: boolean;
  minimized: boolean;
  maximized: boolean;
  preMaximize: { x: number; y: number; width: number; height: number } | null;
}

/* ─── Presets ─── */

export type WindowPreset = 'ide-style' | 'gps-focus' | 'monitor';

/* ─── Store Shape ─── */

interface WindowState {
  panels: Record<PanelId, PanelState>;
  activePanel: PanelId | null;
  isDragging: boolean;
  isResizing: boolean;
  isPanning: boolean;
  panX: number;
  panY: number;
  nextZIndex: number;
  viewportWidth: number;
  viewportHeight: number;

  // Actions
  movePanel: (id: PanelId, x: number, y: number) => void;
  resizePanel: (id: PanelId, width: number, height: number, x?: number, y?: number) => void;
  bringToFront: (id: PanelId) => void;
  toggleMinimize: (id: PanelId) => void;
  toggleMaximize: (id: PanelId) => void;
  toggleVisibility: (id: PanelId) => void;
  setActivePanel: (id: PanelId | null) => void;
  setDragging: (dragging: boolean) => void;
  setResizing: (resizing: boolean) => void;
  setPanning: (panning: boolean) => void;
  pan: (dx: number, dy: number) => void;
  resetPan: () => void;
  setViewportSize: (w: number, h: number) => void;
  applyPreset: (preset: WindowPreset) => void;
  resetToDefault: () => void;
  saveLayout: () => void;
  loadLayout: () => void;
  cyclePanel: () => void;
}

/* ─── Defaults (percentage → computed on first render) ─── */

const STORAGE_KEY = 'voltron_window_layout_v1';
const SCHEMA_VERSION = 2;

function buildDefaultPanels(vw: number, vh: number): Record<PanelId, PanelState> {
  return {
    'visual-editor': {
      id: 'visual-editor',
      title: 'agent.windowManager.panelVisualEditor',
      x: 0, y: 0,
      width: Math.round(vw * 0.55), height: vh,
      minWidth: 400, minHeight: 300,
      zIndex: 10, visible: true, minimized: false, maximized: false, preMaximize: null,
    },
    'gps-navigator': {
      id: 'gps-navigator',
      title: 'agent.windowManager.panelGpsNavigator',
      x: Math.round(vw * 0.56), y: 0,
      width: Math.round(vw * 0.44), height: Math.round(vh * 0.45),
      minWidth: 300, minHeight: 250,
      zIndex: 11, visible: true, minimized: false, maximized: false, preMaximize: null,
    },
    'agent-tracker': {
      id: 'agent-tracker',
      title: 'agent.windowManager.panelAgentTracker',
      x: Math.round(vw * 0.56), y: Math.round(vh * 0.46),
      width: Math.round(vw * 0.44), height: Math.round(vh * 0.14),
      minWidth: 300, minHeight: 100,
      zIndex: 12, visible: true, minimized: false, maximized: false, preMaximize: null,
    },
    'phase-viewer': {
      id: 'phase-viewer',
      title: 'agent.windowManager.panelPhaseViewer',
      x: Math.round(vw * 0.56), y: Math.round(vh * 0.61),
      width: Math.round(vw * 0.44), height: Math.round(vh * 0.19),
      minWidth: 300, minHeight: 150,
      zIndex: 13, visible: true, minimized: false, maximized: false, preMaximize: null,
    },
    'prompt-injector': {
      id: 'prompt-injector',
      title: 'agent.windowManager.panelPromptInjector',
      x: Math.round(vw * 0.56), y: Math.round(vh * 0.81),
      width: Math.round(vw * 0.44), height: Math.round(vh * 0.19),
      minWidth: 300, minHeight: 120,
      zIndex: 14, visible: true, minimized: false, maximized: false, preMaximize: null,
    },
    'activity-timeline': {
      id: 'activity-timeline',
      title: 'agent.windowManager.panelActivityTimeline',
      x: Math.round(vw * 0.3), y: Math.round(vh * 0.2),
      width: 350, height: 400,
      minWidth: 250, minHeight: 200,
      zIndex: 15, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'agent-output': {
      id: 'agent-output',
      title: 'agent.windowManager.panelAgentOutput',
      x: 0, y: Math.round(vh - 250),
      width: vw, height: 250,
      minWidth: 300, minHeight: 150,
      zIndex: 16, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'rules-editor': {
      id: 'rules-editor',
      title: 'agent.windowManager.panelRulesEditor',
      x: Math.round((vw - 450) / 2), y: Math.round((vh - 500) / 2),
      width: 450, height: 500,
      minWidth: 300, minHeight: 250,
      zIndex: 17, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'memory-manager': {
      id: 'memory-manager',
      title: 'agent.windowManager.panelMemoryManager',
      x: Math.round((vw - 450) / 2) + 30, y: Math.round((vh - 550) / 2) + 30,
      width: 450, height: 550,
      minWidth: 300, minHeight: 300,
      zIndex: 18, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'session-history': {
      id: 'session-history',
      title: 'agent.windowManager.panelSessionHistory',
      x: Math.round((vw - 420) / 2) + 60, y: Math.round((vh - 600) / 2) + 60,
      width: 420, height: 600,
      minWidth: 280, minHeight: 300,
      zIndex: 19, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
  };
}

function buildPresetPanels(preset: WindowPreset, vw: number, vh: number): Record<PanelId, PanelState> {
  const base = buildDefaultPanels(vw, vh);

  switch (preset) {
    case 'ide-style':
      return base; // default is already IDE style

    case 'gps-focus': {
      const gpsW = Math.round(vw * 0.6);
      const sideW = vw - gpsW - 8;
      base['gps-navigator'].x = 0;
      base['gps-navigator'].y = 0;
      base['gps-navigator'].width = gpsW;
      base['gps-navigator'].height = vh;

      base['visual-editor'].x = gpsW + 8;
      base['visual-editor'].y = 0;
      base['visual-editor'].width = sideW;
      base['visual-editor'].height = Math.round(vh * 0.5);

      base['agent-tracker'].x = gpsW + 8;
      base['agent-tracker'].y = Math.round(vh * 0.51);
      base['agent-tracker'].width = sideW;
      base['agent-tracker'].height = Math.round(vh * 0.14);

      base['phase-viewer'].x = gpsW + 8;
      base['phase-viewer'].y = Math.round(vh * 0.66);
      base['phase-viewer'].width = sideW;
      base['phase-viewer'].height = Math.round(vh * 0.17);

      base['prompt-injector'].x = gpsW + 8;
      base['prompt-injector'].y = Math.round(vh * 0.84);
      base['prompt-injector'].width = sideW;
      base['prompt-injector'].height = Math.round(vh * 0.16);
      return base;
    }

    case 'monitor': {
      const cols = 3;
      const rows = 4;
      const cellW = Math.floor(vw / cols);
      const cellH = Math.floor(vh / rows);
      const allIds: PanelId[] = [
        'visual-editor', 'gps-navigator', 'agent-tracker',
        'phase-viewer', 'prompt-injector', 'activity-timeline',
        'agent-output', 'rules-editor', 'memory-manager',
        'session-history',
      ];
      let idx = 0;
      for (const id of allIds) {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        base[id].x = col * cellW;
        base[id].y = row * cellH;
        base[id].width = cellW - 4;
        base[id].height = cellH - 4;
        base[id].visible = true;
        base[id].minimized = false;
        base[id].maximized = false;
        base[id].preMaximize = null;
        idx++;
      }
      return base;
    }
  }
}

/* ─── Persistence ─── */

interface StoredLayout {
  version: number;
  panels: Record<string, Omit<PanelState, 'preMaximize'>>;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(panels: Record<PanelId, PanelState>) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const data: StoredLayout = {
        version: SCHEMA_VERSION,
        panels: {} as Record<string, Omit<PanelState, 'preMaximize'>>,
      };
      for (const [id, p] of Object.entries(panels)) {
        const { preMaximize: _, ...rest } = p;
        data.panels[id] = rest;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }, 300);
}

function loadFromStorage(): Record<PanelId, PanelState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredLayout;
    if (data.version !== SCHEMA_VERSION) return null;

    const defaults = buildDefaultPanels(window.innerWidth, window.innerHeight);
    const result: Record<string, PanelState> = {} as Record<PanelId, PanelState>;
    for (const id of Object.keys(defaults) as PanelId[]) {
      const stored = data.panels[id];
      if (stored) {
        result[id] = { ...stored, preMaximize: null };
      } else {
        result[id] = defaults[id];
      }
    }
    return result as Record<PanelId, PanelState>;
  } catch {
    return null;
  }
}

/* ─── Initial State ─── */

const fallbackVW = typeof window !== 'undefined' ? window.innerWidth : 1200;
const fallbackVH = typeof window !== 'undefined' ? window.innerHeight - 120 : 700;

const initialPanels = loadFromStorage() ?? buildDefaultPanels(fallbackVW, fallbackVH);

/* ─── Store ─── */

export const useWindowStore = create<WindowState>((set, get) => ({
  panels: initialPanels,
  activePanel: null,
  isDragging: false,
  isResizing: false,
  isPanning: false,
  panX: 0,
  panY: 0,
  nextZIndex: 20,
  viewportWidth: fallbackVW,
  viewportHeight: fallbackVH,

  movePanel: (id, x, y) => set((s) => {
    const panel = s.panels[id];
    if (!panel) return s;
    const newPanels = {
      ...s.panels,
      [id]: { ...panel, x, y },
    };
    debouncedSave(newPanels);
    return { panels: newPanels };
  }),

  resizePanel: (id, width, height, x?, y?) => set((s) => {
    const panel = s.panels[id];
    if (!panel) return s;
    const newPanels = {
      ...s.panels,
      [id]: {
        ...panel,
        width: Math.max(panel.minWidth, width),
        height: Math.max(panel.minHeight, height),
        ...(x != null ? { x } : {}),
        ...(y != null ? { y } : {}),
      },
    };
    debouncedSave(newPanels);
    return { panels: newPanels };
  }),

  bringToFront: (id) => set((s) => {
    const panel = s.panels[id];
    if (!panel) return s;
    const z = s.nextZIndex;
    return {
      panels: { ...s.panels, [id]: { ...panel, zIndex: z } },
      nextZIndex: z + 1,
      activePanel: id,
    };
  }),

  toggleMinimize: (id) => set((s) => {
    const panel = s.panels[id];
    if (!panel) return s;
    const newPanels = {
      ...s.panels,
      [id]: { ...panel, minimized: !panel.minimized },
    };
    debouncedSave(newPanels);
    return { panels: newPanels };
  }),

  toggleMaximize: (id) => set((s) => {
    const panel = s.panels[id];
    if (!panel) return s;
    if (panel.maximized) {
      // Restore
      const prev = panel.preMaximize ?? { x: 50, y: 50, width: 400, height: 300 };
      const newPanels = {
        ...s.panels,
        [id]: { ...panel, ...prev, maximized: false, preMaximize: null },
      };
      debouncedSave(newPanels);
      return { panels: newPanels };
    } else {
      // Maximize
      const z = s.nextZIndex;
      const newPanels = {
        ...s.panels,
        [id]: {
          ...panel,
          preMaximize: { x: panel.x, y: panel.y, width: panel.width, height: panel.height },
          x: 0, y: 0,
          width: s.viewportWidth,
          height: s.viewportHeight,
          maximized: true,
          zIndex: z,
        },
      };
      debouncedSave(newPanels);
      return { panels: newPanels, nextZIndex: z + 1 };
    }
  }),

  toggleVisibility: (id) => set((s) => {
    const panel = s.panels[id];
    if (!panel) return s;
    const newVisible = !panel.visible;
    const newPanels = {
      ...s.panels,
      [id]: {
        ...panel,
        visible: newVisible,
        minimized: newVisible ? panel.minimized : false,
      },
    };
    debouncedSave(newPanels);
    return { panels: newPanels };
  }),

  setActivePanel: (id) => set({ activePanel: id }),

  setDragging: (dragging) => set({ isDragging: dragging }),

  setResizing: (resizing) => set({ isResizing: resizing }),

  setPanning: (panning) => set({ isPanning: panning }),

  pan: (dx, dy) => set((s) => ({
    panX: s.panX + dx,
    panY: s.panY + dy,
  })),

  resetPan: () => set({ panX: 0, panY: 0 }),

  setViewportSize: (w, h) => set({ viewportWidth: w, viewportHeight: h }),

  applyPreset: (preset) => set((s) => {
    const newPanels = buildPresetPanels(preset, s.viewportWidth, s.viewportHeight);
    let z = s.nextZIndex;
    for (const id of Object.keys(newPanels) as PanelId[]) {
      newPanels[id].zIndex = z++;
    }
    debouncedSave(newPanels);
    return { panels: newPanels, nextZIndex: z };
  }),

  resetToDefault: () => set((s) => {
    const newPanels = buildDefaultPanels(s.viewportWidth, s.viewportHeight);
    let z = s.nextZIndex;
    for (const id of Object.keys(newPanels) as PanelId[]) {
      newPanels[id].zIndex = z++;
    }
    debouncedSave(newPanels);
    return { panels: newPanels, nextZIndex: z };
  }),

  saveLayout: () => {
    debouncedSave(get().panels);
  },

  loadLayout: () => {
    const loaded = loadFromStorage();
    if (loaded) set({ panels: loaded });
  },

  cyclePanel: () => set((s) => {
    const visibleIds = (Object.keys(s.panels) as PanelId[]).filter(
      (id) => s.panels[id].visible && !s.panels[id].minimized,
    );
    if (visibleIds.length === 0) return s;
    const currentIdx = s.activePanel ? visibleIds.indexOf(s.activePanel) : -1;
    const nextIdx = (currentIdx + 1) % visibleIds.length;
    const nextId = visibleIds[nextIdx];
    const z = s.nextZIndex;
    return {
      panels: { ...s.panels, [nextId]: { ...s.panels[nextId], zIndex: z } },
      activePanel: nextId,
      nextZIndex: z + 1,
    };
  }),
}));
