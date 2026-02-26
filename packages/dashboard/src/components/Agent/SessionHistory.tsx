import { useEffect, useRef, useState } from 'react';
import { History, Play, Eye, Copy, Check, FileText, Coins, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n';
import type { AgentSessionInfo } from '../../lib/api';

interface SessionHistoryProps {
  projectId: string;
  onRerun?: (config: { model: string; prompt: string; targetDir: string }) => void;
}

function formatDuration(startMs: number, endMs: number | null): string {
  const ms = (endMs ?? Date.now()) - startMs;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}K`;
}

function statusIcon(status: string): string {
  switch (status) {
    case 'COMPLETED': return '\u2705';
    case 'CRASHED': return '\u274C';
    case 'RUNNING': return '\u25B6\uFE0F';
    case 'PAUSED': return '\u23F8\uFE0F';
    default: return '\u23F9\uFE0F';
  }
}

function modelShort(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model.slice(0, 12);
}

export function SessionHistory({ projectId, onRerun }: SessionHistoryProps) {
  const { t } = useTranslation();
  const { sessions, sessionsLoading, loadSessions } = useSettingsStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadSessions(projectId);
    }
  }, [projectId, loadSessions]);

  const handleCopy = async (session: AgentSessionInfo) => {
    await navigator.clipboard.writeText(session.prompt);
    setCopiedId(session.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRerun = (session: AgentSessionInfo) => {
    onRerun?.({ model: session.model, prompt: session.prompt, targetDir: session.targetDir });
  };

  if (sessionsLoading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900/95">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <History className="w-3 h-3" />
          <span>{t('agent.history.title')}</span>
          <span className="text-gray-600">({sessions.length})</span>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-gray-600">
            {t('agent.history.noSessions')}
          </div>
        )}

        {sessions.map((session) => {
          const isExpanded = expandedId === session.id;
          const totalTokens = session.inputTokens + session.outputTokens;

          return (
            <div
              key={session.id}
              className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors"
            >
              {/* Compact card */}
              <div className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-shrink-0">
                    <span>{statusIcon(session.status)}</span>
                    <span>{formatTimeAgo(session.startedAt)}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400 font-medium">{modelShort(session.model)}</span>
                    <span className="text-gray-600">|</span>
                    <span>{formatDuration(session.startedAt, session.completedAt)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                  {session.prompt}
                </p>

                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    <span className="flex items-center gap-0.5">
                      <Coins className="w-3 h-3" />
                      {formatTokens(totalTokens)}
                    </span>
                    {session.injectionCount > 0 && (
                      <span className="flex items-center gap-0.5">
                        <FileText className="w-3 h-3" />
                        {session.injectionCount} inj
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => handleRerun(session)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-blue-400 hover:bg-blue-900/30 rounded transition-colors"
                      title={t('agent.history.rerun')}
                    >
                      <Play className="w-3 h-3" />
                      {t('agent.history.rerun')}
                    </button>
                    <button
                      onClick={() => handleCopy(session)}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title={t('agent.history.copyPrompt')}
                    >
                      {copiedId === session.id
                        ? <Check className="w-3 h-3 text-emerald-400" />
                        : <Copy className="w-3 h-3 text-gray-500" />}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : session.id)}
                      className="p-1 hover:bg-gray-700 rounded transition-colors"
                      title={t('agent.history.viewDetails')}
                    >
                      {isExpanded
                        ? <ChevronUp className="w-3 h-3 text-gray-500" />
                        : <ChevronDown className="w-3 h-3 text-gray-500" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-3 pb-2 space-y-2">
                  <div className="bg-gray-800/50 rounded p-2">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('agent.prompt')}</div>
                    <p className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                      {session.prompt}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-gray-800/30 rounded p-1.5">
                      <span className="text-gray-500">{t('agent.model')}:</span>
                      <span className="text-gray-300 ml-1">{session.model}</span>
                    </div>
                    <div className="bg-gray-800/30 rounded p-1.5">
                      <span className="text-gray-500">{t('agent.targetDir')}:</span>
                      <span className="text-gray-300 ml-1 font-mono">{session.targetDir}</span>
                    </div>
                    <div className="bg-gray-800/30 rounded p-1.5">
                      <span className="text-gray-500">Input:</span>
                      <span className="text-gray-300 ml-1">{formatTokens(session.inputTokens)}</span>
                    </div>
                    <div className="bg-gray-800/30 rounded p-1.5">
                      <span className="text-gray-500">Output:</span>
                      <span className="text-gray-300 ml-1">{formatTokens(session.outputTokens)}</span>
                    </div>
                  </div>

                  {session.lastError && (
                    <div className="bg-red-900/20 border border-red-900/30 rounded p-2">
                      <span className="text-[10px] text-red-400">{session.lastError}</span>
                    </div>
                  )}

                  <button
                    onClick={() => handleRerun(session)}
                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded text-[10px] font-medium transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    {t('agent.history.spawnWithSame')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
