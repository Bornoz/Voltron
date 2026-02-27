import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, Layout, Play, Pause, Square, Zap, Map, Eye, FileText,
  MessageSquare, Clock, BookOpen, Brain, Terminal, Settings,
  Maximize2, Globe, HelpCircle, RotateCcw,
} from 'lucide-react';
import { useWindowStore, type PanelId } from '../../stores/windowStore';
import { useAgentStore } from '../../stores/agentStore';
import { useTranslation } from '../../i18n';

interface CommandItem {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAction?: (action: string, data?: Record<string, unknown>) => void;
}

export function CommandPalette({ isOpen, onClose, onAgentAction }: CommandPaletteProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const toggleVisibility = useWindowStore((s) => s.toggleVisibility);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const applyPreset = useWindowStore((s) => s.applyPreset);
  const resetToDefault = useWindowStore((s) => s.resetToDefault);
  const panels = useWindowStore((s) => s.panels);
  const agentStatus = useAgentStore((s) => s.status);

  const isAgentActive = ['RUNNING', 'PAUSED', 'SPAWNING', 'INJECTING'].includes(agentStatus);

  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Panel toggles
    const panelEntries: Array<{ id: PanelId; label: string; icon: React.ReactNode }> = [
      { id: 'visual-editor', label: t('agent.windowManager.panelVisualEditor'), icon: <Eye className="w-4 h-4" /> },
      { id: 'gps-navigator', label: t('agent.windowManager.panelGpsNavigator'), icon: <Map className="w-4 h-4" /> },
      { id: 'agent-tracker', label: t('agent.windowManager.panelAgentTracker'), icon: <Terminal className="w-4 h-4" /> },
      { id: 'phase-viewer', label: t('agent.windowManager.panelPhaseViewer'), icon: <FileText className="w-4 h-4" /> },
      { id: 'prompt-injector', label: t('agent.windowManager.panelPromptInjector'), icon: <MessageSquare className="w-4 h-4" /> },
      { id: 'activity-timeline', label: t('agent.windowManager.panelActivityTimeline'), icon: <Clock className="w-4 h-4" /> },
      { id: 'agent-output', label: t('agent.windowManager.panelAgentOutput'), icon: <Terminal className="w-4 h-4" /> },
      { id: 'rules-editor', label: t('agent.windowManager.panelRulesEditor'), icon: <BookOpen className="w-4 h-4" /> },
      { id: 'memory-manager', label: t('agent.windowManager.panelMemoryManager'), icon: <Brain className="w-4 h-4" /> },
      { id: 'session-history', label: t('agent.windowManager.panelSessionHistory'), icon: <Clock className="w-4 h-4" /> },
    ];

    for (const p of panelEntries) {
      const visible = panels[p.id]?.visible;
      items.push({
        id: `toggle-${p.id}`,
        label: `${visible ? t('commandPalette.hide') : t('commandPalette.show')} ${p.label}`,
        category: t('commandPalette.panels'),
        icon: p.icon,
        action: () => toggleVisibility(p.id),
      });
    }

    // Panel maximize
    for (const p of panelEntries.slice(0, 5)) {
      items.push({
        id: `maximize-${p.id}`,
        label: `${t('commandPalette.maximize')} ${p.label}`,
        category: t('commandPalette.panels'),
        icon: <Maximize2 className="w-4 h-4" />,
        action: () => toggleMaximize(p.id),
      });
    }

    // Layout presets
    items.push(
      {
        id: 'preset-ide',
        label: t('commandPalette.layoutIDE'),
        category: t('commandPalette.layout'),
        icon: <Layout className="w-4 h-4" />,
        action: () => applyPreset('ide-style'),
      },
      {
        id: 'preset-gps',
        label: t('commandPalette.layoutGPS'),
        category: t('commandPalette.layout'),
        icon: <Map className="w-4 h-4" />,
        action: () => applyPreset('gps-focus'),
      },
      {
        id: 'preset-monitor',
        label: t('commandPalette.layoutMonitor'),
        category: t('commandPalette.layout'),
        icon: <Layout className="w-4 h-4" />,
        action: () => applyPreset('monitor'),
      },
      {
        id: 'preset-reset',
        label: t('commandPalette.layoutReset'),
        category: t('commandPalette.layout'),
        icon: <RotateCcw className="w-4 h-4" />,
        action: () => resetToDefault(),
      },
    );

    // Agent actions
    if (isAgentActive) {
      if (agentStatus === 'RUNNING') {
        items.push({
          id: 'agent-pause',
          label: t('agent.pause'),
          category: t('commandPalette.agent'),
          icon: <Pause className="w-4 h-4" />,
          shortcut: 'Space',
          action: () => onAgentAction?.('pause'),
        });
      }
      if (agentStatus === 'PAUSED') {
        items.push({
          id: 'agent-resume',
          label: t('agent.resume'),
          category: t('commandPalette.agent'),
          icon: <Play className="w-4 h-4" />,
          shortcut: 'Space',
          action: () => onAgentAction?.('resume'),
        });
      }
      items.push({
        id: 'agent-kill',
        label: t('agent.kill'),
        category: t('commandPalette.agent'),
        icon: <Square className="w-4 h-4" />,
        shortcut: 'Ctrl+Shift+S',
        action: () => onAgentAction?.('stop'),
      });
    } else {
      items.push({
        id: 'agent-spawn',
        label: t('agent.spawn'),
        category: t('commandPalette.agent'),
        icon: <Zap className="w-4 h-4" />,
        action: () => onAgentAction?.('spawn'),
      });
    }

    // Navigation
    items.push(
      {
        id: 'nav-shortcuts',
        label: t('commandPalette.showShortcuts'),
        category: t('commandPalette.navigation'),
        icon: <HelpCircle className="w-4 h-4" />,
        shortcut: '?',
        action: () => onAgentAction?.('showShortcuts'),
      },
      {
        id: 'nav-settings',
        label: t('commandPalette.openSettings'),
        category: t('commandPalette.navigation'),
        icon: <Settings className="w-4 h-4" />,
        action: () => onAgentAction?.('openSettings'),
      },
      {
        id: 'nav-language',
        label: t('commandPalette.switchLanguage'),
        category: t('commandPalette.navigation'),
        icon: <Globe className="w-4 h-4" />,
        action: () => onAgentAction?.('switchLanguage'),
      },
    );

    return items;
  }, [t, panels, agentStatus, isAgentActive, toggleVisibility, toggleMaximize, applyPreset, resetToDefault, onAgentAction]);

  // Filter commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
    );
  }, [query, commands]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Array<{ category: string; items: CommandItem[] }> = [];
    const seen: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (seen[item.category]) {
        seen[item.category].push(item);
      } else {
        seen[item.category] = [item];
        groups.push({ category: item.category, items: seen[item.category] });
      }
    }
    return groups;
  }, [filtered]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeSelected = useCallback(() => {
    const item = filtered[selectedIndex];
    if (item) {
      item.action();
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          executeSelected();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered.length, executeSelected, onClose],
  );

  if (!isOpen) return null;

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[300000] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-[520px] max-h-[420px] rounded-xl backdrop-blur-xl overflow-hidden flex flex-col"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-elevated)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          <kbd className="text-[9px] rounded px-1.5 py-0.5" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('commandPalette.noResults')}
            </div>
          )}

          {grouped.map((group) => (
            <div key={group.category}>
              <div className="px-4 py-1.5 text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {group.category}
              </div>
              {group.items.map((item) => {
                const idx = flatIdx++;
                return (
                  <button
                    key={item.id}
                    data-cmd-idx={idx}
                    className={`flex items-center gap-3 w-full px-4 py-2 text-left transition-colors ${
                      idx === selectedIndex
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                    style={idx !== selectedIndex ? { color: 'var(--color-text-secondary)' } : undefined}
                    onClick={() => { item.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span style={{ color: idx === selectedIndex ? 'rgb(96,165,250)' : 'var(--color-text-muted)' }}>
                      {item.icon}
                    </span>
                    <span className="flex-1 text-xs">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="text-[9px] rounded px-1.5 py-0.5" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }}>
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 text-[9px]" style={{ borderTop: '1px solid var(--glass-border)', color: 'var(--color-text-muted)' }}>
          <span className="flex items-center gap-1">
            <kbd style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }} className="rounded px-1 py-0.5">↑↓</kbd>
            {t('commandPalette.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }} className="rounded px-1 py-0.5">↵</kbd>
            {t('commandPalette.execute')}
          </span>
          <span className="flex items-center gap-1">
            <kbd style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }} className="rounded px-1 py-0.5">Esc</kbd>
            {t('commandPalette.close')}
          </span>
        </div>
      </div>
    </div>
  );
}
