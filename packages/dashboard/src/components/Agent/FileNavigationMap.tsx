import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Map as MapIcon,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Flame,
  Crosshair,
  Pause,
  Square,
  MessageSquare,
  FileCode,
  Clock,
  Eye,
  Terminal,
  Hand,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentBreadcrumb } from '@voltron/shared';
import { useTranslation } from '../../i18n';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */

const ACTIVITY_STROKE: Record<string, string> = {
  READING: '#4ade80',
  WRITING: '#facc15',
  SEARCHING: '#60a5fa',
  EXECUTING: '#fb923c',
  THINKING: '#c084fc',
  WAITING: '#9ca3af',
  IDLE: '#6b7280',
};

const ACTIVITY_LETTER: Record<string, string> = {
  READING: 'R',
  WRITING: 'W',
  SEARCHING: 'S',
  EXECUTING: 'E',
  THINKING: 'T',
  WAITING: '.',
  IDLE: '-',
};

const HEATMAP_COLORS = [
  '#22c55e', // green-500
  '#84cc16', // lime-500
  '#eab308', // yellow-500
  '#f97316', // orange-500
  '#ef4444', // red-500
];

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.15;

const NODE_BASE_RADIUS = 12;
const NODE_MAX_RADIUS = 28;
const NODE_DOT_RADIUS = 6;

const DIR_PAD = 20;
const DIR_LABEL_H = 24;
const DIR_GAP = 40;
const GRID_COLS_MAX = 8;
const CELL_W = 56;
const CELL_H = 56;

const MINIMAP_W = 80;
const MINIMAP_H = 60;

const TRAIL_LENGTH = 3;

/* ═══════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════ */

interface FileNode {
  id: string;
  filePath: string;
  fileName: string;
  dir: string;
  visits: number;
  lastActivity: string;
  isCurrent: boolean;
  x: number;
  y: number;
  radius: number;
  order: number;
  toolName?: string;
}

