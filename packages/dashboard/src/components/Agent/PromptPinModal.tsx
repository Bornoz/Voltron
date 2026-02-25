import { useState, useRef, useEffect } from 'react';
import { MapPin, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface PromptPinModalProps {
  x: number;
  y: number;
  pageX: number;
  pageY: number;
  nearestSelector: string;
  nearestElementDesc: string;
  initialPrompt?: string;
  isEdit?: boolean;
  onSave: (prompt: string) => void;
  onCancel: () => void;
}

export function PromptPinModal({
  x: _x, y: _y, pageX, pageY,
  nearestSelector, nearestElementDesc,
  initialPrompt = '',
  isEdit = false,
  onSave, onCancel,
}: PromptPinModalProps) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(initialPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleSave = () => {
    if (!prompt.trim()) return;
    onSave(prompt.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-[420px] bg-gray-950/95 border border-gray-700/60 rounded-xl shadow-2xl shadow-blue-500/10 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/60">
          <MapPin className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">
            {isEdit ? t('agent.promptPin.editTitle') : t('agent.promptPin.title')}
          </span>
          <div className="flex-1" />
          <button onClick={onCancel} className="p-1 hover:bg-gray-800 rounded transition-colors">
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        {/* Coordinate info */}
        <div className="px-4 py-2 bg-gray-900/50 border-b border-gray-800/40">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-gray-500">
              {t('agent.promptPin.coordinate')}: <span className="text-blue-400 font-mono">({Math.round(pageX)}, {Math.round(pageY)})</span>
            </span>
            {nearestSelector && (
              <span className="text-gray-500">
                {t('agent.promptPin.nearElement')}: <span className="text-cyan-400 font-mono truncate max-w-[200px] inline-block align-bottom">{nearestSelector}</span>
              </span>
            )}
          </div>
          {nearestElementDesc && (
            <div className="text-[9px] text-gray-600 mt-0.5 font-mono">{nearestElementDesc}</div>
          )}
        </div>

        {/* Textarea */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('agent.promptPin.placeholder')}
            className="w-full h-32 px-3 py-2 bg-gray-900/80 border border-gray-700/50 rounded-lg text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 resize-none transition-all"
          />
          <div className="text-[9px] text-gray-600 mt-1 text-right">
            {t('agent.promptPin.ctrlEnter')}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-800/40">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('agent.promptPin.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!prompt.trim()}
            className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg shadow-lg shadow-blue-600/20 transition-all"
          >
            {t('agent.promptPin.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
