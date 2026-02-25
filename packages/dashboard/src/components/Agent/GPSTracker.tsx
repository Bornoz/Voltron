import { useMemo, useState, useCallback } from 'react';
import {
  Eye, Pencil, Search, Terminal, Brain, Clock, ChevronRight,
  Maximize2, Minimize2, Pause, Square, MessageSquare, FileCode, History,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentBreadcrumb } from '@voltron/shared';
import { useTranslation } from '../../i18n';

const ACTIVITY_ICONS: Record<string, typeof Eye> = {
  READING: Eye,
  WRITING: Pencil,
  SEARCHING: Search,
  EXECUTING: Terminal,
  THINKING: Brain,
  WAITING: Clock,
  IDLE: Clock,
};

const ACTIVITY_COLORS: Record<string, string> = {
  READING: 'text-green-400',
  WRITING: 'text-yellow-400',
  SEARCHING: 'text-blue-400',
  EXECUTING: 'text-orange-400',
  THINKING: 'text-purple-400',
  WAITING: 'text-gray-400',
  IDLE: 'text-gray-500',
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
}

function splitPath(filePath: string): string[] {
  return filePath.replace(/^\//, '').split('/').filter(Boolean);
}

interface GPSTrackerProps {
  onFileClick?: (path: string) => void;
  onAgentAction?: (action: string, data?: Record<string, unknown>) => void;
}

export function GPSTracker({ onFileClick, onAgentAction }: GPSTrackerProps) {
  const { t } = useTranslation();
  const location = useAgentStore((s) => s.location);
  const activity = useAgentStore((s) => s.activity);
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const status = useAgentStore((s) => s.status);

  const [expanded, setExpanded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; filePath: string; idx: number } | null>(null);

  const isActive = ['RUNNING', 'PAUSED', 'INJECTING'].includes(status);
  const ActivityIcon = ACTIVITY_ICONS[activity] ?? Clock;

  // Deduplicate breadcrumbs for display — show more in expanded mode
  const displayCrumbs = useMemo(() => {
    const limit = expanded ? 50 : 20;
    const deduped: (AgentBreadcrumb & { count: number })[] = [];
    let lastPath = '';
    let lastEntry: (AgentBreadcrumb & { count: number }) | null = null;
    for (const c of breadcrumbs.slice(-limit)) {
      if (c.filePath !== lastPath) {
        lastEntry = { ...c, count: 1 };
        deduped.push(lastEntry);
        lastPath = c.filePath;
      } else if (lastEntry) {
        lastEntry.count++;
        lastEntry.activity = c.activity;
        lastEntry.durationMs = (lastEntry.durationMs || 0) + (c.durationMs || 0);
      }
    }
    return deduped.reverse();
  }, [breadcrumbs, expanded]);

  const pathParts = location ? splitPath(location.filePath) : [];

  // Elapsed time since current location started
  const elapsed = location ? Date.now() - (location.timestamp || Date.now()) : 0;

  // Context menu handler for breadcrumb items
  const handleBreadcrumbContext = useCallback((e: React.MouseEvent, filePath: string, idx: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, filePath, idx });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div className="space-y-2" onClick={closeContextMenu}>
      {/* Current Location — with timestamp sync */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50 backdrop-blur-sm">
        {isActive && (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
        )}

        {location ? (
          <div className="flex-1 min-w-0">
            {/* Breadcrumb path */}
            <div className="flex items-center gap-0.5 text-xs overflow-x-auto scrollbar-thin">
              {pathParts.map((part, i) => (
                <span key={i} className="flex items-center gap-0.5 shrink-0">
                  {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-gray-600" />}
                  <span className={i === pathParts.length - 1 ? 'text-blue-400 font-medium' : 'text-gray-500'}>
                    {part}
                  </span>
                </span>
              ))}
            </div>

            {/* Activity + tool + timestamp */}
            <div className="flex items-center gap-1.5 mt-1">
              <ActivityIcon className={`w-3 h-3 ${ACTIVITY_COLORS[activity]}`} />
              <span className={`text-[10px] ${ACTIVITY_COLORS[activity]}`}>
                {t(`agent.activity.${activity.toLowerCase()}`)}
              </span>
              {location.toolName && (
                <span className="text-[10px] text-gray-600 font-mono">
                  ({location.toolName})
                </span>
              )}
              {/* Millisecond-level timestamp */}
              <span className="text-[9px] text-gray-600 font-mono ml-auto">
                {formatTimestamp(location.timestamp || Date.now())}
              </span>
              {elapsed > 0 && (
                <span className="text-[9px] text-gray-500">
                  {formatDuration(elapsed)}
                </span>
              )}
            </div>

            {/* Line range if available */}
            {location.lineRange && (
              <div className="text-[9px] text-gray-600 mt-0.5">
                {t('agent.gps.lineRange')}: {location.lineRange.start}-{location.lineRange.end}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-600">{t('agent.noLocation')}</span>
        )}

        {/* Expand/Collapse + Agent controls */}
        <div className="flex items-center gap-1 shrink-0">
          {isActive && onAgentAction && (
            <>
              <button
                onClick={() => onAgentAction('pause')}
                className="p-1 hover:bg-gray-700/50 rounded transition-colors"
                title={t('agent.gps.pauseAgent')}
              >
                <Pause className="w-3 h-3 text-gray-500 hover:text-yellow-400" />
              </button>
              <button
                onClick={() => onAgentAction('stop')}
                className="p-1 hover:bg-gray-700/50 rounded transition-colors"
                title={t('agent.gps.stopAgent')}
              >
                <Square className="w-3 h-3 text-gray-500 hover:text-red-400" />
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-700/50 rounded transition-colors"
            title={expanded ? t('agent.gps.compact') : t('agent.gps.expanded')}
          >
            {expanded ? (
              <Minimize2 className="w-3 h-3 text-gray-500 hover:text-gray-300" />
            ) : (
              <Maximize2 className="w-3 h-3 text-gray-500 hover:text-gray-300" />
            )}
          </button>
        </div>
      </div>

      {/* Breadcrumb Trail — with right-click context menus */}
      {displayCrumbs.length > 0 && (
        <div className={`overflow-y-auto space-y-0.5 ${expanded ? 'max-h-64' : 'max-h-32'} transition-all duration-200`}>
          {displayCrumbs.map((crumb, i) => {
            const CrumbIcon = ACTIVITY_ICONS[crumb.activity] ?? Clock;
            const parts = splitPath(crumb.filePath);
            const fileName = parts[parts.length - 1] ?? crumb.filePath;
            const isFirst = i === 0;
            return (
              <button
                key={`${crumb.timestamp}-${i}`}
                onClick={() => onFileClick?.(crumb.filePath)}
                onContextMenu={(e) => handleBreadcrumbContext(e, crumb.filePath, i)}
                className={`flex items-center gap-1.5 w-full text-left px-2 py-1 rounded transition-all group ${
                  isFirst ? 'bg-gray-800/40 border border-gray-700/30' : 'hover:bg-gray-800/50'
                }`}
              >
                <CrumbIcon className={`w-2.5 h-2.5 ${ACTIVITY_COLORS[crumb.activity]} ${isFirst ? '' : 'opacity-60'}`} />
                <span className={`text-[10px] truncate flex-1 ${
                  isFirst ? 'text-gray-200 font-medium' : 'text-gray-500 group-hover:text-gray-300'
                }`}>
                  {expanded ? crumb.filePath : fileName}
                </span>
                {/* Visit count */}
                {crumb.count > 1 && (
                  <span className="text-[8px] text-blue-400 bg-blue-900/30 px-1 rounded font-mono">
                    x{crumb.count}
                  </span>
                )}
                {/* Tool name in expanded */}
                {expanded && crumb.toolName && (
                  <span className="text-[8px] text-gray-600 font-mono shrink-0">
                    {crumb.toolName}
                  </span>
                )}
                {/* Timestamp in expanded mode */}
                {expanded && (
                  <span className="text-[8px] text-gray-700 font-mono shrink-0">
                    {formatTimestamp(crumb.timestamp)}
                  </span>
                )}
                {crumb.durationMs !== undefined && (
                  <span className="text-[9px] text-gray-600 font-mono shrink-0">
                    {formatDuration(crumb.durationMs)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Context Menu for breadcrumb items */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-950/95 backdrop-blur-md border border-gray-700/60 rounded-lg shadow-2xl shadow-black/50 min-w-[180px] py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            icon={MessageSquare}
            label={t('agent.gps.doInFile')}
            color="text-blue-400"
            onClick={() => {
              onAgentAction?.('promptInFile', { filePath: contextMenu.filePath });
              closeContextMenu();
            }}
          />
          <ContextMenuItem
            icon={FileCode}
            label={t('agent.gps.viewContent')}
            color="text-cyan-400"
            onClick={() => {
              onAgentAction?.('viewFile', { filePath: contextMenu.filePath });
              closeContextMenu();
            }}
          />
          <ContextMenuItem
            icon={History}
            label={t('agent.gps.viewHistory')}
            color="text-purple-400"
            onClick={() => {
              onAgentAction?.('viewHistory', { filePath: contextMenu.filePath });
              closeContextMenu();
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Context Menu Item ─── */

function ContextMenuItem({ icon: Icon, label, color, onClick }: {
  icon: typeof Eye;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-gray-300 hover:bg-gray-800/60 transition-colors"
    >
      <Icon className={`w-3 h-3 ${color}`} />
      {label}
    </button>
  );
}