interface DirZone {
  dir: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Edge {
  from: string;
  to: string;
}

interface TransformState {
  scale: number;
  translateX: number;
  translateY: number;
}

interface ContextMenuState {
  type: 'agent' | 'file' | 'agent-info' | null;
  x: number;
  y: number;
  filePath?: string;
}

export interface FileNavigationMapProps {
  onAgentAction?: (action: string, data?: Record<string, unknown>) => void;
  onFileAction?: (action: string, filePath: string, data?: Record<string, unknown>) => void;
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function extractFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

function extractDir(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 2) return '/';
  return parts.slice(0, -1).join('/');
}

function shortenDir(dir: string): string {
  const parts = dir.replace(/^\//, '').split('/');
  if (parts.length <= 2) return dir;
  return '.../' + parts.slice(-2).join('/');
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function nodeRadius(visits: number): number {
  return clamp(NODE_BASE_RADIUS + Math.log2(visits + 1) * 4, NODE_BASE_RADIUS, NODE_MAX_RADIUS);
}

function heatmapColor(visits: number, maxVisits: number): string {
  if (maxVisits <= 1) return HEATMAP_COLORS[0];
  const ratio = clamp((visits - 1) / (maxVisits - 1), 0, 1);
  const idx = Math.min(Math.floor(ratio * (HEATMAP_COLORS.length - 1)), HEATMAP_COLORS.length - 1);
  return HEATMAP_COLORS[idx];
}

/* ═══════════════════════════════════════════════════════════
   LAYOUT ENGINE
   ═══════════════════════════════════════════════════════════ */

function computeLayout(
  breadcrumbs: AgentBreadcrumb[],
  currentFile: string | null,
  currentActivity: string,
): { nodes: FileNode[]; dirs: DirZone[]; edges: Edge[]; canvasW: number; canvasH: number } {
  // Build file visit map
  const visitMap: globalThis.Map<
    string,
    { visits: number; lastActivity: string; order: number; toolName?: string }
  > = new globalThis.Map();
  let order = 0;
  for (const crumb of breadcrumbs) {
    const existing = visitMap.get(crumb.filePath);
    if (existing) {
      existing.visits++;
      existing.lastActivity = crumb.activity;
      existing.order = order++;
      if (crumb.toolName) existing.toolName = crumb.toolName;
    } else {
      visitMap.set(crumb.filePath, {
        visits: 1,
        lastActivity: crumb.activity,
        order: order++,
        toolName: crumb.toolName,
      });
    }
  }

  // Group files by directory
  const dirFiles: globalThis.Map<string, string[]> = new globalThis.Map();
  for (const filePath of visitMap.keys()) {
    const dir = extractDir(filePath);
    const existing = dirFiles.get(dir) ?? [];
    existing.push(filePath);
    dirFiles.set(dir, existing);
  }

  // Layout: place directories vertically, files as grid within
  const dirs: DirZone[] = [];
  const nodes: FileNode[] = [];
  let yOffset = DIR_PAD;

  const sortedDirs = [...dirFiles.entries()].sort(
    (a: [string, string[]], b: [string, string[]]) => {
      const minOrderA = Math.min(...a[1].map((f: string) => visitMap.get(f)!.order));
      const minOrderB = Math.min(...b[1].map((f: string) => visitMap.get(f)!.order));
      return minOrderA - minOrderB;
    },
  );

  let maxDirRight = 0;

  for (const [dir, files] of sortedDirs) {
    const cols = Math.min(files.length, GRID_COLS_MAX);
    const rows = Math.ceil(files.length / cols);
    const zoneW = cols * CELL_W + DIR_PAD * 2;
    const zoneH = rows * CELL_H + DIR_LABEL_H + DIR_PAD * 2;

    dirs.push({
      dir,
      label: shortenDir(dir),
      x: DIR_PAD,
      y: yOffset,
      w: zoneW,
      h: zoneH,
    });

    maxDirRight = Math.max(maxDirRight, DIR_PAD + zoneW + DIR_PAD);

    // Sort files by visit order
    const sorted = files.sort(
      (a: string, b: string) => visitMap.get(a)!.order - visitMap.get(b)!.order,
    );

    sorted.forEach((filePath: string, i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const info = visitMap.get(filePath)!;
      const cx = DIR_PAD + DIR_PAD + col * CELL_W + CELL_W / 2;
      const cy = yOffset + DIR_LABEL_H + DIR_PAD + row * CELL_H + CELL_H / 2;

      nodes.push({
        id: filePath,
        filePath,
        fileName: extractFileName(filePath),
        dir,
        visits: info.visits,
        lastActivity: currentFile === filePath ? currentActivity : info.lastActivity,
        isCurrent: currentFile === filePath,
        x: cx,
        y: cy,
        radius: nodeRadius(info.visits),
        order: info.order,
        toolName: info.toolName,
      });
    });

    yOffset += zoneH + DIR_GAP;
  }

  // Edges: sequential navigation between unique files
  const edges: Edge[] = [];
  let lastFile = '';
  for (const crumb of breadcrumbs) {
    if (lastFile && lastFile !== crumb.filePath) {
      const edgeKey = `${lastFile}->${crumb.filePath}`;
      if (!edges.some((e) => `${e.from}->${e.to}` === edgeKey)) {
        edges.push({ from: lastFile, to: crumb.filePath });
      }
    }
    lastFile = crumb.filePath;
  }

  const canvasW = Math.max(maxDirRight, 400);
  const canvasH = Math.max(yOffset, 300);

  return { nodes, dirs, edges, canvasW, canvasH };
}

/* ═══════════════════════════════════════════════════════════
   TRAIL: last N unique visited files
   ═══════════════════════════════════════════════════════════ */

function computeTrail(breadcrumbs: AgentBreadcrumb[]): string[] {
  const seen = new Set<string>();
  const trail: string[] = [];
  for (let i = breadcrumbs.length - 1; i >= 0 && trail.length < TRAIL_LENGTH; i--) {
    const fp = breadcrumbs[i].filePath;
    if (!seen.has(fp)) {
      seen.add(fp);
      trail.unshift(fp);
    }
  }
  return trail;
}

/* ═══════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════ */

export function FileNavigationMap({ onAgentAction, onFileAction }: FileNavigationMapProps) {
  const { t } = useTranslation();
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const currentFile = useAgentStore((s) => s.currentFile);
  const activity = useAgentStore((s) => s.activity);
  const status = useAgentStore((s) => s.status);

  // ── Transform state ─────────────────────────────────
  const [transform, setTransform] = useState<TransformState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  // ── UI state ────────────────────────────────────────
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [panMode, setPanMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ type: null, x: 0, y: 0 });
  const [promptInput, setPromptInput] = useState('');
  const [showPromptInput, setShowPromptInput] = useState<'agent' | 'file' | null>(null);
  const [agentInfoPopup, setAgentInfoPopup] = useState<{ x: number; y: number } | null>(null);

  // ── Refs ────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Derived data ────────────────────────────────────
  const { nodes, dirs, edges, canvasW, canvasH } = useMemo(
    () => computeLayout(breadcrumbs, currentFile, activity),
    [breadcrumbs, currentFile, activity],
  );

  const nodeMap = useMemo((): globalThis.Map<string, FileNode> => {
    const m: globalThis.Map<string, FileNode> = new globalThis.Map();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const maxVisits = useMemo(() => {
    let max = 1;
    for (const n of nodes) if (n.visits > max) max = n.visits;
    return max;
  }, [nodes]);

  const trail = useMemo(() => computeTrail(breadcrumbs), [breadcrumbs]);

  const matchingNodes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const s = new Set<string>();
    for (const n of nodes) {
      if (n.fileName.toLowerCase().includes(q) || n.filePath.toLowerCase().includes(q)) {
        s.add(n.id);
      }
    }
    return s;
  }, [searchQuery, nodes]);

  const isActive = !['IDLE', 'COMPLETED', 'CRASHED'].includes(status);

  // ── Keyboard shortcut: Ctrl+F ───────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Close context menu on click elsewhere ───────────
  useEffect(() => {
    const handler = () => {
      setContextMenu({ type: null, x: 0, y: 0 });
      setAgentInfoPopup(null);
      setShowPromptInput(null);
    };
    if (contextMenu.type || agentInfoPopup) {
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [contextMenu.type, agentInfoPopup]);

  // ── Auto-center on current file ─────────────────────
  useEffect(() => {
    if (!currentFile || !containerRef.current) return;
    const node = nodeMap.get(currentFile);
    if (!node) return;
    const container = containerRef.current;
    const cx = container.clientWidth / 2;
    const cy = container.clientHeight / 2;
    setTransform((prev) => ({
      ...prev,
      translateX: cx - node.x * prev.scale,
      translateY: cy - node.y * prev.scale,
    }));
  }, [currentFile, nodeMap]);

  // ═══════════════════════════════════════════════════════
  //  ZOOM & PAN HANDLERS
  // ═══════════════════════════════════════════════════════

  // Use ref-based wheel handler for { passive: false } — React synthetic events are passive
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setTransform((prev) => {
        const direction = e.deltaY < 0 ? 1 : -1;
        const newScale = clamp(prev.scale + direction * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM);
        const ratio = newScale / prev.scale;
        return {
          scale: newScale,
          translateX: mx - (mx - prev.translateX) * ratio,
          translateY: my - (my - prev.translateY) * ratio,
        };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse button (button 1) always pans
      if (e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          tx: transform.translateX,
          ty: transform.translateY,
        };
        return;
      }
      if (e.button !== 0) return;

      // In pan mode (hand tool): all left clicks pan, even on nodes
      if (panMode) {
        e.preventDefault();
        setIsPanning(true);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          tx: transform.translateX,
          ty: transform.translateY,
        };
        return;
      }

      // Normal mode: only pan on direct SVG/container click (not on nodes)
      const target = e.target as HTMLElement;
      if (target.closest('[data-node]') || target.closest('[data-ai-marker]')) return;

      setIsPanning(true);
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.translateX,
        ty: transform.translateY,
      };
    },
    [transform.translateX, transform.translateY, panMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || !panStart.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setTransform((prev) => ({
        ...prev,
        translateX: panStart.current!.tx + dx,
        translateY: panStart.current!.ty + dy,
      }));
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    panStart.current = null;
  }, []);

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: clamp(prev.scale + ZOOM_STEP * 2, MIN_ZOOM, MAX_ZOOM),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: clamp(prev.scale - ZOOM_STEP * 2, MIN_ZOOM, MAX_ZOOM),
    }));
  }, []);

  const resetView = useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  const centerOnFile = useCallback(
    (filePath: string) => {
      const node = nodeMap.get(filePath);
      if (!node || !containerRef.current) return;
      const container = containerRef.current;
      const cx = container.clientWidth / 2;
      const cy = container.clientHeight / 2;
      setTransform((prev) => ({
        ...prev,
        translateX: cx - node.x * prev.scale,
        translateY: cy - node.y * prev.scale,
      }));
    },
    [nodeMap],
  );

  // ═══════════════════════════════════════════════════════
  //  MINIMAP CLICK
  // ═══════════════════════════════════════════════════════

  const minimapDragging = useRef(false);

  const handleMinimapNav = useCallback(
    (clientX: number, clientY: number, svgEl: SVGSVGElement) => {
      const rect = svgEl.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const ratioX = mx / MINIMAP_W;
      const ratioY = my / MINIMAP_H;

      const container = containerRef.current;
      if (!container) return;

      const targetX = ratioX * canvasW;
      const targetY = ratioY * canvasH;

      setTransform((prev) => ({
        ...prev,
        translateX: container.clientWidth / 2 - targetX * prev.scale,
        translateY: container.clientHeight / 2 - targetY * prev.scale,
      }));
    },
    [canvasW, canvasH],
  );

  const handleMinimapMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      e.stopPropagation();
      minimapDragging.current = true;
      handleMinimapNav(e.clientX, e.clientY, e.currentTarget);
    },
    [handleMinimapNav],
  );

  const handleMinimapMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!minimapDragging.current) return;
      handleMinimapNav(e.clientX, e.clientY, e.currentTarget);
    },
    [handleMinimapNav],
  );

  const handleMinimapMouseUp = useCallback(() => {
    minimapDragging.current = false;
  }, []);

  // Release minimap drag on global mouseup
  useEffect(() => {
    const handler = () => { minimapDragging.current = false; };
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, []);

  // ═══════════════════════════════════════════════════════
  //  CONTEXT MENU HANDLERS
  // ═══════════════════════════════════════════════════════

  const handleAIMarkerRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type: 'agent', x: e.clientX, y: e.clientY });
  }, []);

  const handleAIMarkerLeftClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setAgentInfoPopup({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleFileRightClick = useCallback((e: React.MouseEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type: 'file', x: e.clientX, y: e.clientY, filePath });
  }, []);

  const emitAgentAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      setContextMenu({ type: null, x: 0, y: 0 });
      onAgentAction?.(action, data);
    },
    [onAgentAction],
  );

  const emitFileAction = useCallback(
    (action: string, filePath: string, data?: Record<string, unknown>) => {
      setContextMenu({ type: null, x: 0, y: 0 });
      onFileAction?.(action, filePath, data);
    },
    [onFileAction],
  );

  // ═══════════════════════════════════════════════════════
  //  ZOOM-LEVEL DETAIL
  // ═══════════════════════════════════════════════════════

  const zoomLevel = transform.scale < 0.6 ? 'dots' : transform.scale <= 1.2 ? 'names' : 'full';

  // ═══════════════════════════════════════════════════════
  //  CURRENT FILE NODE (for AI marker)
  // ═══════════════════════════════════════════════════════

  const currentNode = (!isActive || nodes.length === 0) ? null : (currentFile ? nodeMap.get(currentFile) : null);

  // ═══════════════════════════════════════════════════════
  //  MINIMAP VIEWPORT RECT (must be before early return — Rules of Hooks)
  // ═══════════════════════════════════════════════════════

  const minimapViewport = useMemo(() => {
    const container = containerRef.current;
    if (!container || canvasW === 0 || canvasH === 0) {
      return { x: 0, y: 0, w: MINIMAP_W, h: MINIMAP_H };
    }
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const viewLeftCanvas = -transform.translateX / transform.scale;
    const viewTopCanvas = -transform.translateY / transform.scale;
    const viewWCanvas = cw / transform.scale;
    const viewHCanvas = ch / transform.scale;

    return {
      x: (viewLeftCanvas / canvasW) * MINIMAP_W,
      y: (viewTopCanvas / canvasH) * MINIMAP_H,
      w: clamp((viewWCanvas / canvasW) * MINIMAP_W, 4, MINIMAP_W),
      h: clamp((viewHCanvas / canvasH) * MINIMAP_H, 3, MINIMAP_H),
    };
  }, [transform, canvasW, canvasH]);

  // ═══════════════════════════════════════════════════════
  //  LAST 3 TOOL CALLS for agent info popup (must be before early return — Rules of Hooks)
  // ═══════════════════════════════════════════════════════

  const lastToolCalls = useMemo(() => {
    const calls: { tool: string; file: string }[] = [];
    for (let i = breadcrumbs.length - 1; i >= 0 && calls.length < 3; i--) {
      const b = breadcrumbs[i];
      if (b.toolName) {
        calls.push({ tool: b.toolName, file: extractFileName(b.filePath) });
      }
    }
    return calls;
  }, [breadcrumbs]);

  // ═══════════════════════════════════════════════════════
  //  RENDER: EMPTY STATE
  // ═══════════════════════════════════════════════════════

  if (!isActive || nodes.length === 0) {
    return (
      <div className="flex flex-col h-full bg-gray-950/80 backdrop-blur-sm rounded-lg border border-gray-800/50 shadow-lg shadow-blue-500/5 overflow-hidden">
        <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800/50 bg-gray-900/60">
          <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
            {t('agent.fileMap')}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Animated background grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />
          {/* Pulsing center ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 rounded-full border border-gray-800/30 animate-ping" style={{ animationDuration: '3s' }} />
            <div className="absolute w-20 h-20 rounded-full border border-gray-800/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          </div>
          <div className="text-center relative z-10">
            <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700/30 flex items-center justify-center shadow-lg shadow-black/20">
              <MapIcon className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              {isActive ? t('agent.noNavigation') : t('agent.startAgent')}
            </p>
            <p className="text-[9px] text-gray-600 mt-1">
              {isActive ? 'Agent dosya islemleri basladiginda harita canlanir' : 'GPS navigasyon haritasi'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-gray-950/80 backdrop-blur-sm rounded-lg border border-gray-800/50 shadow-lg shadow-blue-500/5 overflow-hidden select-none">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-800/50 bg-gray-900/60">
        <MapIcon className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
          {t('agent.fileMap')}
        </span>

        {/* Search box */}
        <div
          className={`ml-2 flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all duration-200 ${
            searchFocused
              ? 'border-blue-500/50 bg-gray-900/80'
              : 'border-gray-700/40 bg-gray-900/40'
          }`}
        >
          <Search className="w-3 h-3 text-gray-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t('agent.gps.searchFiles')}
            className="bg-transparent text-[9px] text-gray-300 placeholder-gray-600 outline-none w-20"
          />
        </div>

        {/* Pan mode (hand tool) toggle */}
        <button
          onClick={() => setPanMode((p) => !p)}
          className={`ml-auto p-0.5 rounded transition-all duration-200 ${
            panMode
              ? 'bg-blue-500/20 text-blue-400'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'
          }`}
          title={t('agent.gps.panMode')}
        >
          <Hand className="w-3 h-3" />
        </button>

        {/* Heatmap toggle */}
        <button
          onClick={() => setHeatmapMode((p) => !p)}
          className={`p-0.5 rounded transition-all duration-200 ${
            heatmapMode
              ? 'bg-orange-500/20 text-orange-400'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'
          }`}
          title={t('agent.gps.heatmap')}
        >
          <Flame className="w-3 h-3" />
        </button>

        {/* Zoom controls */}
        <button
          onClick={zoomOut}
          className="p-0.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 rounded transition-all duration-200"
          title={t('agent.gps.zoomOut')}
        >
          <ZoomOut className="w-3 h-3" />
        </button>
        <span className="text-[8px] text-gray-500 tabular-nums w-7 text-center">
          {Math.round(transform.scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="p-0.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 rounded transition-all duration-200"
          title={t('agent.gps.zoomIn')}
        >
          <ZoomIn className="w-3 h-3" />
        </button>
        <button
          onClick={resetView}
          className="p-0.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 rounded transition-all duration-200"
          title={t('agent.gps.resetView')}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
        {currentNode && (
          <button
            onClick={() => centerOnFile(currentFile!)}
            className="p-0.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800/60 rounded transition-all duration-200"
            title="Center on agent"
          >
            <Crosshair className="w-3 h-3" />
          </button>
        )}

        <span className="text-[9px] text-gray-600">
          {nodes.length} {nodes.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* ─── SVG Canvas ─── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: isPanning ? 'grabbing' : panMode ? 'grab' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{
            minHeight: '180px',
          }}
        >
          <defs>
            {/* Arrow marker */}
            <marker
              id="fnm-arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6" fill="#4b5563" />
            </marker>

            {/* Glow filter */}
            <filter id="fnm-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* AI marker outer glow */}
            <filter id="fnm-ai-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Directory gradient */}
            <linearGradient id="fnm-dir-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#111827" />
              <stop offset="100%" stopColor="#030712" />
            </linearGradient>
          </defs>

          {/* Transform group */}
          <g
            style={{
              transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* ── Directory zones ── */}
            {dirs.map((d) => (
              <g key={d.dir}>
                <rect
                  x={d.x}
                  y={d.y}
                  width={d.w}
                  height={d.h}
                  rx={10}
                  fill="url(#fnm-dir-grad)"
                  stroke="#1f2937"
                  strokeWidth={1}
                  opacity={0.9}
                />
                <text
                  x={d.x + DIR_PAD}
                  y={d.y + DIR_LABEL_H - 6}
                  fill="#4b5563"
                  fontSize={10}
                  fontFamily="monospace"
                  fontWeight={500}
                >
                  {d.label}
                </text>
              </g>
            ))}

            {/* ── Edges ── */}
            {edges.map((e, i) => {
              const from = nodeMap.get(e.from);
              const to = nodeMap.get(e.to);
              if (!from || !to) return null;

              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const nx = dx / dist;
              const ny = dy / dist;

              const rFrom = zoomLevel === 'dots' ? NODE_DOT_RADIUS : from.radius;
              const rTo = zoomLevel === 'dots' ? NODE_DOT_RADIUS : to.radius;

              const x1 = from.x + nx * rFrom;
              const y1 = from.y + ny * rFrom;
              const x2 = to.x - nx * (rTo + 8);
              const y2 = to.y - ny * (rTo + 8);

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#374151"
                  strokeWidth={1}
                  markerEnd="url(#fnm-arrowhead)"
                  opacity={0.4}
                />
              );
            })}

            {/* ── Trail (animated dotted line connecting last 3 visited files) ── */}
            {trail.length >= 2 &&
              trail.map((fp, i) => {
                if (i === 0) return null;
                const fromNode = nodeMap.get(trail[i - 1]);
                const toNode = nodeMap.get(fp);
                if (!fromNode || !toNode) return null;
                return (
                  <line
                    key={`trail-${i}`}
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    opacity={0.5}
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      values="8;0"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </line>
                );
              })}

            {/* ── File nodes ── */}
            {nodes.map((node) => {
              const strokeColor = heatmapMode
                ? heatmapColor(node.visits, maxVisits)
                : ACTIVITY_STROKE[node.lastActivity] ?? '#6b7280';
              const isSearchMatch = matchingNodes.size > 0 && matchingNodes.has(node.id);
              const isSearchDimmed = matchingNodes.size > 0 && !matchingNodes.has(node.id);
              const isHovered = hoveredNode === node.id;

              // ── Dots mode (zoom < 0.6) ──
              if (zoomLevel === 'dots') {
                return (
                  <g
                    key={node.id}
                    data-node
                    onMouseEnter={panMode ? undefined : () => setHoveredNode(node.id)}
                    onMouseLeave={panMode ? undefined : () => setHoveredNode(null)}
                    onContextMenu={panMode ? undefined : (e) => handleFileRightClick(e, node.filePath)}
                    style={{ cursor: panMode ? (isPanning ? 'grabbing' : 'grab') : 'pointer' }}
                    opacity={isSearchDimmed ? 0.2 : 1}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={NODE_DOT_RADIUS}
                      fill={node.isCurrent ? strokeColor : '#1e293b'}
                      stroke={strokeColor}
                      strokeWidth={isSearchMatch ? 2 : 1}
                    />
                    {isSearchMatch && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={NODE_DOT_RADIUS + 3}
                        fill="none"
                        stroke="#facc15"
                        strokeWidth={1.5}
                        opacity={0.8}
                      />
                    )}
                  </g>
                );
              }

              const r = node.radius;

              return (
                <g
                  key={node.id}
                  data-node
                  onMouseEnter={panMode ? undefined : () => setHoveredNode(node.id)}
                  onMouseLeave={panMode ? undefined : () => setHoveredNode(null)}
                  onContextMenu={panMode ? undefined : (e) => handleFileRightClick(e, node.filePath)}
                  style={{ cursor: panMode ? (isPanning ? 'grabbing' : 'grab') : 'pointer' }}
                  opacity={isSearchDimmed ? 0.25 : 1}
                >
                  {/* Search highlight ring */}
                  {isSearchMatch && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r + 5}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth={2}
                      opacity={0.8}
                    >
                      <animate
                        attributeName="opacity"
                        values="0.8;0.4;0.8"
                        dur="1.5s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Node circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={r}
                    fill="#0f172a"
                    stroke={strokeColor}
                    strokeWidth={node.isCurrent ? 2.5 : 1.5}
                    filter={node.isCurrent ? 'url(#fnm-glow)' : undefined}
                  />

                  {/* ── Names mode (zoom 0.6-1.2): file name + colored stroke ── */}
                  {zoomLevel === 'names' && (
                    <text
                      x={node.x}
                      y={node.y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={node.isCurrent ? '#e2e8f0' : '#94a3b8'}
                      fontSize={node.fileName.length > 12 ? 6 : 7}
                      fontFamily="sans-serif"
                      fontWeight={node.isCurrent ? 600 : 400}
                    >
                      {node.fileName.length > 16
                        ? node.fileName.slice(0, 14) + '..'
                        : node.fileName}
                    </text>
                  )}

                  {/* ── Full mode (zoom > 1.2): full path + visit count + activity ── */}
                  {zoomLevel === 'full' && (
                    <>
                      <text
                        x={node.x}
                        y={node.y - 3}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={node.isCurrent ? '#e2e8f0' : '#94a3b8'}
                        fontSize={6}
                        fontFamily="sans-serif"
                        fontWeight={node.isCurrent ? 600 : 400}
                      >
                        {node.fileName.length > 20
                          ? node.fileName.slice(0, 18) + '..'
                          : node.fileName}
                      </text>
                      {/* Visit count */}
                      <text
                        x={node.x}
                        y={node.y + 6}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#64748b"
                        fontSize={5}
                        fontFamily="monospace"
                      >
                        {node.visits}x &middot;{' '}
                        {ACTIVITY_LETTER[node.lastActivity] ?? '-'}
                      </text>
                      {/* Activity indicator dot */}
                      <circle
                        cx={node.x + r - 2}
                        cy={node.y - r + 2}
                        r={3}
                        fill={ACTIVITY_STROKE[node.lastActivity] ?? '#6b7280'}
                        opacity={0.8}
                      />
                    </>
                  )}

                  {/* Visit count badge (names mode) */}
                  {zoomLevel === 'names' && node.visits > 1 && (
                    <>
                      <circle cx={node.x + r - 3} cy={node.y - r + 3} r={6} fill="#3b82f6" />
                      <text
                        x={node.x + r - 3}
                        y={node.y - r + 4}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize={7}
                        fontWeight={700}
                      >
                        {node.visits > 99 ? '99+' : node.visits}
                      </text>
                    </>
                  )}

                  {/* Hover tooltip */}
                  {isHovered && (
                    <foreignObject
                      x={node.x - 90}
                      y={node.y + r + 8}
                      width={180}
                      height={52}
                    >
                      <div
                        style={{
                          background: 'rgba(15,23,42,0.95)',
                          border: '1px solid rgba(51,65,85,0.5)',
                          borderRadius: 8,
                          padding: '4px 8px',
                          fontSize: 9,
                          color: '#cbd5e1',
                          fontFamily: 'monospace',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          backdropFilter: 'blur(8px)',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 8 }}>
                          {node.filePath}
                        </div>
                        <div style={{ color: '#64748b', fontSize: 8 }}>
                          {node.visits} {t('agent.visits')} &middot;{' '}
                          {node.lastActivity}
                        </div>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}

            {/* ── Live AI Marker ── */}
            {currentNode && (
              <g
                data-ai-marker
                style={{ cursor: 'pointer' }}
                onClick={handleAIMarkerLeftClick}
                onContextMenu={handleAIMarkerRightClick}
              >
                {/* Connection line from marker to node */}
                <line
                  x1={currentNode.x}
                  y1={currentNode.y - (zoomLevel === 'dots' ? NODE_DOT_RADIUS : currentNode.radius) - 4}
                  x2={currentNode.x}
                  y2={currentNode.y - (zoomLevel === 'dots' ? NODE_DOT_RADIUS : currentNode.radius) - 18}
                  stroke={ACTIVITY_STROKE[activity] ?? '#6b7280'}
                  strokeWidth={1.5}
                  opacity={0.6}
                />

                {/* Pulsing outer ring */}
                <circle
                  cx={currentNode.x}
                  cy={
                    currentNode.y -
                    (zoomLevel === 'dots' ? NODE_DOT_RADIUS : currentNode.radius) -
                    28
                  }
                  r={14}
                  fill="none"
                  stroke={ACTIVITY_STROKE[activity] ?? '#6b7280'}
                  strokeWidth={1.5}
                  opacity={0.3}
                >
                  <animate
                    attributeName="r"
                    values="12;18;12"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.4;0.1;0.4"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Glowing marker circle */}
                <circle
                  cx={currentNode.x}
                  cy={
                    currentNode.y -
                    (zoomLevel === 'dots' ? NODE_DOT_RADIUS : currentNode.radius) -
                    28
                  }
                  r={11}
                  fill="#0f172a"
                  stroke={ACTIVITY_STROKE[activity] ?? '#6b7280'}
                  strokeWidth={2}
                  filter="url(#fnm-ai-glow)"
                />

                {/* Activity letter inside */}
                <text
                  x={currentNode.x}
                  y={
                    currentNode.y -
                    (zoomLevel === 'dots' ? NODE_DOT_RADIUS : currentNode.radius) -
                    27
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={ACTIVITY_STROKE[activity] ?? '#6b7280'}
                  fontSize={9}
                  fontWeight={700}
                  fontFamily="monospace"
                >
                  {ACTIVITY_LETTER[activity] ?? '?'}
                </text>
              </g>
            )}
          </g>
        </svg>

        {/* ─── Minimap (bottom-right) ─── */}
        <div
          className="absolute bottom-2 right-2 rounded border border-gray-700/50 bg-gray-950/90 backdrop-blur-sm overflow-hidden"
          style={{ width: MINIMAP_W, height: MINIMAP_H }}
        >
          <svg
            width={MINIMAP_W}
            height={MINIMAP_H}
            onMouseDown={handleMinimapMouseDown}
            onMouseMove={handleMinimapMouseMove}
            onMouseUp={handleMinimapMouseUp}
            className="cursor-crosshair"
          >
            {/* Directory zones (minimap) */}
            {dirs.map((d) => (
              <rect
                key={d.dir}
                x={(d.x / canvasW) * MINIMAP_W}
                y={(d.y / canvasH) * MINIMAP_H}
                width={(d.w / canvasW) * MINIMAP_W}
                height={(d.h / canvasH) * MINIMAP_H}
                fill="#1e293b"
                stroke="#334155"
                strokeWidth={0.5}
                rx={1}
              />
            ))}

            {/* File dots (minimap) */}
            {nodes.map((n) => (
              <circle
                key={n.id}
                cx={(n.x / canvasW) * MINIMAP_W}
                cy={(n.y / canvasH) * MINIMAP_H}
                r={n.isCurrent ? 2 : 1}
                fill={n.isCurrent ? '#3b82f6' : '#64748b'}
              />
            ))}

            {/* Viewport rectangle */}
            <rect
              x={minimapViewport.x}
              y={minimapViewport.y}
              width={minimapViewport.w}
              height={minimapViewport.h}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={1}
              opacity={0.6}
              rx={1}
            />
          </svg>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          CONTEXT MENU: Agent (right-click on AI marker)
          ═══════════════════════════════════════════════════════ */}
      {contextMenu.type === 'agent' && (
        <div
          className="fixed z-50 rounded-lg border border-gray-700/50 bg-gray-900/95 backdrop-blur-sm shadow-xl shadow-black/40 min-w-[180px] py-1 text-[10px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={() => emitAgentAction('pause')}
          >
            <Pause className="w-3 h-3 text-yellow-400" />
            {t('agent.gps.pauseAgent')}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={() => emitAgentAction('stop')}
          >
            <Square className="w-3 h-3 text-red-400" />
            {t('agent.gps.stopAgent')}
          </button>
          <div className="border-t border-gray-700/50 my-1" />
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setShowPromptInput('agent');
            }}
          >
            <MessageSquare className="w-3 h-3 text-blue-400" />
            {t('agent.gps.sendPrompt')}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={() => emitAgentAction('switchFile')}
          >
            <FileCode className="w-3 h-3 text-emerald-400" />
            {t('agent.gps.switchFile')}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={() => emitAgentAction('viewOutput')}
          >
            <Eye className="w-3 h-3 text-purple-400" />
            {t('agent.gps.viewOutput')}
          </button>

          {/* Inline prompt input */}
          {showPromptInput === 'agent' && (
            <div className="px-3 py-1.5 border-t border-gray-700/50 mt-1">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && promptInput.trim()) {
                      emitAgentAction('sendPrompt', { prompt: promptInput });
                      setPromptInput('');
                      setShowPromptInput(null);
                    }
                  }}
                  placeholder="Prompt..."
                  className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded px-1.5 py-0.5 text-[9px] text-gray-300 outline-none focus:border-blue-500/50"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="px-1.5 py-0.5 bg-blue-600/30 text-blue-300 rounded text-[9px] hover:bg-blue-600/50 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (promptInput.trim()) {
                      emitAgentAction('sendPrompt', { prompt: promptInput });
                      setPromptInput('');
                      setShowPromptInput(null);
                    }
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          AGENT INFO POPUP (left-click on AI marker)
          ═══════════════════════════════════════════════════════ */}
      {agentInfoPopup && currentNode && (
        <div
          className="fixed z-50 rounded-lg border border-gray-700/50 bg-gray-900/95 backdrop-blur-sm shadow-xl shadow-black/40 min-w-[200px] p-3 text-[10px]"
          style={{ top: agentInfoPopup.y, left: agentInfoPopup.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: ACTIVITY_STROKE[activity] ?? '#6b7280' }}
            />
            <span className="text-gray-200 font-medium">{t('agent.gps.fileInfo')}</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">File:</span>
              <span className="text-gray-300 font-mono text-[9px] max-w-[120px] truncate">
                {currentNode.fileName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Activity:</span>
              <span className="text-gray-300">{activity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t('agent.gps.duration')}:</span>
              <span className="text-gray-300">{currentNode.visits}x visited</span>
            </div>
          </div>

          {lastToolCalls.length > 0 && (
            <>
              <div className="border-t border-gray-700/50 my-1.5" />
              <div className="text-gray-500 mb-1">{t('agent.gps.lastToolCalls')}:</div>
              {lastToolCalls.map((call, i) => (
                <div key={i} className="flex items-center gap-1 text-[9px] py-0.5">
                  <Terminal className="w-2.5 h-2.5 text-gray-500" />
                  <span className="text-orange-300">{call.tool}</span>
                  <span className="text-gray-600">&rarr;</span>
                  <span className="text-gray-400 truncate max-w-[80px]">{call.file}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          CONTEXT MENU: File (right-click on file node)
          ═══════════════════════════════════════════════════════ */}
      {contextMenu.type === 'file' && contextMenu.filePath && (
        <div
          className="fixed z-50 rounded-lg border border-gray-700/50 bg-gray-900/95 backdrop-blur-sm shadow-xl shadow-black/40 min-w-[180px] py-1 text-[10px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[9px] text-gray-500 font-mono truncate max-w-[200px]">
            {extractFileName(contextMenu.filePath)}
          </div>
          <div className="border-t border-gray-700/50 my-1" />

          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              setShowPromptInput('file');
            }}
          >
            <MessageSquare className="w-3 h-3 text-blue-400" />
            {t('agent.gps.doInFile')}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={() => emitFileAction('viewContent', contextMenu.filePath!)}
          >
            <Eye className="w-3 h-3 text-emerald-400" />
            {t('agent.gps.viewContent')}
          </button>
          <button
            className="flex items-center gap-2 w-full px-3 py-1.5 text-left text-gray-300 hover:bg-gray-800/60 transition-all duration-200"
            onClick={() => emitFileAction('viewHistory', contextMenu.filePath!)}
          >
            <Clock className="w-3 h-3 text-purple-400" />
            {t('agent.gps.viewHistory')}
          </button>

          {/* Inline prompt input for "Do in this file" */}
          {showPromptInput === 'file' && (
            <div className="px-3 py-1.5 border-t border-gray-700/50 mt-1">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && promptInput.trim()) {
                      emitFileAction('doInFile', contextMenu.filePath!, {
                        prompt: promptInput,
                      });
                      setPromptInput('');
                      setShowPromptInput(null);
                    }
                  }}
                  placeholder="What to do..."
                  className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded px-1.5 py-0.5 text-[9px] text-gray-300 outline-none focus:border-blue-500/50"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="px-1.5 py-0.5 bg-blue-600/30 text-blue-300 rounded text-[9px] hover:bg-blue-600/50 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (promptInput.trim()) {
                      emitFileAction('doInFile', contextMenu.filePath!, {
                        prompt: promptInput,
                      });
                      setPromptInput('');
                      setShowPromptInput(null);
                    }
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
