import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ChevronUp, ChevronDown, CheckCircle2, XCircle, FileText, Clock, Cpu } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';
import { AgentControlBar } from './AgentControlBar';
import { SimulatorEmbed } from './SimulatorEmbed';
import { FileNavigationMap } from './FileNavigationMap';
import { PlanViewer } from './PlanViewer';
import { PromptInjector } from './PromptInjector';
import { AgentOutput } from './AgentOutput';

interface AgentWorkspaceProps {
  projectId: string;
  onSpawn: () => void;
  onPause: () => void;
  onResume: () => void;
  onKill: () => void;
  onInject: (prompt: string, context?: { filePath?: string; constraints?: string[] }) => void;
}

const MIN_LEFT_PCT = 30;
const MAX_LEFT_PCT = 80;
const DEFAULT_LEFT_PCT = 60;

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
  const [leftPct, setLeftPct] = useState(DEFAULT_LEFT_PCT);
  const [showOutput, setShowOutput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = !['IDLE', 'COMPLETED', 'CRASHED'].includes(status);
  const isFinished = status === 'COMPLETED' || status === 'CRASHED';

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

  /* -- Drag resize -- */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.max(MIN_LEFT_PCT, Math.min(MAX_LEFT_PCT, pct)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top: AgentControlBar */}
      <div className="px-2 py-1.5 border-b border-gray-800 bg-gray-900/30">
        <AgentControlBar
          onSpawn={onSpawn}
          onPause={onPause}
          onResume={onResume}
          onKill={onKill}
        />
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

      {/* Main split area */}
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
        style={{ cursor: isDragging ? 'col-resize' : undefined }}
      >
        {/* Left: SimulatorEmbed */}
        <div className="h-full overflow-hidden p-1.5" style={{ width: `${leftPct}%` }}>
          <SimulatorEmbed projectId={projectId} onInject={onInject} />
        </div>

        {/* Vertical divider / drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-1.5 flex-shrink-0 cursor-col-resize group transition-colors ${
            isDragging ? 'bg-blue-500/40' : 'bg-gray-800 hover:bg-blue-500/30'
          }`}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div className={`w-0.5 h-8 rounded-full transition-colors ${
              isDragging ? 'bg-blue-400' : 'bg-gray-600 group-hover:bg-blue-400'
            }`} />
          </div>
        </div>

        {/* Right: FileNavigationMap + PlanViewer + PromptInjector */}
        <div
          className="h-full overflow-hidden flex flex-col gap-1.5 p-1.5"
          style={{ width: `${100 - leftPct}%` }}
        >
          {/* File Navigation Map (~45% height) */}
          <div className="flex-[45] min-h-0 overflow-hidden">
            <FileNavigationMap />
          </div>

          {/* Plan Viewer (~30% height) */}
          <div className="flex-[30] min-h-0 overflow-auto bg-gray-950 rounded-lg border border-gray-800 p-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-medium">
              {t('agent.plan')}
            </div>
            <PlanViewer />
          </div>

          {/* Prompt Injector (~25% height) */}
          {isActive && (
            <div className="flex-[25] min-h-0 overflow-auto bg-gray-950 rounded-lg border border-gray-800 p-2">
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-medium">
                {t('agent.promptInjector')}
              </div>
              <PromptInjector projectId={projectId} onInject={onInject} />
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Collapsible output drawer */}
      <div className="border-t border-gray-800">
        <button
          onClick={() => setShowOutput(!showOutput)}
          className="flex items-center gap-2 w-full px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-300 hover:bg-gray-900/50 transition-colors"
        >
          {showOutput ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
          <span className="uppercase tracking-wider font-medium">
            {showOutput ? t('agent.hideOutput') : t('agent.showOutput')}
          </span>
        </button>

        {showOutput && (
          <div className="h-64 overflow-hidden border-t border-gray-800">
            <AgentOutput />
          </div>
        )}
      </div>
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
      className={`px-3 py-2 border-b ${
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
