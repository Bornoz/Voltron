import { useCallback, type ReactNode } from 'react';
import {
  Minus, Square, X, Monitor, Map, Radio,
  ListChecks, MessageSquare, Activity, Terminal,
  ClipboardList, Brain, History, GripVertical,
} from 'lucide-react';
import { useDrag } from '../../../hooks/useDrag';
import { useResize, computeResize, type ResizeDirection } from '../../../hooks/useResize';
import { useWindowStore, type PanelId, type PanelState } from '../../../stores/windowStore';

/* ─── Panel Icons ─── */

const PANEL_ICONS: Record<PanelId, ReactNode> = {
  'visual-editor': <Monitor className="w-3 h-3" />,
  'gps-navigator': <Map className="w-3 h-3" />,
  'agent-tracker': <Radio className="w-3 h-3" />,
  'phase-viewer': <ListChecks className="w-3 h-3" />,
  'prompt-injector': <MessageSquare className="w-3 h-3" />,
  'activity-timeline': <Activity className="w-3 h-3" />,
  'agent-output': <Terminal className="w-3 h-3" />,
  'rules-editor': <ClipboardList className="w-3 h-3" />,
  'memory-manager': <Brain className="w-3 h-3" />,
  'session-history': <History className="w-3 h-3" />,
};

const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

/* ─── Props ─── */

interface FloatingPanelProps {
  panel: PanelState;
  title: string;
  children: ReactNode;
}

export function FloatingPanel({ panel, title, children }: FloatingPanelProps) {
  const movePanel = useWindowStore((s) => s.movePanel);
  const resizePanel = useWindowStore((s) => s.resizePanel);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const toggleVisibility = useWindowStore((s) => s.toggleVisibility);
  const setDragging = useWindowStore((s) => s.setDragging);
  const setResizing = useWindowStore((s) => s.setResizing);
  const activePanel = useWindowStore((s) => s.activePanel);

  const isActive = activePanel === panel.id;

  /* ── Drag ── */
  const handleDrag = useCallback((dx: number, dy: number) => {
    const p = useWindowStore.getState().panels[panel.id];
    if (!p || p.maximized) return;
    movePanel(panel.id, p.x + dx, p.y + dy);
  }, [panel.id, movePanel]);

  const handleDragStart = useCallback(() => {
    setDragging(true);
    bringToFront(panel.id);
  }, [panel.id, bringToFront, setDragging]);

  const handleDragEnd = useCallback(() => {
    setDragging(false);
  }, [setDragging]);

  const { dragHandleProps } = useDrag({
    onDrag: handleDrag,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    disabled: panel.maximized,
  });

  /* ── Resize ── */
  const handleResize = useCallback((dir: ResizeDirection, dx: number, dy: number) => {
    const p = useWindowStore.getState().panels[panel.id];
    if (!p || p.maximized) return;
    const result = computeResize(dir, dx, dy, p);
    resizePanel(panel.id, result.width, result.height, result.x, result.y);
  }, [panel.id, resizePanel]);

  const handleResizeStart = useCallback(() => {
    setResizing(true);
    bringToFront(panel.id);
  }, [panel.id, bringToFront, setResizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(false);
  }, [setResizing]);

  const { getHandleProps } = useResize({
    onResize: handleResize,
    onResizeStart: handleResizeStart,
    onResizeEnd: handleResizeEnd,
    disabled: panel.maximized,
  });

  /* ── Events ── */
  const handleMouseDown = useCallback(() => {
    bringToFront(panel.id);
  }, [panel.id, bringToFront]);

  const handleDoubleClickTitle = useCallback(() => {
    toggleMaximize(panel.id);
  }, [panel.id, toggleMaximize]);

  const handleMinimize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMinimize(panel.id);
  }, [panel.id, toggleMinimize]);

  const handleMaximize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMaximize(panel.id);
  }, [panel.id, toggleMaximize]);

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleVisibility(panel.id);
  }, [panel.id, toggleVisibility]);

  /* ── Render ── */
  if (!panel.visible) return null;

  // Minimized = just title bar height shown at its position
  const renderHeight = panel.minimized ? 32 : panel.height;
  const isMaximized = panel.maximized;

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`${isMaximized ? 'fixed inset-0' : 'absolute'} flex flex-col overflow-hidden
        bg-gray-900/95 backdrop-blur-md border
        ${isMaximized ? 'rounded-none' : 'rounded-lg'}
        shadow-2xl shadow-black/50
        ${isActive ? 'border-blue-500/40 ring-1 ring-blue-500/20' : 'border-gray-700/60'}
      `}
      style={isMaximized ? {
        zIndex: 99999,
      } : {
        left: panel.x,
        top: panel.y,
        width: panel.width,
        height: renderHeight,
        zIndex: panel.zIndex,
        transition: 'box-shadow 150ms ease-out',
      }}
    >
      {/* ── Title Bar ── */}
      <div
        {...dragHandleProps}
        onDoubleClick={handleDoubleClickTitle}
        className={`flex items-center gap-1 h-8 px-1.5 shrink-0 select-none
          border-b border-gray-800/50 cursor-move
          ${isActive ? 'bg-gray-800/80' : 'bg-gray-900/60'}
        `}
      >
        {/* Drag grip indicator */}
        <GripVertical className="w-3 h-3 text-gray-600 shrink-0" />
        {/* Icon + Title */}
        <span className="text-gray-400">{PANEL_ICONS[panel.id]}</span>
        <span className="text-[10px] font-medium text-gray-300 truncate flex-1">
          {title}
        </span>

        {/* Window Controls */}
        <button
          onClick={handleMinimize}
          className="p-0.5 text-gray-500 hover:text-yellow-400 hover:bg-gray-700/60 rounded transition-colors"
          title="Minimize"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-0.5 text-gray-500 hover:text-green-400 hover:bg-gray-700/60 rounded transition-colors"
          title={panel.maximized ? 'Restore' : 'Maximize'}
        >
          <Square className="w-2.5 h-2.5" />
        </button>
        <button
          onClick={handleClose}
          className="p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
          title="Close"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* ── Content ── */}
      {!panel.minimized && (
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      )}

      {/* ── Resize Handles ── */}
      {!panel.maximized && !panel.minimized && RESIZE_DIRECTIONS.map((dir) => {
        const isCorner = ['ne', 'se', 'sw', 'nw'].includes(dir);
        return (
          <div key={dir} {...getHandleProps(dir)}>
            {isCorner && (
              <div className={`absolute w-2 h-2 rounded-full bg-gray-500/50 hover:bg-blue-400 transition-colors ${
                dir === 'nw' ? 'top-0 left-0' :
                dir === 'ne' ? 'top-0 right-0' :
                dir === 'se' ? 'bottom-0 right-0' :
                'bottom-0 left-0'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
