import { useState, useEffect } from 'react';
import { Bot, Play, Pause, Square, Zap, Clock, Cpu } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import type { AgentStatus } from '@voltron/shared';
import { useTranslation } from '../../i18n';

const STATUS_COLORS: Record<AgentStatus, string> = {
  IDLE: 'bg-gray-600',
  SPAWNING: 'bg-yellow-500 animate-pulse',
  RUNNING: 'bg-green-500',
  PAUSED: 'bg-yellow-500',
  INJECTING: 'bg-purple-500 animate-pulse',
  STOPPING: 'bg-red-500 animate-pulse',
  CRASHED: 'bg-red-600',
  COMPLETED: 'bg-blue-500',
};

const STATUS_TEXT_COLORS: Record<AgentStatus, string> = {
  IDLE: 'text-gray-500',
  SPAWNING: 'text-yellow-400',
  RUNNING: 'text-green-400',
  PAUSED: 'text-yellow-400',
  INJECTING: 'text-purple-400',
  STOPPING: 'text-red-400',
  CRASHED: 'text-red-400',
  COMPLETED: 'text-blue-400',
};

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return '0:00';
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface AgentControlBarProps {
  onSpawn: () => void;
  onPause: () => void;
  onResume: () => void;
  onKill: () => void;
}

export function AgentControlBar({ onSpawn, onPause, onResume, onKill }: AgentControlBarProps) {
  const { t } = useTranslation();
  const status = useAgentStore((s) => s.status);
  const model = useAgentStore((s) => s.model);
  const startedAt = useAgentStore((s) => s.startedAt);
  const tokenUsage = useAgentStore((s) => s.tokenUsage);
  const [elapsed, setElapsed] = useState('0:00');

  // Update elapsed timer
  useEffect(() => {
    if (!startedAt || !['RUNNING', 'PAUSED', 'INJECTING'].includes(status)) return;
    const interval = setInterval(() => {
      setElapsed(formatElapsed(startedAt));
    }, 1000);
    setElapsed(formatElapsed(startedAt));
    return () => clearInterval(interval);
  }, [startedAt, status]);

  const isActive = ['RUNNING', 'PAUSED', 'SPAWNING', 'INJECTING', 'STOPPING'].includes(status);

  return (
    <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg">
      {/* Status badge */}
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[status]}`}
          style={{
            boxShadow: ['RUNNING', 'SPAWNING', 'INJECTING'].includes(status)
              ? `0 0 8px currentColor`
              : 'none',
          }}
        />
        <span className={`text-xs font-semibold uppercase ${STATUS_TEXT_COLORS[status]}`}>
          {t(`agent.status.${status.toLowerCase()}`)}
        </span>
      </div>

      <div className="w-px h-4 bg-white/[0.06]" />

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {status === 'IDLE' || status === 'COMPLETED' || status === 'CRASHED' ? (
          <button
            onClick={onSpawn}
            aria-label={t('agent.spawn')}
            className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-md text-xs font-medium transition-all active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
          >
            <Zap className="w-3 h-3" />
            {t('agent.spawn')}
          </button>
        ) : (
          <>
            {status === 'RUNNING' && (
              <button
                onClick={onPause}
                className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors"
                title={t('agent.pause')}
                aria-label={t('agent.pause')}
              >
                <Pause className="w-3.5 h-3.5 text-yellow-400" />
              </button>
            )}
            {status === 'PAUSED' && (
              <button
                onClick={onResume}
                className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors"
                title={t('agent.resume')}
                aria-label={t('agent.resume')}
              >
                <Play className="w-3.5 h-3.5 text-green-400" />
              </button>
            )}
            {isActive && (
              <button
                onClick={onKill}
                className="p-1.5 hover:bg-white/[0.06] rounded-md transition-colors"
                title={t('agent.kill')}
                aria-label={t('agent.kill')}
              >
                <Square className="w-3.5 h-3.5 text-red-400" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Info badges */}
      {isActive && (
        <>
          <div className="w-px h-4 bg-white/[0.06]" />

          {/* Elapsed */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.04]">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-400 font-mono">{elapsed}</span>
          </div>

          {/* Tokens */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.04]">
            <Cpu className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-400 font-mono">
              {formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)}
            </span>
          </div>

          {/* Model */}
          {model && (
            <span
              className="text-[10px] text-[var(--color-accent)] bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 px-1.5 py-0.5 rounded-md font-medium"
            >
              {model.includes('haiku') ? 'Haiku' : model.includes('sonnet') ? 'Sonnet' : model.includes('opus') ? 'Opus' : model}
            </span>
          )}
        </>
      )}
    </div>
  );
}
