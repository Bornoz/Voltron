import { memo, useMemo } from 'react';
import { BarChart3, FileCode, Eye, Zap } from 'lucide-react';
import type { AgentBreadcrumb } from '@voltron/shared';
import { ACTIVITY_COLORS } from './constants';

interface GPSStatsOverlayProps {
  breadcrumbs: AgentBreadcrumb[];
  totalFiles: number;
  visible: boolean;
}

export const GPSStatsOverlay = memo(function GPSStatsOverlay({
  breadcrumbs, totalFiles, visible,
}: GPSStatsOverlayProps) {
  const stats = useMemo(() => {
    const visitMap = new Map<string, number>();
    const activityCounts: Record<string, number> = {};

    for (const bc of breadcrumbs) {
      visitMap.set(bc.filePath, (visitMap.get(bc.filePath) ?? 0) + 1);
      activityCounts[bc.activity] = (activityCounts[bc.activity] ?? 0) + 1;
    }

    const topFiles = [...visitMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, visits]) => {
        const parts = path.split('/');
        return { name: parts[parts.length - 1], path, visits };
      });

    return {
      visitedFiles: visitMap.size,
      totalVisits: breadcrumbs.length,
      topFiles,
      activityCounts,
      avgVisitsPerFile: visitMap.size > 0 ? Math.round(breadcrumbs.length / visitMap.size * 10) / 10 : 0,
    };
  }, [breadcrumbs]);

  if (!visible) return null;

  return (
    <div
      className="absolute top-2 left-2 flex flex-col gap-2 p-3 rounded-xl animate-fade-in-up"
      style={{
        background: 'rgba(17,24,39,0.85)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 15,
        minWidth: 210,
      }}
    >
      {/* Summary */}
      <div className="flex items-center gap-2 text-[11px] text-slate-200 font-semibold">
        <BarChart3 size={12} className="text-blue-400 drop-shadow-[0_0_4px_rgba(59,130,246,0.4)]" />
        Statistics
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
        <div className="flex items-center gap-1 text-slate-400">
          <FileCode size={10} />
          Files
        </div>
        <div className="text-slate-200 font-mono">{stats.visitedFiles}/{totalFiles}</div>

        <div className="flex items-center gap-1 text-slate-400">
          <Eye size={10} />
          Visits
        </div>
        <div className="text-slate-200 font-mono">{stats.totalVisits}</div>

        <div className="flex items-center gap-1 text-slate-400">
          <Zap size={10} />
          Avg/file
        </div>
        <div className="text-slate-200 font-mono">{stats.avgVisitsPerFile}</div>
      </div>

      {/* Top files */}
      {stats.topFiles.length > 0 && (
        <div className="mt-1 border-t border-white/[0.06] pt-1">
          <div className="text-[9px] text-slate-500 mb-1">TOP FILES</div>
          {stats.topFiles.map((f) => (
            <div key={f.path} className="flex items-center gap-1 py-0.5">
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${Math.max(8, (f.visits / stats.totalVisits) * 100)}%`,
                  background: '#3b82f6',
                  opacity: 0.7,
                }}
              />
              <span className="text-[9px] font-mono text-slate-400 truncate flex-1">{f.name}</span>
              <span className="text-[9px] font-mono text-slate-500">{f.visits}</span>
            </div>
          ))}
        </div>
      )}

      {/* Activity breakdown */}
      <div className="border-t border-white/[0.06] pt-1">
        <div className="text-[9px] text-slate-500 mb-1">ACTIVITY</div>
        <div className="flex gap-1 flex-wrap">
          {Object.entries(stats.activityCounts).map(([activity, count]) => (
            <span
              key={activity}
              className="px-1.5 py-0.5 rounded text-[9px] font-mono"
              style={{
                background: (ACTIVITY_COLORS[activity] ?? '#6b7280') + '20',
                color: ACTIVITY_COLORS[activity] ?? '#6b7280',
              }}
            >
              {activity} {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
