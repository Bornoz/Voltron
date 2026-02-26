import { useMemo, useRef, useEffect } from 'react';
import {
  FileText, Eye, PenTool, Search, Terminal, Pause, Play,
  AlertTriangle, CheckCircle2, XCircle, Zap, Clock, ChevronDown,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';
import type { AgentBreadcrumb, AgentActivity } from '@voltron/shared';

/* ─── Timeline Entry ─── */

interface TimelineEntry {
  id: string;
  type: 'breadcrumb' | 'status' | 'injection' | 'error' | 'phase';
  timestamp: number;
  icon: typeof FileText;
  iconColor: string;
  title: string;
  detail?: string;
  filePath?: string;
}

/* ─── Activity Timeline ─── */

interface ActivityTimelineProps {
  onFileClick?: (filePath: string) => void;
  maxEntries?: number;
}

const ACTIVITY_ICONS: Record<AgentActivity | string, typeof FileText> = {
  READING: Eye,
  WRITING: PenTool,
  SEARCHING: Search,
  EXECUTING: Terminal,
  THINKING: Zap,
  WAITING: Clock,
  IDLE: Pause,
};

const ACTIVITY_COLORS: Record<AgentActivity | string, string> = {
  READING: 'text-blue-400',
  WRITING: 'text-green-400',
  SEARCHING: 'text-yellow-400',
  EXECUTING: 'text-orange-400',
  THINKING: 'text-purple-400',
  WAITING: 'text-gray-400',
  IDLE: 'text-gray-500',
};

export function ActivityTimeline({ onFileClick, maxEntries = 200 }: ActivityTimelineProps) {
  const { t } = useTranslation();
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const output = useAgentStore((s) => s.output);
  const phaseExecution = useAgentStore((s) => s.phaseExecution);
  const injectionQueue = useAgentStore((s) => s.injectionQueue);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Build combined timeline entries
  const entries: TimelineEntry[] = useMemo(() => {
    const items: TimelineEntry[] = [];

    // Breadcrumbs
    for (let i = 0; i < breadcrumbs.length; i++) {
      const bc = breadcrumbs[i] as AgentBreadcrumb;
      const activity = bc.activity as string;
      items.push({
        id: `bc_${i}_${bc.timestamp}`,
        type: 'breadcrumb',
        timestamp: bc.timestamp,
        icon: ACTIVITY_ICONS[activity] ?? FileText,
        iconColor: ACTIVITY_COLORS[activity] ?? 'text-gray-400',
        title: `${t(`agent.activity.${activity.toLowerCase()}` as Parameters<typeof t>[0])} — ${bc.filePath?.split('/').pop() ?? '?'}`,
        detail: bc.filePath,
        filePath: bc.filePath,
      });
    }

    // Error output
    for (let i = 0; i < output.length; i++) {
      const o = output[i];
      if (o.type === 'error') {
        items.push({
          id: `err_${i}_${o.timestamp}`,
          type: 'error',
          timestamp: o.timestamp,
          icon: AlertTriangle,
          iconColor: 'text-red-400',
          title: o.text.substring(0, 80),
          detail: o.text.length > 80 ? o.text : undefined,
        });
      }
    }

    // Injections
    for (const inj of injectionQueue) {
      items.push({
        id: `inj_${inj.id}`,
        type: 'injection',
        timestamp: inj.queuedAt,
        icon: Zap,
        iconColor: inj.status === 'applied' ? 'text-green-400' : 'text-yellow-400',
        title: `Injection: ${inj.prompt.substring(0, 60)}`,
        detail: `Status: ${inj.status}`,
      });
    }

    // Phase changes
    for (let i = 0; i < phaseExecution.phases.length; i++) {
      const phase = phaseExecution.phases[i];
      const status = phase.status;
      let icon = Play;
      let color = 'text-blue-400';
      if (status === 'approved' || status === 'completed') {
        icon = CheckCircle2;
        color = 'text-green-400';
      } else if (status === 'rejected') {
        icon = XCircle;
        color = 'text-red-400';
      } else if (status === 'running') {
        icon = Play;
        color = 'text-cyan-400';
      }
      items.push({
        id: `phase_${phase.id}`,
        type: 'phase',
        timestamp: Date.now() - (phaseExecution.phases.length - i) * 1000, // approximate
        icon,
        iconColor: color,
        title: `Phase ${i + 1}: ${phase.title}`,
        detail: `Status: ${status}`,
      });
    }

    // Sort by timestamp, take latest
    items.sort((a, b) => a.timestamp - b.timestamp);
    return items.slice(-maxEntries);
  }, [breadcrumbs, output, injectionQueue, phaseExecution, maxEntries, t]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 py-4">
        <Clock className="w-5 h-5 mb-1.5 opacity-50" />
        <span className="text-[10px]">{t('agent.timeline.empty')}</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-700/50" />

        {entries.map((entry, idx) => {
          const Icon = entry.icon;
          const isLast = idx === entries.length - 1;

          return (
            <div key={entry.id} className="relative flex items-start gap-2 pb-2 group">
              {/* Dot / Icon */}
              <div className={`relative z-10 flex items-center justify-center w-3.5 h-3.5 rounded-full ${
                isLast ? 'bg-gray-800 ring-1 ring-blue-500/50' : 'bg-gray-900'
              }`}>
                <Icon className={`w-2 h-2 ${entry.iconColor}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 -mt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-300 truncate">{entry.title}</span>
                  <span className="text-[8px] text-gray-600 shrink-0">
                    {formatTime(entry.timestamp)}
                  </span>
                </div>
                {entry.filePath && onFileClick && (
                  <button
                    onClick={() => onFileClick(entry.filePath!)}
                    className="text-[9px] text-blue-400/70 hover:text-blue-400 truncate block mt-0.5 transition-colors"
                  >
                    {entry.filePath}
                  </button>
                )}
                {entry.detail && !entry.filePath && (
                  <div className="text-[9px] text-gray-500 truncate mt-0.5">{entry.detail}</div>
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

// Suppress unused import warnings
void ChevronDown;
