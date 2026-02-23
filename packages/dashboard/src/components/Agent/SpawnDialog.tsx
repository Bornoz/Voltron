import { useState } from 'react';
import { Bot, X, Zap } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface SpawnDialogProps {
  projectId: string;
  onSpawn: (config: { model: string; prompt: string; targetDir: string }) => void;
  onClose: () => void;
}

const MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', description: 'Hizli, ekonomik' },
  { id: 'claude-sonnet-4-5-20250514', label: 'Sonnet 4.5', description: 'Dengeli, gucluu' },
];

export function SpawnDialog({ projectId, onSpawn, onClose }: SpawnDialogProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(MODELS[0].id);
  const [targetDir, setTargetDir] = useState('/tmp/voltron-project');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSpawn({ model, prompt: prompt.trim(), targetDir });
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            <span className="font-semibold text-sm text-gray-200">{t('agent.spawnAgent')}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Prompt */}
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('agent.prompt')}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('agent.promptPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 resize-none"
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
                  className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${
                    model === m.id
                      ? 'bg-blue-900/30 border-blue-600 text-blue-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{m.description}</div>
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
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500"
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
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-xs font-medium transition-colors"
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
