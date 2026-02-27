import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Search, ZoomIn, ZoomOut, RotateCcw, Flame, BarChart3, Map as MapIcon, Maximize2, Minimize2,
} from 'lucide-react';
import { useAgentStore } from '../../../stores/agentStore';
import { useTranslation } from '../../../i18n';
import type { ForceNode, GPSViewport } from './types';
import { DARK_THEME, VIEW } from './constants';
import { computeForceLayout } from './ForceLayout';
import { GPSCanvas } from './GPSCanvas';
import { GPSNodes } from './GPSNodes';
import { GPSEdges } from './GPSEdges';
import { GPSAgentCursor } from './GPSAgentCursor';
import { GPSMinimap } from './GPSMinimap';
import { GPSTimeline } from './GPSTimeline';
import { GPSFilePreview } from './GPSFilePreview';
import { GPSStatsOverlay } from './GPSStatsOverlay';
import { GPSContextMenu } from './GPSContextMenu';

interface GPSNavigatorProps {
  projectId: string;
  files: string[];
  onAgentAction?: (action: string, data?: Record<string, unknown>) => void;
  onInject?: (prompt: string, context?: { filePath?: string }) => void;
}

export function GPSNavigator({ projectId, files, onAgentAction, onInject }: GPSNavigatorProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const { breadcrumbs, currentFile, activity } = useAgentStore();

  // View state
  const [viewport, setViewport] = useState<GPSViewport>({ x: 0, y: 0, zoom: 1 });
  const [search, setSearch] = useState('');
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [statsVisible, setStatsVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });

  // Preview & context menu
  const [previewNode, setPreviewNode] = useState<ForceNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: ForceNode; pos: { x: number; y: number } } | null>(null);
  const [breakpoints, setBreakpoints] = useState<Set<string>>(new Set());

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Filter files by search
  const filteredFiles = useMemo(() => {
    if (!search) return files;
    const q = search.toLowerCase();
    return files.filter((f) => f.toLowerCase().includes(q));
  }, [files, search]);

  // Compute layout (memoized — only recalculates when files change)
  const activeBreadcrumbs = useMemo(() => {
    if (timelineIndex !== null) return breadcrumbs.slice(0, timelineIndex + 1);
    return breadcrumbs;
  }, [breadcrumbs, timelineIndex]);

  const layout = useMemo(
    () => computeForceLayout({
      files: filteredFiles,
      breadcrumbs: activeBreadcrumbs,
      currentFile,
      width: containerSize.w,
      height: containerSize.h,
    }),
    [filteredFiles, activeBreadcrumbs, currentFile, containerSize],
  );

  const maxVisits = useMemo(
    () => Math.max(1, ...layout.nodes.map((n) => n.visits)),
    [layout.nodes],
  );

  const currentNode = useMemo(
    () => layout.nodes.find((n) => n.isCurrent) ?? null,
    [layout.nodes],
  );

  // Auto-center on current node
  useEffect(() => {
    if (!currentNode || timelineIndex !== null) return;
    const cx = currentNode.x + 50; // NODE.FILE_W / 2
    const cy = currentNode.y + 18; // NODE.FILE_H / 2
    setViewport((vp) => ({
      ...vp,
      x: containerSize.w / 2 - cx * vp.zoom,
      y: containerSize.h / 2 - cy * vp.zoom,
    }));
  }, [currentNode?.id, containerSize, timelineIndex]);

  // Handlers
  const handleNodeClick = useCallback((node: ForceNode) => {
    setPreviewNode((prev) => prev?.id === node.id ? null : node);
  }, []);

  const handleNodeContextMenu = useCallback((node: ForceNode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ node, pos: { x: e.clientX, y: e.clientY } });
  }, []);

  const handleRedirect = useCallback((filePath: string) => {
    if (onInject) {
      onInject(`Focus on this file and continue working: ${filePath}`, { filePath });
    }
    if (onAgentAction) {
      onAgentAction('redirectToFile', { filePath });
    }
  }, [onInject, onAgentAction]);

  const handleBreakpoint = useCallback((filePath: string) => {
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  const resetView = useCallback(() => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    setViewport((vp) => ({ ...vp, zoom: Math.min(VIEW.MAX_ZOOM, vp.zoom + VIEW.ZOOM_STEP) }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewport((vp) => ({ ...vp, zoom: Math.max(VIEW.MIN_ZOOM, vp.zoom - VIEW.ZOOM_STEP) }));
  }, []);

  // Empty state
  if (files.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-3"
        style={{ background: DARK_THEME.background }}
      >
        <MapIcon size={40} className="text-slate-700" style={{ filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.15))' }} />
        <span className="text-sm text-slate-500">{t('agent.noNavigation')}</span>
        <span className="text-xs text-slate-600">{t('agent.startAgent')}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col ${fullscreen ? 'fixed inset-0 z-40' : 'h-full'}`}
      style={{ background: DARK_THEME.background }}
    >
      {/* Toolbar — glass style */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 shrink-0"
        style={{
          background: 'rgba(17,24,39,0.6)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <MapIcon size={14} className="text-blue-400 drop-shadow-[0_0_6px_rgba(59,130,246,0.3)]" />
        <span className="text-xs font-semibold text-slate-200 mr-2 tracking-wide">{t('agent.fileMap')}</span>

        {/* File count badge */}
        <span className="text-[9px] font-mono text-slate-500 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded-md">
          {filteredFiles.length} files
        </span>

        {/* Search */}
        <div className="relative flex-1 max-w-[200px] ml-2">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('agent.gps.searchFiles')}
            className="w-full pl-7 pr-2 py-1 text-xs bg-white/[0.03] border border-white/[0.06] rounded-md text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/30 focus:ring-1 focus:ring-blue-500/15 transition-all"
          />
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <ToolbarBtn
            icon={<Flame size={13} />}
            active={heatmapEnabled}
            onClick={() => setHeatmapEnabled(!heatmapEnabled)}
            title={t('agent.gps.heatmap')}
          />
          <ToolbarBtn
            icon={<BarChart3 size={13} />}
            active={statsVisible}
            onClick={() => setStatsVisible(!statsVisible)}
            title="Stats"
          />
          <div className="w-px h-4 bg-white/[0.06] mx-1" />
          <ToolbarBtn
            icon={<ZoomOut size={13} />}
            onClick={zoomOut}
            title={t('agent.gps.zoomOut')}
          />
          <span className="text-[10px] font-mono text-slate-400 min-w-[36px] text-center bg-white/[0.03] rounded px-1 py-0.5">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <ToolbarBtn
            icon={<ZoomIn size={13} />}
            onClick={zoomIn}
            title={t('agent.gps.zoomIn')}
          />
          <div className="w-px h-4 bg-white/[0.06] mx-1" />
          <ToolbarBtn
            icon={<RotateCcw size={13} />}
            onClick={resetView}
            title={t('agent.gps.resetView')}
          />
          <ToolbarBtn
            icon={fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          />
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <GPSCanvas
          viewport={viewport}
          onViewportChange={setViewport}
          width={containerSize.w}
          height={containerSize.h - 64}
          onContextMenu={(e) => e.preventDefault()}
        >
          <GPSEdges edges={layout.edges} nodes={layout.nodes} />
          <GPSNodes
            nodes={layout.nodes}
            dirZones={layout.dirZones}
            heatmapEnabled={heatmapEnabled}
            maxVisits={maxVisits}
            onNodeClick={handleNodeClick}
            onNodeContextMenu={handleNodeContextMenu}
          />
          <GPSAgentCursor
            currentNode={currentNode}
            breadcrumbs={activeBreadcrumbs}
            nodes={layout.nodes}
          />

          {/* Breakpoint markers */}
          {layout.nodes.filter((n) => breakpoints.has(n.filePath)).map((n) => (
            <g key={`bp-${n.id}`}>
              <circle cx={n.x - 4} cy={n.y + 18} r={5} fill="#ef4444" />
              <circle cx={n.x - 4} cy={n.y + 18} r={2} fill="#fff" />
            </g>
          ))}
        </GPSCanvas>

        {/* Stats overlay */}
        <GPSStatsOverlay
          breadcrumbs={activeBreadcrumbs}
          totalFiles={files.length}
          visible={statsVisible}
        />

        {/* Minimap */}
        {minimapEnabled && layout.nodes.length > 0 && (
          <div className="absolute bottom-2 right-2" style={{ zIndex: 15 }}>
            <GPSMinimap
              nodes={layout.nodes}
              bounds={layout.bounds}
              viewport={viewport}
              containerWidth={containerSize.w}
              containerHeight={containerSize.h - 64}
              onViewportChange={setViewport}
            />
          </div>
        )}

        {/* File preview panel */}
        <GPSFilePreview
          node={previewNode}
          breadcrumbs={breadcrumbs}
          projectId={projectId}
          onClose={() => setPreviewNode(null)}
          onRedirect={handleRedirect}
          onInject={onInject}
        />

        {/* Context menu */}
        <GPSContextMenu
          node={contextMenu?.node ?? null}
          position={contextMenu?.pos ?? null}
          onClose={() => setContextMenu(null)}
          onRedirect={handleRedirect}
          onPreview={(node) => setPreviewNode(node)}
          onBreakpoint={handleBreakpoint}
          breakpoints={breakpoints}
        />
      </div>

      {/* Timeline */}
      <GPSTimeline
        breadcrumbs={breadcrumbs}
        timelineIndex={timelineIndex}
        onTimelineChange={setTimelineIndex}
      />
    </div>
  );
}

function ToolbarBtn({ icon, active, onClick, title }: {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-all ${
        active
          ? 'bg-blue-500/15 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)]'
          : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
      }`}
    >
      {icon}
    </button>
  );
}
