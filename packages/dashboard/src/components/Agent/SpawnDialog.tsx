import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, X, Zap, ClipboardList, Brain } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useSettingsStore, useUserDefaultModel } from '../../stores/settingsStore';
import { QuickSpawnPresets } from './QuickSpawnPresets';
import type { PresetConfig } from './QuickSpawnPresets';

interface SpawnDialogProps {
  projectId: string;
  defaultConfig?: { model?: string; prompt?: string; targetDir?: string };
  onSpawn: (config: { model: string; prompt: string; targetDir: string }) => void;
  onClose: () => void;
}

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', descKey: 'agent.modelDescHaiku' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', descKey: 'agent.modelDescSonnet' },
  { id: 'claude-opus-4-6', label: 'Opus 4.6', descKey: 'agent.modelDescOpus' },
];

export function SpawnDialog({ projectId, defaultConfig, onSpawn, onClose }: SpawnDialogProps) {
  const { t } = useTranslation();
  const userDefaultModel = useUserDefaultModel();
  const [prompt, setPrompt] = useState(defaultConfig?.prompt ?? '');
  const [model, setModel] = useState(defaultConfig?.model ?? userDefaultModel);
  const [targetDir, setTargetDir] = useState(defaultConfig?.targetDir ?? '/tmp/voltron-project');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Rules & memory preview
  const { rules, rulesActive, memories, loadRules, loadMemories } = useSettingsStore();
  const pinnedCount = memories.filter((m) => m.pinned).length;
  const rulesLineCount = rules ? rules.split('\n').filter((l) => l.trim()).length : 0;
  const hasActiveRules = rulesActive && rulesLineCount > 0;

  useEffect(() => {
    loadRules(projectId);
    loadMemories(projectId);
  }, [projectId, loadRules, loadMemories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSpawn({ model, prompt: prompt.trim(), targetDir });
  };

  // Focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200000] flex items-center justify-center" onClick={onClose} role="dialog" aria-modal="true" aria-label={t('agent.spawnAgent')}>
      <div ref={dialogRef} className="glass rounded-xl w-full max-w-lg mx-4 animate-fade-in-up" style={{ boxShadow: 'var(--shadow-elevated)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-sm text-gray-200">{t('agent.spawnAgent')}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Rules/Memory banner */}
          {(hasActiveRules || pinnedCount > 0) && (
            <div className="flex flex-col gap-1">
              {hasActiveRules && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-900/20 border border-emerald-900/30 rounded-lg text-[10px] text-emerald-400">
                  <ClipboardList className="w-3 h-3 flex-shrink-0" />
                  <span>{t('agent.rules.rulesWillBePrepended')} ({rulesLineCount} lines)</span>
                </div>
              )}
              {pinnedCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-900/20 border border-blue-900/30 rounded-lg text-[10px] text-blue-400">
                  <Brain className="w-3 h-3 flex-shrink-0" />
                  <span>{pinnedCount} {t('agent.memory.pinnedWillBeIncluded')}</span>
                </div>
              )}
            </div>
          )}

          {/* Quick Presets */}
          {!prompt.trim() && (
            <QuickSpawnPresets onSelect={(config: PresetConfig) => {
              setPrompt(config.prompt);
              setModel(config.model);
            }} />
          )}

          {/* Prompt */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('agent.prompt')}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('agent.promptPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 resize-none transition-all"
              autoFocus
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('agent.model')}</label>
            <div className="flex gap-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-all ${
                    model === m.id
                      ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40 text-[var(--color-accent)] shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_15%,transparent)]'
                      : 'bg-white/[0.03] border-white/[0.06] text-gray-400 hover:border-white/[0.12]'
                  }`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{t(m.descKey)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Directory */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('agent.targetDir')}</label>
            <input
              type="text"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              className="w-full px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-sm text-gray-200 font-mono focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              {t('common.close')}
            </button>
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:from-gray-700 disabled:to-gray-700 disabled:text-gray-500 text-white rounded-lg text-xs font-medium transition-all active:scale-[0.98] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
            >
              <Zap className="w-3.5 h-3.5" />
              {t('agent.spawn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
