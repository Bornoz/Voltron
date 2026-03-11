import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Send, Zap, ImagePlus, Paperclip, ChevronUp, FileText } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useWindowStore } from '../../stores/windowStore';
import { useTranslation } from '../../i18n';

interface QuickPromptBarProps {
  projectId: string | null;
  onSpawn: (config?: { prompt?: string }) => void;
  onInject: (prompt: string) => void;
}

export function QuickPromptBar({ projectId, onSpawn, onInject }: QuickPromptBarProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const agentStatus = useAgentStore((s) => s.status);
  const location = useAgentStore((s) => s.location);
  const activePanel = useWindowStore((s) => s.activePanel);

  const isAgentRunning = ['RUNNING', 'PAUSED', 'INJECTING'].includes(agentStatus);
  const canSubmit = prompt.trim().length > 0 && projectId;

  const fileName = location?.filePath?.split('/').pop() ?? null;

  const quickActions = useMemo(() => {
    // PAUSED state
    if (agentStatus === 'PAUSED') {
      return [
        { label: t('agent.continueCurrent'), prompt: 'Continue with the current task where you left off.' },
        { label: t('agent.switchTask'), prompt: 'Stop the current task. I want you to work on something else.' },
        { label: t('agent.reviewChanges'), prompt: 'Review all changes made so far. Summarize what was done and check for issues.' },
      ];
    }

    // RUNNING with visual-editor active and file context
    if (agentStatus === 'RUNNING' && activePanel === 'visual-editor' && location?.filePath) {
      const fp = location.filePath;
      return [
        { label: t('agent.fixThisFile'), prompt: `Fix bugs in ${fp}: review the code and fix any issues.` },
        { label: t('agent.testThis'), prompt: `Add comprehensive tests for ${fp}. Cover edge cases and aim for high coverage.` },
        { label: t('agent.refactorThis'), prompt: `Refactor ${fp}: improve readability, extract helpers, reduce complexity.` },
        { label: t('agent.improveStyle'), prompt: `Improve the styling in ${fp}: better spacing, animations, responsive design.` },
      ];
    }

    // Default / IDLE
    return [
      { label: 'Fix bugs', prompt: 'Analyze the codebase, find bugs, and fix them. Run tests to verify.' },
      { label: 'Add tests', prompt: 'Add comprehensive unit tests for uncovered code. Aim for 80%+ coverage.' },
      { label: 'Refactor', prompt: 'Refactor the codebase for better readability and maintainability.' },
      { label: 'UI polish', prompt: 'Improve the UI: add animations, fix spacing, ensure responsive design.' },
    ];
  }, [agentStatus, activePanel, location?.filePath, t]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const trimmed = prompt.trim();

    // Show submission feedback
    const feedbackText = isAgentRunning ? t('agent.injecting') : t('agent.spawning');
    setFeedback(feedbackText);

    if (isAgentRunning) {
      onInject(trimmed);
    } else {
      onSpawn({ prompt: trimmed });
    }
    setPrompt('');
    setExpanded(false);
  }, [canSubmit, prompt, isAgentRunning, onInject, onSpawn, t]);

  // Clear feedback after 800ms
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 800);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <div className="relative">
      {/* File context badge */}
      {location?.filePath && (
        <div className="flex items-center gap-1.5 px-3 py-1 text-[10px] text-slate-500 border-b border-white/[0.04]">
          <FileText size={10} />
          <span className="font-mono truncate">{location.filePath.split('/').pop()}</span>
        </div>
      )}

      {/* Quick action chips — shown when expanded and empty */}
      {expanded && !prompt && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-white/[0.04]">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => setPrompt(action.prompt)}
              className="px-2.5 py-1 text-[11px] rounded-full transition-all
                bg-white/[0.04] border border-white/[0.08] text-gray-400
                hover:bg-white/[0.08] hover:text-gray-200 hover:border-white/[0.15]"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Main input bar */}
      <div className="flex items-end gap-2 px-3 py-2.5" style={{ background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--glass-border)' }}>
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-md transition-colors shrink-0 mb-0.5"
          style={{ color: 'var(--color-text-muted)' }}
          title={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronUp className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setExpanded(true)}
            placeholder={isAgentRunning ? t('agent.injectPlaceholder') : t('agent.promptPlaceholder')}
            rows={expanded ? 3 : 1}
            className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-gray-200
              placeholder:text-gray-600 focus:outline-none focus:border-[var(--color-accent)]/40
              focus:ring-1 focus:ring-[var(--color-accent)]/15 resize-none transition-all"
            style={{ minHeight: expanded ? '72px' : '36px' }}
          />
          {/* Ctrl+Enter hint */}
          {prompt && (
            <span className="absolute bottom-1.5 right-2 text-[9px] text-gray-600 pointer-events-none">
              Ctrl+Enter
            </span>
          )}
        </div>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all
            active:scale-[0.97] shrink-0 mb-0.5 ${
            canSubmit
              ? isAgentRunning
                ? 'bg-gradient-to-b from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                : 'bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          }`}
        >
          {feedback ? (
            <span className={`text-[11px] animate-pulse ${isAgentRunning ? 'text-purple-200' : 'text-blue-200'}`}>
              {feedback}
            </span>
          ) : isAgentRunning ? (
            <>
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('agent.inject')}</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('agent.spawn')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
