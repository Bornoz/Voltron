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
const SCHEMA_VERSION = 4; // Bumped: only visual-editor visible by default + panel dock

function buildDefaultPanels(vw: number, vh: number): Record<PanelId, PanelState> {
  // DOCK_WIDTH (40px) is reserved for the panel dock on the right
  const dw = 40;
  const aw = vw - dw; // available width

  return {
    'visual-editor': {
      id: 'visual-editor',
      title: 'agent.windowManager.panelVisualEditor',
      x: 0, y: 0,
      width: aw, height: vh,
      minWidth: 400, minHeight: 300,
      zIndex: 10, visible: true, minimized: false, maximized: false, preMaximize: null,
    },
    'gps-navigator': {
      id: 'gps-navigator',
      title: 'agent.windowManager.panelGpsNavigator',
      x: Math.round(aw * 0.5), y: 0,
      width: Math.round(aw * 0.5), height: Math.round(vh * 0.6),
      minWidth: 300, minHeight: 250,
      zIndex: 11, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'agent-tracker': {
      id: 'agent-tracker',
      title: 'agent.windowManager.panelAgentTracker',
      x: Math.round(aw * 0.5), y: Math.round(vh * 0.6),
      width: Math.round(aw * 0.5), height: Math.round(vh * 0.4),
      minWidth: 300, minHeight: 100,
      zIndex: 12, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'phase-viewer': {
      id: 'phase-viewer',
      title: 'agent.windowManager.panelPhaseViewer',
      x: Math.round(aw * 0.6), y: Math.round(vh * 0.3),
      width: Math.round(aw * 0.4), height: Math.round(vh * 0.35),
      minWidth: 300, minHeight: 150,
      zIndex: 13, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'prompt-injector': {
      id: 'prompt-injector',
      title: 'agent.windowManager.panelPromptInjector',
      x: Math.round(aw * 0.6), y: Math.round(vh * 0.65),
      width: Math.round(aw * 0.4), height: Math.round(vh * 0.35),
      minWidth: 300, minHeight: 120,
      zIndex: 14, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'activity-timeline': {
      id: 'activity-timeline',
      title: 'agent.windowManager.panelActivityTimeline',
      x: Math.round((aw - 400) / 2), y: Math.round((vh - 450) / 2),
      width: 400, height: 450,
      minWidth: 250, minHeight: 200,
      zIndex: 15, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'agent-output': {
      id: 'agent-output',
      title: 'agent.windowManager.panelAgentOutput',
      x: 0, y: Math.round(vh - 280),
      width: aw, height: 280,
      minWidth: 300, minHeight: 150,
      zIndex: 16, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'rules-editor': {
      id: 'rules-editor',
      title: 'agent.windowManager.panelRulesEditor',
      x: Math.round((aw - 450) / 2), y: Math.round((vh - 500) / 2),
      width: 450, height: 500,
      minWidth: 300, minHeight: 250,
      zIndex: 17, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'memory-manager': {
      id: 'memory-manager',
      title: 'agent.windowManager.panelMemoryManager',
      x: Math.round((aw - 450) / 2) + 20, y: Math.round((vh - 550) / 2) + 20,
      width: 450, height: 550,
      minWidth: 300, minHeight: 300,
      zIndex: 18, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
    'session-history': {
      id: 'session-history',
      title: 'agent.windowManager.panelSessionHistory',
      x: Math.round((aw - 420) / 2) + 40, y: Math.round((vh - 600) / 2) + 40,
      width: 420, height: 600,
      minWidth: 280, minHeight: 300,
      zIndex: 19, visible: false, minimized: false, maximized: false, preMaximize: null,
    },
  };
}

function buildPresetPanels(preset: WindowPreset, vw: number, vh: number): Record<PanelId, PanelState> {
  const base = buildDefaultPanels(vw, vh);
  const dw = 40; // dock width
  const aw = vw - dw;

  switch (preset) {
    case 'ide-style': {
      // Editor left 55%, GPS + tracker + plan right 45%
      const leftW = Math.round(aw * 0.55);
      const rightW = aw - leftW - 4;
      const rightX = leftW + 4;

      base['visual-editor'].visible = true;
      base['visual-editor'].width = leftW;
      base['visual-editor'].height = vh;

      base['gps-navigator'].visible = true;
      base['gps-navigator'].x = rightX;
      base['gps-navigator'].y = 0;
      base['gps-navigator'].width = rightW;
      base['gps-navigator'].height = Math.round(vh * 0.5);

      base['agent-tracker'].visible = true;
      base['agent-tracker'].x = rightX;
      base['agent-tracker'].y = Math.round(vh * 0.51);
      base['agent-tracker'].width = rightW;
      base['agent-tracker'].height = Math.round(vh * 0.24);

      base['phase-viewer'].visible = true;
      base['phase-viewer'].x = rightX;
      base['phase-viewer'].y = Math.round(vh * 0.76);
      base['phase-viewer'].width = rightW;
      base['phase-viewer'].height = Math.round(vh * 0.24);
      return base;
    }

    case 'gps-focus': {
      const gpsW = Math.round(aw * 0.6);
      const sideW = aw - gpsW - 4;
      const sideX = gpsW + 4;

      base['gps-navigator'].visible = true;
      base['gps-navigator'].x = 0;
      base['gps-navigator'].y = 0;
      base['gps-navigator'].width = gpsW;
      base['gps-navigator'].height = vh;

      base['visual-editor'].visible = true;
      base['visual-editor'].x = sideX;
      base['visual-editor'].y = 0;
      base['visual-editor'].width = sideW;
      base['visual-editor'].height = Math.round(vh * 0.5);

      base['agent-tracker'].visible = true;
      base['agent-tracker'].x = sideX;
      base['agent-tracker'].y = Math.round(vh * 0.51);
      base['agent-tracker'].width = sideW;
      base['agent-tracker'].height = Math.round(vh * 0.24);

      base['prompt-injector'].visible = true;
      base['prompt-injector'].x = sideX;
      base['prompt-injector'].y = Math.round(vh * 0.76);
      base['prompt-injector'].width = sideW;
      base['prompt-injector'].height = Math.round(vh * 0.24);
      return base;
    }

    case 'monitor': {
      const cols = 3;
      const rows = 4;
      const cellW = Math.floor(aw / cols);
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

  setViewportSize: (w, h) => set((s) => {
    const oldW = s.viewportWidth;
    const oldH = s.viewportHeight;

    // If viewport changed significantly, proportionally reposition panels
    if (oldW > 0 && oldH > 0 && (Math.abs(w - oldW) > 50 || Math.abs(h - oldH) > 50)) {
      const scaleX = w / oldW;
      const scaleY = h / oldH;
      const newPanels = { ...s.panels } as Record<PanelId, PanelState>;
      for (const id of Object.keys(newPanels) as PanelId[]) {
        const p = newPanels[id];
        if (p.maximized) continue;
        const newX = Math.round(p.x * scaleX);
        const newY = Math.round(p.y * scaleY);
        const newW = Math.max(p.minWidth, Math.round(p.width * scaleX));
        const newH = Math.max(p.minHeight, Math.round(p.height * scaleY));
        // Clamp to viewport bounds
        const clampedX = Math.max(0, Math.min(newX, w - 100));
        const clampedY = Math.max(0, Math.min(newY, h - 50));
        newPanels[id] = { ...p, x: clampedX, y: clampedY, width: newW, height: newH };
      }
      debouncedSave(newPanels);
      return { viewportWidth: w, viewportHeight: h, panels: newPanels };
    }

    return { viewportWidth: w, viewportHeight: h };
  }),

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
