import { X } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ keys: string[]; description: string }>;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const groups: ShortcutGroup[] = [
    {
      title: t('shortcuts.global'),
      shortcuts: [
        { keys: ['Ctrl', 'K'], description: t('shortcuts.commandPalette') },
        { keys: ['?'], description: t('shortcuts.showShortcuts') },
        { keys: ['Ctrl', 'Shift', 'S'], description: t('shortcuts.emergencyStop') },
        { keys: ['Escape'], description: t('shortcuts.closeModal') },
      ],
    },
    {
      title: t('shortcuts.agent'),
      shortcuts: [
        { keys: ['Space'], description: t('shortcuts.pauseResume') },
        { keys: ['Ctrl', 'Shift', 'P'], description: t('shortcuts.focusPrompt') },
        { keys: ['Ctrl', 'Shift', 'B'], description: t('shortcuts.toggleBreakpoint') },
        { keys: ['Ctrl', 'Shift', 'O'], description: t('shortcuts.toggleOutput') },
        { keys: ['Ctrl', 'Enter'], description: t('shortcuts.sendPrompt') },
      ],
    },
    {
      title: t('shortcuts.panels'),
      shortcuts: [
        { keys: ['Ctrl', 'Shift', 'G'], description: t('shortcuts.gpsFullscreen') },
        { keys: ['Ctrl', 'Shift', 'E'], description: t('shortcuts.editorFullscreen') },
        { keys: ['Ctrl', 'Shift', 'L'], description: t('shortcuts.togglePanelMenu') },
        { keys: ['Ctrl', 'Tab'], description: t('shortcuts.cyclePanels') },
      ],
    },
    {
      title: t('shortcuts.gps'),
      shortcuts: [
        { keys: ['Ctrl', 'F'], description: t('shortcuts.searchFiles') },
        { keys: [t('shortcuts.scroll')], description: t('shortcuts.zoomInOut') },
        { keys: [t('shortcuts.middleClick')], description: t('shortcuts.panAlways') },
        { keys: [t('shortcuts.handTool')], description: t('shortcuts.panMode') },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[300000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[560px] max-h-[80vh] rounded-xl backdrop-blur-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-elevated)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('shortcuts.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-[var(--color-bg-tertiary)]">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, ki) => (
                        <span key={ki}>
                          {ki > 0 && <span className="mx-0.5" style={{ color: 'var(--color-text-muted)' }}>+</span>}
                          <kbd className="inline-block min-w-[24px] text-center text-[10px] rounded px-1.5 py-0.5 font-mono" style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }}>
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 text-[9px] text-center" style={{ borderTop: '1px solid var(--glass-border)', color: 'var(--color-text-muted)' }}>
          {t('shortcuts.footer')}
        </div>
      </div>
    </div>
  );
}
