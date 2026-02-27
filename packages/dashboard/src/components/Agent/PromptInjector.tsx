import { useState } from 'react';
import { Send, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

interface PromptInjectorProps {
  projectId: string;
  onInject: (prompt: string, context?: { filePath?: string; constraints?: string[] }) => void;
}

const QUICK_ACTIONS = [
  { labelKey: 'agent.quickUseTailwind', prompt: 'Use Tailwind CSS for all styling. Do not use inline styles.' },
  { labelKey: 'agent.quickFollowPatterns', prompt: 'Follow existing project patterns and conventions strictly.' },
  { labelKey: 'agent.quickAddTypeScript', prompt: 'Ensure all code is properly typed with TypeScript. No any types.' },
  { labelKey: 'agent.quickResponsive', prompt: 'Make the design fully responsive (mobile-first approach).' },
];

export function PromptInjector({ projectId, onInject }: PromptInjectorProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [includeConstraints, setIncludeConstraints] = useState(true);
  const location = useAgentStore((s) => s.location);
  const status = useAgentStore((s) => s.status);

  const canInject = ['RUNNING', 'PAUSED', 'COMPLETED', 'CRASHED'].includes(status) && prompt.trim().length > 0;

  const handleInject = () => {
    if (!canInject) return;
    onInject(prompt.trim(), {
      filePath: location?.filePath,
      constraints: includeConstraints ? undefined : [],
    });
    setPrompt('');
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    setPrompt(action.prompt);
  };

  return (
    <div className="space-y-2">
      {/* Current location context */}
      {location && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded text-[10px]">
          <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="text-gray-500">{t('agent.context')}:</span>
          <span className="text-gray-300 font-mono truncate">{location.filePath}</span>
          {location.lineRange && (
            <span className="text-gray-600">L{location.lineRange.start}-{location.lineRange.end}</span>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.labelKey}
            onClick={() => handleQuickAction(action)}
            className="px-2 py-0.5 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded border border-gray-700 transition-colors"
          >
            {t(action.labelKey)}
          </button>
        ))}
      </div>

      {/* Prompt textarea */}
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('agent.injectPlaceholder')}
          rows={3}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 resize-none pr-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleInject();
          }}
        />
        <button
          onClick={handleInject}
          disabled={!canInject}
          className="absolute right-2 bottom-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded transition-colors"
          title={`${t('agent.inject')} (Ctrl+Enter)`}
        >
          <Send className="w-3 h-3" />
        </button>
      </div>

      {/* Include constraints checkbox */}
      <label className="flex items-center gap-2 text-[10px] text-gray-500 cursor-pointer">
        <input
          type="checkbox"
          checked={includeConstraints}
          onChange={(e) => setIncludeConstraints(e.target.checked)}
          className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
        />
        {t('agent.includeConstraints')}
      </label>
    </div>
  );
}
