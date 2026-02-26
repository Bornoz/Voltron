import { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutGrid, Check, RotateCcw } from 'lucide-react';
import { useWindowStore, type PanelId, type WindowPreset } from '../../../stores/windowStore';
import { useTranslation } from '../../../i18n';

const ALL_PANELS: PanelId[] = [
  'visual-editor', 'gps-navigator', 'agent-tracker',
  'phase-viewer', 'prompt-injector', 'activity-timeline', 'agent-output',
  'rules-editor', 'memory-manager', 'session-history',
];

const PRESETS: { id: WindowPreset; labelKey: string }[] = [
  { id: 'ide-style', labelKey: 'agent.windowManager.presetIde' },
  { id: 'gps-focus', labelKey: 'agent.windowManager.presetGps' },
  { id: 'monitor', labelKey: 'agent.windowManager.presetMonitor' },
];

export function PanelMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const panels = useWindowStore((s) => s.panels);
  const toggleVisibility = useWindowStore((s) => s.toggleVisibility);
  const applyPreset = useWindowStore((s) => s.applyPreset);
  const resetToDefault = useWindowStore((s) => s.resetToDefault);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={toggle}
        className={`flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded transition-all ${
          open
            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40 border border-transparent'
        }`}
        title={t('agent.windowManager.panelMenu')}
      >
        <LayoutGrid className="w-2.5 h-2.5" />
        <span className="hidden sm:inline">{t('agent.windowManager.panelMenu')}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-gray-900/98 border border-gray-700/60 rounded-lg shadow-2xl shadow-black/60 backdrop-blur-md z-[100000] overflow-hidden">
          {/* Panel visibility */}
          <div className="px-2 py-1.5 text-[9px] text-gray-500 uppercase tracking-wider font-medium border-b border-gray-800/50">
            Panels
          </div>
          {ALL_PANELS.map((id) => {
            const p = panels[id];
            return (
              <button
                key={id}
                onClick={() => toggleVisibility(id)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800/60 transition-colors"
              >
                <span className={`w-3 h-3 flex items-center justify-center ${p.visible ? 'text-blue-400' : 'text-gray-600'}`}>
                  {p.visible && <Check className="w-3 h-3" />}
                </span>
                <span>{t(p.title as never)}</span>
              </button>
            );
          })}

          {/* Presets */}
          <div className="px-2 py-1.5 text-[9px] text-gray-500 uppercase tracking-wider font-medium border-t border-b border-gray-800/50">
            Presets
          </div>
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                applyPreset(preset.id);
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800/60 transition-colors"
            >
              <LayoutGrid className="w-3 h-3 text-gray-500" />
              <span>{t(preset.labelKey as never)}</span>
            </button>
          ))}

          {/* Reset */}
          <div className="border-t border-gray-800/50">
            <button
              onClick={() => {
                resetToDefault();
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-gray-400 hover:text-red-400 hover:bg-gray-800/60 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('agent.windowManager.resetLayout')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
