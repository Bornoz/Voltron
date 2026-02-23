import { create } from 'zustand';

export interface ElementInfo {
  selector: string;
  tagName: string;
  id: string;
  classList: string[];
  computedStyles: Record<string, string>;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  textContent: string;
  attributes: Record<string, string>;
  parentSelector: string | null;
  childCount: number;
}

export interface ViewportSize {
  width: number;
  height: number;
  label: string;
}

interface PendingConstraint {
  type: string;
  selector?: string;
  property?: string;
  value?: string;
  description: string;
  timestamp: number;
}

export type PanelType = 'css' | 'layout' | 'props' | 'responsive' | 'reference' | 'add';

export interface SimulatorState {
  // Selected element
  selectedElement: ElementInfo | null;
  elementPath: string[];

  // Iframe
  iframeSrc: string;
  isLoading: boolean;
  iframeError: string | null;

  // Connection
  isConnected: boolean;

  // Viewport
  viewportSize: ViewportSize;

  // Active panel
  activePanel: PanelType;

  // Drag mode
  dragMode: boolean;

  // Agent state
  agentStatus: string;
  agentCurrentFile: string | null;
  pendingConstraints: PendingConstraint[];
  serverConnected: boolean;

  // Actions
  setSelectedElement: (el: ElementInfo | null) => void;
  setElementPath: (path: string[]) => void;
  setIframeSrc: (src: string) => void;
  setLoading: (loading: boolean) => void;
  setIframeError: (error: string | null) => void;
  setConnected: (connected: boolean) => void;
  setViewportSize: (size: ViewportSize) => void;
  setActivePanel: (panel: PanelType) => void;
  setDragMode: (enabled: boolean) => void;
  clearSelection: () => void;
  setAgentStatus: (status: string) => void;
  setAgentCurrentFile: (file: string | null) => void;
  addPendingConstraint: (constraint: PendingConstraint) => void;
  clearPendingConstraints: () => void;
}

export const VIEWPORT_PRESETS: ViewportSize[] = [
  { width: 640, height: 480, label: 'sm' },
  { width: 768, height: 1024, label: 'md' },
  { width: 1024, height: 768, label: 'lg' },
  { width: 1280, height: 800, label: 'xl' },
  { width: 1536, height: 960, label: '2xl' },
  { width: 0, height: 0, label: 'full' },
];

export const useSimulatorStore = create<SimulatorState>((set) => ({
  selectedElement: null,
  elementPath: [],
  iframeSrc: '',
  isLoading: false,
  iframeError: null,
  isConnected: false,
  viewportSize: VIEWPORT_PRESETS[VIEWPORT_PRESETS.length - 1],
  activePanel: 'css',
  dragMode: false,
  agentStatus: 'IDLE',
  agentCurrentFile: null,
  pendingConstraints: [],
  serverConnected: false,

  setSelectedElement: (el) =>
    set({ selectedElement: el }),

  setElementPath: (path) =>
    set({ elementPath: path }),

  setIframeSrc: (src) =>
    set({ iframeSrc: src, isLoading: true, iframeError: null }),

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setIframeError: (error) =>
    set({ iframeError: error, isLoading: false }),

  setConnected: (connected) =>
    set({ isConnected: connected }),

  setViewportSize: (size) =>
    set({ viewportSize: size }),

  setActivePanel: (panel) =>
    set({ activePanel: panel }),

  setDragMode: (enabled) =>
    set({ dragMode: enabled }),

  clearSelection: () =>
    set({ selectedElement: null, elementPath: [] }),

  setAgentStatus: (status) =>
    set({ agentStatus: status }),

  setAgentCurrentFile: (file) =>
    set({ agentCurrentFile: file }),

  addPendingConstraint: (constraint) =>
    set((state) => ({
      pendingConstraints: [...state.pendingConstraints, constraint],
    })),

  clearPendingConstraints: () =>
    set({ pendingConstraints: [] }),
}));
