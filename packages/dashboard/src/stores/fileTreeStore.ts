import { create } from 'zustand';
import type { OperationType, RiskLevel } from '@voltron/shared';

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: Map<string, FileNode>;
  status: 'created' | 'modified' | 'deleted' | 'unchanged';
  lastAction?: OperationType;
  eventCount: number;
  lastModified: number;
  maxRisk: RiskLevel;
}

interface FileTreeState {
  root: FileNode;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  heatMapEnabled: boolean;
  agentCurrentFile: string | null;
  agentVisitedFiles: Set<string>;

  addFile: (path: string, action: OperationType, timestamp: number, risk?: RiskLevel) => void;
  modifyFile: (path: string, action: OperationType, timestamp: number, risk?: RiskLevel) => void;
  deleteFile: (path: string, timestamp: number) => void;
  setSelectedPath: (path: string | null) => void;
  toggleExpanded: (path: string) => void;
  toggleHeatMap: () => void;
  setAgentCurrentFile: (path: string | null) => void;
  addAgentVisitedFile: (path: string) => void;
  clear: () => void;
}

const RISK_ORDER: Record<string, number> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
function maxRiskOf(a: RiskLevel, b?: RiskLevel): RiskLevel {
  if (!b) return a;
  return (RISK_ORDER[a] ?? 0) >= (RISK_ORDER[b] ?? 0) ? a : b;
}

function createRootNode(): FileNode {
  return {
    name: '/',
    path: '/',
    isDirectory: true,
    children: new Map(),
    status: 'unchanged',
    eventCount: 0,
    lastModified: 0,
    maxRisk: 'NONE',
  };
}

function ensureDirectories(root: FileNode, parts: string[]): FileNode {
  let current = root;
  let currentPath = '';
  for (let i = 0; i < parts.length - 1; i++) {
    currentPath += '/' + parts[i];
    let child = current.children.get(parts[i]);
    if (!child) {
      child = {
        name: parts[i],
        path: currentPath,
        isDirectory: true,
        children: new Map(),
        status: 'unchanged',
        eventCount: 0,
        lastModified: 0,
        maxRisk: 'NONE',
      };
      current.children.set(parts[i], child);
    }
    current = child;
  }
  return current;
}

function getPathParts(path: string): string[] {
  return path.replace(/^\//, '').split('/').filter(Boolean);
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  root: createRootNode(),
  selectedPath: null,
  expandedPaths: new Set<string>(),
  heatMapEnabled: false,
  agentCurrentFile: null,
  agentVisitedFiles: new Set<string>(),

  addFile: (path, action, timestamp, risk) =>
    set((state) => {
      const newRoot = { ...state.root, children: new Map(state.root.children) };
      const parts = getPathParts(path);
      if (parts.length === 0) return state;
      const parent = ensureDirectories(newRoot, parts);
      const fileName = parts[parts.length - 1];
      const existing = parent.children.get(fileName);
      parent.children.set(fileName, {
        name: fileName,
        path,
        isDirectory: false,
        children: new Map(),
        status: 'created',
        lastAction: action,
        eventCount: (existing?.eventCount ?? 0) + 1,
        lastModified: timestamp,
        maxRisk: maxRiskOf(risk ?? 'NONE', existing?.maxRisk),
      });
      return { root: newRoot };
    }),

  modifyFile: (path, action, timestamp, risk) =>
    set((state) => {
      const newRoot = { ...state.root, children: new Map(state.root.children) };
      const parts = getPathParts(path);
      if (parts.length === 0) return state;
      const parent = ensureDirectories(newRoot, parts);
      const fileName = parts[parts.length - 1];
      const existing = parent.children.get(fileName);
      parent.children.set(fileName, {
        name: fileName,
        path,
        isDirectory: false,
        children: new Map(),
        status: 'modified',
        lastAction: action,
        eventCount: (existing?.eventCount ?? 0) + 1,
        lastModified: timestamp,
        maxRisk: maxRiskOf(risk ?? 'NONE', existing?.maxRisk),
      });
      return { root: newRoot };
    }),

  deleteFile: (path, timestamp) =>
    set((state) => {
      const newRoot = { ...state.root, children: new Map(state.root.children) };
      const parts = getPathParts(path);
      if (parts.length === 0) return state;
      const parent = ensureDirectories(newRoot, parts);
      const fileName = parts[parts.length - 1];
      const existing = parent.children.get(fileName);
      parent.children.set(fileName, {
        name: fileName,
        path,
        isDirectory: false,
        children: new Map(),
        status: 'deleted',
        lastAction: 'FILE_DELETE',
        eventCount: (existing?.eventCount ?? 0) + 1,
        lastModified: timestamp,
        maxRisk: existing?.maxRisk ?? 'NONE',
      });
      return { root: newRoot };
    }),

  setSelectedPath: (selectedPath) => set({ selectedPath }),

  toggleExpanded: (path) =>
    set((state) => {
      const expandedPaths = new Set(state.expandedPaths);
      if (expandedPaths.has(path)) {
        expandedPaths.delete(path);
      } else {
        expandedPaths.add(path);
      }
      return { expandedPaths };
    }),

  toggleHeatMap: () => set((state) => ({ heatMapEnabled: !state.heatMapEnabled })),

  setAgentCurrentFile: (path) =>
    set((state) => {
      const visited = new Set(state.agentVisitedFiles);
      if (state.agentCurrentFile) visited.add(state.agentCurrentFile);
      return { agentCurrentFile: path, agentVisitedFiles: visited };
    }),

  addAgentVisitedFile: (path) =>
    set((state) => {
      const visited = new Set(state.agentVisitedFiles);
      visited.add(path);
      return { agentVisitedFiles: visited };
    }),

  clear: () =>
    set({
      root: createRootNode(),
      selectedPath: null,
      expandedPaths: new Set(),
      heatMapEnabled: false,
      agentCurrentFile: null,
      agentVisitedFiles: new Set(),
    }),
}));
