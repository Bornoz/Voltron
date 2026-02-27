import { Activity, Zap, Clock, Database } from 'lucide-react';
import type { ConnectionStatus } from '../../lib/ws';
import { useEventStore } from '../../stores/eventStore';
import { formatRelativeTime } from '../../lib/formatters';
import { useTranslation } from '../../i18n';

interface StatusBarProps {
  connectionStatus: ConnectionStatus;
}

export function StatusBar({ connectionStatus }: StatusBarProps) {
  const { t } = useTranslation();
  const events = useEventStore((s) => s.events);
  const eventCount = events.length;
  const lastEvent = events[0];

  // Calculate events per minute (last 60 seconds)
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const recentCount = events.filter((e) => e.timestamp > oneMinuteAgo).length;

  const connectionColors: Record<ConnectionStatus, string> = {
    connected: 'text-green-400',
    connecting: 'text-yellow-400',
    reconnecting: 'text-yellow-400',
    disconnected: 'text-red-400',
  };

  const connectionLabel = t(`header.${connectionStatus}` as const);

  return (
    <footer className="flex items-center justify-between h-7 px-4 border-t border-white/[0.04] glass text-xs text-gray-500 shrink-0">
      <div className="flex items-center gap-4">
        {/* Connection */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={connectionColors[connectionStatus]}>
            {connectionLabel.toUpperCase()}
          </span>
        </div>

        {/* Event count */}
        <div className="flex items-center gap-1.5">
          <Database className="w-3 h-3" />
          <span>{eventCount} {t('statusBar.events')}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Rate */}
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3" />
          <span>{recentCount}/min</span>
        </div>

        {/* Last event */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>
            {lastEvent ? formatRelativeTime(lastEvent.timestamp) : t('statusBar.noEvents')}
          </span>
        </div>

        {/* Shortcut hint */}
        <div className="flex items-center gap-1.5 text-gray-600">
          <Activity className="w-3 h-3" />
          <span>{t('statusBar.emergencyStop')}</span>
        </div>
      </div>
    </footer>
  );
}
