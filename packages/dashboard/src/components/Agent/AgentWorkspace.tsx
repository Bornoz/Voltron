import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  CheckCircle2, XCircle, FileText, Clock, Cpu,
  Monitor, Map, Code2,
} from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useWindowStore, type WindowPreset } from '../../stores/windowStore';
import { useTranslation } from '../../i18n';
import * as api from '../../lib/api';
import { AgentControlBar } from './AgentControlBar';
import { AgentToasts } from './AgentToasts';
import { SessionExport } from './SessionExport';
import { InlineChatPopup } from './InlineChatPopup';
import { WindowManager } from './layout/WindowManager';
import { PanelMenu } from './layout/PanelMenu';
import { useAgentKeyboard } from '../../hooks/useAgentKeyboard';

interface AgentWorkspaceProps {
  projectId: string;
  onSpawn: (config?: { model?: string; prompt?: string; targetDir?: string }) => void;
  onPause: () => void;
  onResume: () => void;
  onKill: () => void;
  onInject: (prompt: string, context?: { filePath?: string; constraints?: string[] }) => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  return `${minutes}m ${remainSec}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export function AgentWorkspace({
  projectId,
  onSpawn,
  onPause,
  onResume,
  onKill,
  onInject,
}: AgentWorkspaceProps) {
  const { t } = useTranslation();
  const status = useAgentStore((s) => s.status);
  const startedAt = useAgentStore((s) => s.startedAt);
  const tokenUsage = useAgentStore((s) => s.tokenUsage);
  const breadcrumbs = useAgentStore((s) => s.breadcrumbs);
  const phaseExecution = useAgentStore((s) => s.phaseExecution);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const isActive = !['IDLE', 'COMPLETED', 'CRASHED'].includes(status);
  const isFinished = status === 'COMPLETED' || status === 'CRASHED';
  const hydrate = useAgentStore((s) => s.hydrate);

  // On mount: re-hydrate if status is IDLE but a session exists on server
  // This ensures preview works when switching back to agent tab
  useEffect(() => {
    if (status === 'IDLE') {
      api.getAgentSession(projectId).then((session) => {
        if (!session || typeof session !== 'object') return;
        const s = session as Record<string, unknown>;
        if (s.sessionId && s.status && s.status !== 'IDLE') {
          hydrate({
            sessionId: s.sessionId as string,
            status: s.status as any,
            model: (s.model as string) ?? undefined,
            startedAt: (s.startedAt as number) ?? undefined,
          });
        }
      }).catch(() => {});
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute file count from breadcrumbs
  const fileStats = useMemo(() => {
    const written = new Set<string>();
    const read = new Set<string>();
    for (const bc of breadcrumbs) {
      if (!bc.filePath) continue;
      if (bc.activity === 'WRITING') written.add(bc.filePath);
      else if (bc.activity === 'READING') read.add(bc.filePath);
    }
    return { written: written.size, read: read.size, files: Array.from(written) };
  }, [breadcrumbs]);

  const duration = useMemo(() => {
    if (!startedAt) return null;
    return Date.now() - startedAt;
  }, [startedAt, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const panels = useWindowStore((s) => s.panels);
  const toggleVisibility = useWindowStore((s) => s.toggleVisibility);
  const cyclePanel = useWindowStore((s) => s.cyclePanel);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const applyPreset = useWindowStore((s) => s.applyPreset);

  // Track active view mode
  const [viewMode, setViewMode] = useState<WindowPreset>(() => {
    // Detect current preset from localStorage settings
    try {
      const settings = JSON.parse(localStorage.getItem('voltron_user_settings') ?? '{}');
      return (settings.defaultLayout as WindowPreset) ?? 'ide-style';
    } catch { return 'ide-style'; }
  });

  const switchViewMode = useCallback((preset: WindowPreset) => {
    setViewMode(preset);
    applyPreset(preset);
    // Persist to user settings
    try {
      const settings = JSON.parse(localStorage.getItem('voltron_user_settings') ?? '{}');
      settings.defaultLayout = preset;
      localStorage.setItem('voltron_user_settings', JSON.stringify(settings));
    } catch { /* ignore */ }
  }, [applyPreset]);

  // Auto-show agent-output panel when agent becomes active
  useEffect(() => {
    if (isActive && !panels['agent-output']?.visible) {
      toggleVisibility('agent-output');
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Agent actions from GPS/Map components -- */
  const handleAgentAction = useCallback((action: string, data?: Record<string, unknown>) => {
    switch (action) {
      case 'pause':
        onPause();
        break;
      case 'stop':
        onKill();
        break;
      case 'promptInFile':
        if (data?.filePath) {
          const fp = String(data.filePath);
          onInject(`Bu dosyada calis: ${fp}`, { filePath: fp });
        }
        break;
      case 'viewOutput':
        toggleVisibility('agent-output');
        break;
      case 'redirectToFile':
        if (data?.filePath) {
          const fp = String(data.filePath);
          onInject(`Focus on this file and continue working: ${fp}`, { filePath: fp });
        }
        break;
      case 'spawnWithConfig':
        onSpawn(data as { model?: string; prompt?: string; targetDir?: string });
        break;
    }
  }, [onPause, onKill, onInject, onSpawn, toggleVisibility]);

  /* -- Keyboard shortcuts -- */
  useAgentKeyboard({
    onAction: useCallback((action) => {
      switch (action) {
        case 'gps-fullscreen':
          toggleMaximize('gps-navigator');
          break;
        case 'editor-fullscreen':
          toggleMaximize('visual-editor');
          break;
        case 'prompt-focus':
          promptRef.current?.focus();
          break;
        case 'toggle-pause':
          if (status === 'RUNNING') onPause();
          else if (status === 'PAUSED') onResume();
          break;
        case 'escape-fullscreen':
          // No-op — handled by individual panels
          break;
        case 'toggle-output':
          toggleVisibility('agent-output');
          break;
        case 'cycle-panel':
          cyclePanel();
          break;
        case 'toggle-panel-menu':
          // Handled by PanelMenu component
          break;
      }
    }, [status, onPause, onResume, toggleMaximize, toggleVisibility, cyclePanel]),
    enabled: isActive || isFinished,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toast notifications */}
      <AgentToasts />

      {/* Top: AgentControlBar + View Mode Switcher + PanelMenu + SessionExport */}
      <div className="relative z-10 px-2 py-1.5 border-b shrink-0" style={{ borderColor: 'var(--color-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2">
          <AgentControlBar
            onSpawn={onSpawn}
            onPause={onPause}
            onResume={onResume}
            onKill={onKill}
          />

          {/* ═══ View Mode Switcher — IDE / GPS / Monitor ═══ */}
          <div className="flex items-center rounded-lg p-0.5 ml-2" style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }}>
            {([
              { id: 'ide-style' as WindowPreset, icon: Code2, label: 'IDE' },
              { id: 'gps-focus' as WindowPreset, icon: Map, label: 'GPS' },
              { id: 'monitor' as WindowPreset, icon: Monitor, label: 'Monitor' },
            ]).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => switchViewMode(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  viewMode === id
                    ? 'text-[var(--color-accent)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={viewMode === id ? {
                  background: 'var(--color-bg-secondary)',
                  boxShadow: `0 0 8px color-mix(in srgb, var(--color-accent) 15%, transparent)`,
                } : undefined}
                title={label}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1" />
          <PanelMenu />
          {(isActive || isFinished) && (
            <SessionExport projectId={projectId} />
          )}
        </div>
      </div>

      {/* Completion/Crash banner */}
      {isFinished && (
        <CompletionBanner
          status={status}
          duration={duration}
          tokenUsage={tokenUsage}
          fileStats={fileStats}
        />
      )}

      {/* Floating Window Manager */}
      <WindowManager
        projectId={projectId}
        onInject={onInject}
        onAgentAction={handleAgentAction}
      />

      {/* Inline Chat Popup */}
      {(isActive || isFinished) && (
        <InlineChatPopup projectId={projectId} onInject={onInject} />
      )}
    </div>
  );
}

/* ---------- Completion Banner ---------- */

interface CompletionBannerProps {
  status: string;
  duration: number | null;
  tokenUsage: { inputTokens: number; outputTokens: number };
  fileStats: { written: number; read: number; files: string[] };
}

function CompletionBanner({ status, duration, tokenUsage, fileStats }: CompletionBannerProps) {
  const { t } = useTranslation();
  const [showFiles, setShowFiles] = useState(false);
  const isCrash = status === 'CRASHED';

  const totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;

  return (
    <div
      className={`px-3 py-2 border-b shrink-0 ${
        isCrash
          ? 'bg-red-950/40 border-red-800/50'
          : 'bg-green-950/40 border-green-800/50'
      }`}
    >
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status icon */}
        {isCrash ? (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
        )}

        <span className={`text-xs font-medium ${isCrash ? 'text-red-300' : 'text-green-300'}`}>
          {isCrash ? t('agent.agentCrashed') : t('agent.agentCompleted')}
        </span>

        {/* Stats chips */}
        <div className="flex items-center gap-2 ml-auto text-[10px] text-gray-400">
          {fileStats.written > 0 && (
            <span className="flex items-center gap-1 bg-gray-800/60 px-1.5 py-0.5 rounded">
              <FileText className="w-2.5 h-2.5" />
              {fileStats.written} {t('agent.filesCreated')}
            </span>
          )}
          {totalTokens > 0 && (
            <span className="flex items-center gap-1 bg-gray-800/60 px-1.5 py-0.5 rounded">
              <Cpu className="w-2.5 h-2.5" />
              {formatTokens(totalTokens)} token
            </span>
          )}
          {duration != null && (
            <span className="flex items-center gap-1 bg-gray-800/60 px-1.5 py-0.5 rounded">
              <Clock className="w-2.5 h-2.5" />
              {formatDuration(duration)}
            </span>
          )}
        </div>
      </div>

      {/* Expandable file list */}
      {fileStats.files.length > 0 && (
        <div className="mt-1.5">
          <button
            onClick={() => setShowFiles(!showFiles)}
            className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showFiles ? t('agent.hideFileList') : t('agent.showFileList')} ({fileStats.files.length})
          </button>
          {showFiles && (
            <div className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
              {fileStats.files.map((f) => (
                <div key={f} className="text-[10px] font-mono text-gray-500 pl-2 border-l border-gray-700">
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

