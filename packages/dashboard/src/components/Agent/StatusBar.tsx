import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Bot, Cpu, Activity, Clock } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

interface StatusBarProps {
  wsConnected: boolean;
  projectId: string | null;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

export function StatusBar({ wsConnected, projectId }: StatusBarProps) {
  const { t } = useTranslation();
  const status = useAgentStore((s) => s.status);
  const tokenUsage = useAgentStore((s) => s.tokenUsage);
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);

  const [serverUptime, setServerUptime] = useState<number | null>(null);
  const [eventRate, setEventRate] = useState(0);

  // Fetch server uptime periodically
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const base = window.location.port === '6400' ? 'http://localhost:8600' : '';
        const resp = await fetch(`${base}/api/stats`);
        if (resp.ok && !cancelled) {
          const data = await resp.json();
          setServerUptime(data.uptime ?? null);
        }
      } catch { /* ignore */ }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [projectId]);

  // Calculate event rate from breadcrumbs (last 60 seconds)
  useEffect(() => {
    const now = Date.now();
    const recentCount = breadcrumbs.filter((b) => now - b.timestamp < 60000).length;
    setEventRate(recentCount);
  }, [breadcrumbs]);

  const statusColors: Record<string, string> = {
    IDLE: 'text-gray-500',
    SPAWNING: 'text-yellow-400',
    RUNNING: 'text-green-400',
    PAUSED: 'text-yellow-400',
    INJECTING: 'text-purple-400',
    STOPPING: 'text-red-400',
    CRASHED: 'text-red-400',
    COMPLETED: 'text-blue-400',
  };

  const totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;

  return (
    <div className="flex items-center gap-3 px-3 py-1 bg-gray-950/90 border-t border-gray-800/50 text-[9px] select-none shrink-0" style={{ height: 24 }}>
      {/* Voltron logo */}
      <img src="/voltronlogo.png" alt="V" className="w-3.5 h-3.5 object-contain" />

      {/* WebSocket connection */}
      <div className="flex items-center gap-1" title={wsConnected ? t('statusBar.connected') : t('statusBar.disconnected')}>
        {wsConnected ? (
          <Wifi className="w-3 h-3 text-green-500" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-500" />
        )}
        <span className={wsConnected ? 'text-green-500' : 'text-red-500'}>
          {wsConnected ? 'WS' : 'WS'}
        </span>
      </div>

      <div className="w-px h-3 bg-gray-800" />

      {/* Agent status */}
      <div className="flex items-center gap-1">
        <Bot className="w-3 h-3 text-gray-600" />
        <span className={`font-semibold uppercase ${statusColors[status] ?? 'text-gray-500'}`}>
          {status}
        </span>
      </div>

      <div className="w-px h-3 bg-gray-800" />

      {/* Token usage */}
      <div className="flex items-center gap-1" title={`Input: ${formatTokens(tokenUsage.inputTokens)} | Output: ${formatTokens(tokenUsage.outputTokens)}`}>
        <Cpu className="w-3 h-3 text-gray-600" />
        <span className="text-gray-500 font-mono">{formatTokens(totalTokens)}</span>
      </div>

      <div className="w-px h-3 bg-gray-800" />

      {/* Event rate */}
      <div className="flex items-center gap-1" title={t('statusBar.eventRate')}>
        <Activity className="w-3 h-3 text-gray-600" />
        <span className={`font-mono ${eventRate > 40 ? 'text-red-400' : eventRate > 20 ? 'text-yellow-400' : 'text-gray-500'}`}>
          {eventRate}/m
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Server uptime */}
      {serverUptime != null && (
        <div className="flex items-center gap-1" title={t('statusBar.uptime')}>
          <Clock className="w-3 h-3 text-gray-600" />
          <span className="text-gray-500 font-mono">{formatUptime(serverUptime)}</span>
        </div>
      )}

      {/* Keyboard shortcut hint */}
      <div className="flex items-center gap-1 text-gray-700">
        <kbd className="bg-gray-800/60 border border-gray-700/40 rounded px-1 py-0 text-[8px]">Ctrl+K</kbd>
        <span>{t('statusBar.commandPalette')}</span>
      </div>
    </div>
  );
}
