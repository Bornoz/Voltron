import { useMemo } from 'react';
import { Eye, Pencil, Search, Terminal, Brain, Clock, ChevronRight } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentActivity, AgentBreadcrumb } from '@voltron/shared';
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

function splitPath(filePath: string): string[] {
  return filePath.replace(/^\//, '').split('/').filter(Boolean);
}

interface GPSTrackerProps {
  onFileClick?: (path: string) => void;
}

export function GPSTracker({ onFileClick }: GPSTrackerProps) {
  const { t } = useTranslation();
  const location = useAgentStore((s) => s.location);
  const activity = useAgentStore((s) => s.activity);
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const status = useAgentStore((s) => s.status);

  const isActive = ['RUNNING', 'PAUSED', 'INJECTING'].includes(status);
  const ActivityIcon = ACTIVITY_ICONS[activity] ?? Clock;

  // Deduplicate breadcrumbs for display
  const displayCrumbs = useMemo(() => {
    const deduped: AgentBreadcrumb[] = [];
    let lastPath = '';
    for (const c of breadcrumbs.slice(-20)) {
      if (c.filePath !== lastPath) {
        deduped.push(c);
        lastPath = c.filePath;
      }
    }
    return deduped.reverse();
  }, [breadcrumbs]);

  const pathParts = location ? splitPath(location.filePath) : [];

  return (
    <div className="space-y-2">
      {/* Current Location */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
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

            {/* Activity + tool */}
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
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-600">{t('agent.noLocation')}</span>
        )}
      </div>

      {/* Breadcrumb Trail */}
      {displayCrumbs.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-0.5">
          {displayCrumbs.map((crumb, i) => {
            const CrumbIcon = ACTIVITY_ICONS[crumb.activity] ?? Clock;
            const parts = splitPath(crumb.filePath);
            const fileName = parts[parts.length - 1] ?? crumb.filePath;
            return (
              <button
                key={`${crumb.timestamp}-${i}`}
                onClick={() => onFileClick?.(crumb.filePath)}
                className="flex items-center gap-1.5 w-full text-left px-2 py-0.5 rounded hover:bg-gray-800/50 transition-colors group"
              >
                <CrumbIcon className={`w-2.5 h-2.5 ${ACTIVITY_COLORS[crumb.activity]} opacity-60`} />
                <span className="text-[10px] text-gray-500 group-hover:text-gray-300 truncate flex-1">
                  {fileName}
                </span>
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
    </div>
  );
}
