import { useEffect, useRef, useState, useCallback } from 'react';
import { ClipboardList, Power, PowerOff } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n';

interface RulesEditorProps {
  projectId: string;
}

export function RulesEditor({ projectId }: RulesEditorProps) {
  const { t } = useTranslation();
  const {
    rules, rulesActive, rulesLoading, rulesSaving, rulesLastSaved,
    loadRules, saveRules, toggleRules,
  } = useSettingsStore();

  const [localContent, setLocalContent] = useState(rules);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  // Load on mount
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      loadRules(projectId);
    }
  }, [projectId, loadRules]);

  // Sync from store when loaded
  useEffect(() => {
    setLocalContent(rules);
  }, [rules]);

  // Debounced save
  const handleChange = useCallback((value: string) => {
    setLocalContent(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveRules(projectId, value);
    }, 500);
  }, [projectId, saveRules]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const timeSince = rulesLastSaved
    ? Math.round((Date.now() - rulesLastSaved) / 60000)
    : null;

  if (rulesLoading) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-gray-500">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900/95">
      {/* Toggle bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <ClipboardList className="w-3 h-3" />
          <span>{t('agent.rules.title')}</span>
        </div>
        <button
          onClick={() => toggleRules(projectId)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            rulesActive
              ? 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60'
              : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
          }`}
          title={rulesActive ? t('agent.rules.active') : t('agent.rules.inactive')}
        >
          {rulesActive ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
          {rulesActive ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Editor */}
      <textarea
        value={localContent}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t('agent.rules.placeholder')}
        className="flex-1 w-full px-3 py-2 bg-transparent text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none resize-none font-mono leading-relaxed"
        spellCheck={false}
      />

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-gray-800 text-[10px] text-gray-500">
        <span>
          {rulesSaving
            ? t('agent.rules.saving')
            : rulesLastSaved
              ? `${t('agent.rules.saved')} ${timeSince != null && timeSince > 0 ? `${timeSince}m ${t('agent.history.ago')}` : 'just now'}`
              : t('agent.rules.noRules')}
        </span>
        <span className="text-gray-600">
          {t('agent.rules.autoSaveHint')}
        </span>
      </div>
    </div>
  );
}
