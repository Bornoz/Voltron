import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useWindowStore, type PanelId } from '../../../stores/windowStore';
import { useAgentStore } from '../../../stores/agentStore';
import { useTranslation } from '../../../i18n';
import { FloatingPanel } from './FloatingPanel';
import { Taskbar } from './Taskbar';

import { SimulatorEmbed } from '../SimulatorEmbed';
import { GPSNavigator } from '../gps/GPSNavigator';
import { GPSTracker } from '../GPSTracker';
import { PhaseTracker } from '../PhaseTracker';
import { PlanViewer } from '../PlanViewer';
import { PromptInjector } from '../PromptInjector';
import { ActivityTimeline } from '../ActivityTimeline';
import { AgentOutput } from '../AgentOutput';
import { RulesEditor } from '../RulesEditor';
import { MemoryManager } from '../MemoryManager';
import { SessionHistory } from '../SessionHistory';

/* ─── Props ─── */

interface WindowManagerProps {
  projectId: string;
  onInject: (prompt: string, context?: { filePath?: string; constraints?: string[] }) => void;
  onAgentAction: (action: string, data?: Record<string, unknown>) => void;
}

export function WindowManager({ projectId, onInject, onAgentAction }: WindowManagerProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panels = useWindowStore((s) => s.panels);
  const isDragging = useWindowStore((s) => s.isDragging);
  const isResizing = useWindowStore((s) => s.isResizing);
  const isPanning = useWindowStore((s) => s.isPanning);
  const panX = useWindowStore((s) => s.panX);
  const panY = useWindowStore((s) => s.panY);
  const setViewportSize = useWindowStore((s) => s.setViewportSize);
  const setPanning = useWindowStore((s) => s.setPanning);
  const pan = useWindowStore((s) => s.pan);
  const resetPan = useWindowStore((s) => s.resetPan);

  // Agent state for conditional rendering
  const status = useAgentStore((s) => s.status);
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const phaseExecution = useAgentStore((s) => s.phaseExecution);

  const isActive = !['IDLE', 'COMPLETED', 'CRASHED'].includes(status);
  const hasPhases = phaseExecution.status !== 'idle' && phaseExecution.phases.length > 0;

  // Derive files from breadcrumbs
  const files = useMemo(() => {
    const fileSet = new Set<string>();
    for (const bc of breadcrumbs) {
      if (bc.filePath) fileSet.add(bc.filePath);
    }
    return Array.from(fileSet);
  }, [breadcrumbs]);

  /* ── Viewport resize observer ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewportSize(Math.round(width), Math.round(height));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewportSize]);

  /* ── Canvas panning ── */
  const panStartRef = useRef({ x: 0, y: 0 });
  const panRafRef = useRef<number>(0);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    // Only start pan if clicking on the canvas background itself
    if (e.target !== e.currentTarget) return;
    // Left or middle mouse button
    if (e.button !== 0 && e.button !== 1) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    panStartRef.current = { x: e.clientX, y: e.clientY };
    setPanning(true);
  }, [setPanning]);

  useEffect(() => {
    if (!isPanning) return;

    const handleMove = (e: PointerEvent) => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      panRafRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        pan(dx, dy);
      });
    };

    const handleUp = () => {
      setPanning(false);
      if (panRafRef.current) {
        cancelAnimationFrame(panRafRef.current);
        panRafRef.current = 0;
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
    };
  }, [isPanning, pan, setPanning]);

  /* ── Mouse wheel on empty background → pan ── */
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as Node;
      // Only pan when wheel is directly on the container or canvas background
      if (target !== el && target !== canvas) return;
      e.preventDefault();
      pan(-e.deltaX, -e.deltaY);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [pan]);

  /* ── Double-click background → reset pan ── */
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    resetPan();
  }, [resetPan]);

  /* ── File click from tracker ── */
  const handleFileClick = useCallback((_path: string) => {
    // Placeholder for file content viewing
  }, []);

  /* ── Panel content mapping ── */
  const renderPanelContent = useCallback((id: PanelId) => {
    switch (id) {
      case 'visual-editor':
        return <SimulatorEmbed projectId={projectId} onInject={onInject} />;

      case 'gps-navigator':
        return (
          <GPSNavigator
            projectId={projectId}
            files={files}
            onAgentAction={onAgentAction}
            onInject={onInject}
          />
        );

      case 'agent-tracker':
        return isActive ? (
          <div className="h-full p-2 overflow-auto">
            <GPSTracker
              onFileClick={handleFileClick}
              onAgentAction={onAgentAction}
            />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-gray-600">
            {t('agent.noLocation')}
          </div>
        );

      case 'phase-viewer':
        return hasPhases ? (
          <PhaseTracker />
        ) : (
          <div className="h-full p-2 overflow-auto">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-medium">
              {t('agent.plan')}
            </div>
            <PlanViewer />
          </div>
        );

      case 'prompt-injector':
        return isActive ? (
          <div className="h-full p-2 overflow-auto">
            <PromptInjector projectId={projectId} onInject={onInject} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-[10px] text-gray-600">
            {t('agent.promptInjector')}
          </div>
        );

      case 'activity-timeline':
        return (
          <div className="h-full p-2 overflow-auto">
            <ActivityTimeline
              onFileClick={(path) => onAgentAction('redirectToFile', { filePath: path })}
            />
          </div>
        );

      case 'agent-output':
        return (
          <div className="h-full overflow-hidden">
            <AgentOutput />
          </div>
        );

      case 'rules-editor':
        return <RulesEditor projectId={projectId} />;

      case 'memory-manager':
        return <MemoryManager projectId={projectId} />;

      case 'session-history':
        return (
          <SessionHistory
            projectId={projectId}
            onRerun={(config) => onAgentAction('spawnWithConfig', config)}
          />
        );

      default:
        return null;
    }
  }, [projectId, onInject, onAgentAction, files, isActive, hasPhases, t, handleFileClick]);

  /* ── Separate maximized vs normal panels ── */
  const { normalPanels, maximizedPanels } = useMemo(() => {
    const normal: (typeof panels)[PanelId][] = [];
    const maxed: (typeof panels)[PanelId][] = [];
    for (const p of Object.values(panels)) {
      if (!p.visible) continue;
      if (p.maximized) maxed.push(p);
      else normal.push(p);
    }
    return { normalPanels: normal, maximizedPanels: maxed };
  }, [panels]);

  const hasPan = panX !== 0 || panY !== 0;

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-gray-950/20"
    >
      {/* Pannable canvas — holds non-maximized panels */}
      <div
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onDoubleClick={handleCanvasDoubleClick}
        className="absolute inset-0"
        style={{
          transform: `translate(${panX}px, ${panY}px)`,
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
      >
        {normalPanels.map((panel) => (
          <FloatingPanel
            key={panel.id}
            panel={panel}
            title={t(panel.title as never)}
          >
            {renderPanelContent(panel.id)}
          </FloatingPanel>
        ))}
      </div>

      {/* Maximized panels — fixed position, outside canvas pan */}
      {maximizedPanels.map((panel) => (
        <FloatingPanel
          key={panel.id}
          panel={panel}
          title={t(panel.title as never)}
        >
          {renderPanelContent(panel.id)}
        </FloatingPanel>
      ))}

      {/* Pan reset indicator */}
      {hasPan && (
        <button
          onClick={resetPan}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[99998] px-3 py-1 text-[10px] text-gray-400 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 rounded-full backdrop-blur-sm transition-colors"
        >
          {t('agent.windowManager.resetView')}
        </button>
      )}

      {/* Global overlay during drag/resize/pan — prevents iframe pointer theft */}
      {(isDragging || isResizing || isPanning) && (
        <div
          className="absolute inset-0 z-[99999]"
          style={{ pointerEvents: 'all', cursor: isDragging ? 'move' : isPanning ? 'grabbing' : 'default' }}
        />
      )}

      {/* Taskbar for minimized panels */}
      <Taskbar />
    </div>
  );
}
