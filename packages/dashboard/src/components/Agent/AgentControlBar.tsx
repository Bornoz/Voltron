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
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/50 border border-gray-800 rounded-lg">
      {/* Status badge */}
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[status]}`} />
        <span className={`text-[10px] font-semibold uppercase ${STATUS_TEXT_COLORS[status]}`}>
          {t(`agent.status.${status.toLowerCase()}`)}
        </span>
      </div>

      <div className="w-px h-4 bg-gray-700" />

      {/* Control buttons */}
      <div className="flex items-center gap-1">
        {status === 'IDLE' || status === 'COMPLETED' || status === 'CRASHED' ? (
          <button
            onClick={onSpawn}
            className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-medium transition-colors"
          >
            <Zap className="w-3 h-3" />
            {t('agent.spawn')}
          </button>
        ) : (
          <>
            {status === 'RUNNING' && (
              <button
                onClick={onPause}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title={t('agent.pause')}
              >
                <Pause className="w-3.5 h-3.5 text-yellow-400" />
              </button>
            )}
            {status === 'PAUSED' && (
              <button
                onClick={onResume}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title={t('agent.resume')}
              >
                <Play className="w-3.5 h-3.5 text-green-400" />
              </button>
            )}
            {isActive && (
              <button
                onClick={onKill}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                title={t('agent.kill')}
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
          <div className="w-px h-4 bg-gray-700" />

          {/* Elapsed */}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-400 font-mono">{elapsed}</span>
          </div>

          {/* Tokens */}
          <div className="flex items-center gap-1">
            <Cpu className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] text-gray-400 font-mono">
              {formatTokens(tokenUsage.inputTokens + tokenUsage.outputTokens)}
            </span>
          </div>

          {/* Model */}
          {model && (
            <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">
              {model.includes('haiku') ? 'Haiku' : model.includes('sonnet') ? 'Sonnet' : model}
            </span>
          )}
        </>
      )}
    </div>
  );
}
