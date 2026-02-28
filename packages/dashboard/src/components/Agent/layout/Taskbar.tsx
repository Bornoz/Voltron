import { useState } from 'react';
import {
  Monitor, Map, Radio, ListChecks, MessageSquare, Activity, Terminal,
  ClipboardList, Brain, History, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useWindowStore, type PanelId } from '../../../stores/windowStore';

/* ─── Panel Categories ─── */

interface PanelEntry {
  id: PanelId;
  icon: React.ReactNode;
  label: string;
}

interface PanelCategory {
  name: string;
  panels: PanelEntry[];
}

const CATEGORIES: PanelCategory[] = [
  {
    name: 'Workspace',
    panels: [
      { id: 'visual-editor', icon: <Monitor className="w-3.5 h-3.5" />, label: 'Editor' },
      { id: 'gps-navigator', icon: <Map className="w-3.5 h-3.5" />, label: 'GPS' },
    ],
  },
  {
    name: 'Agent',
    panels: [
      { id: 'agent-tracker', icon: <Radio className="w-3.5 h-3.5" />, label: 'Tracker' },
      { id: 'phase-viewer', icon: <ListChecks className="w-3.5 h-3.5" />, label: 'Plan' },
      { id: 'agent-output', icon: <Terminal className="w-3.5 h-3.5" />, label: 'Output' },
    ],
  },
  {
    name: 'Tools',
    panels: [
      { id: 'prompt-injector', icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Inject' },
      { id: 'activity-timeline', icon: <Activity className="w-3.5 h-3.5" />, label: 'Timeline' },
      { id: 'rules-editor', icon: <ClipboardList className="w-3.5 h-3.5" />, label: 'Rules' },
      { id: 'memory-manager', icon: <Brain className="w-3.5 h-3.5" />, label: 'Memory' },
      { id: 'session-history', icon: <History className="w-3.5 h-3.5" />, label: 'History' },
    ],
  },
];

/* ─── PanelDock Component ─── */

export function Taskbar() {
  const panels = useWindowStore((s) => s.panels);
  const toggleVisibility = useWindowStore((s) => s.toggleVisibility);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const [collapsed, setCollapsed] = useState(false);

  const handleClick = (id: PanelId) => {
    const panel = panels[id];
    if (!panel) return;

    if (!panel.visible) {
      // Open panel
      toggleVisibility(id);
      bringToFront(id);
    } else if (panel.minimized) {
      // Restore minimized panel
      toggleMinimize(id);
      bringToFront(id);
    } else {
      // Close panel
      toggleVisibility(id);
    }
  };

  const openCount = Object.values(panels).filter((p) => p.visible && !p.minimized).length;

  return (
    <div
      className="absolute top-0 right-0 bottom-0 z-[99998] flex flex-col"
      style={{
        width: collapsed ? 12 : 40,
        background: 'var(--color-bg-secondary)',
        borderLeft: '1px solid var(--glass-border)',
        transition: 'width 0.2s ease',
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-2 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        title={collapsed ? 'Panelleri göster' : 'Dock\'u gizle'}
      >
        {collapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {!collapsed && (
        <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          {CATEGORIES.map((cat, ci) => (
            <div key={cat.name}>
              {/* Category separator */}
              {ci > 0 && (
                <div className="mx-2 my-1" style={{ borderTop: '1px solid var(--glass-border)' }} />
              )}

              {/* Category label */}
              <div
                className="px-1 py-0.5 text-center select-none"
                style={{ fontSize: '7px', color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
              >
                {cat.name}
              </div>

              {/* Panel buttons */}
              {cat.panels.map((entry) => {
                const panel = panels[entry.id];
                const isOpen = panel?.visible && !panel.minimized;
                const isMinimized = panel?.visible && panel.minimized;

                return (
                  <button
                    key={entry.id}
                    onClick={() => handleClick(entry.id)}
                    className="group relative flex flex-col items-center justify-center w-full py-1.5 transition-all"
                    style={{
                      color: isOpen
                        ? 'var(--color-accent)'
                        : isMinimized
                          ? 'var(--color-warning)'
                          : 'var(--color-text-muted)',
                      background: isOpen ? 'var(--color-bg-tertiary)' : 'transparent',
                    }}
                    title={`${entry.label}${isOpen ? ' (açık)' : isMinimized ? ' (küçültülmüş)' : ''}`}
                  >
                    {/* Active indicator bar */}
                    {isOpen && (
                      <div
                        className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r"
                        style={{ background: 'var(--color-accent)' }}
                      />
                    )}

                    {entry.icon}

                    <span
                      className="mt-0.5 leading-none select-none"
                      style={{ fontSize: '7px' }}
                    >
                      {entry.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Open panel count badge */}
      {!collapsed && openCount > 0 && (
        <div
          className="flex items-center justify-center py-1.5 text-center select-none"
          style={{ fontSize: '8px', color: 'var(--color-text-muted)', borderTop: '1px solid var(--glass-border)' }}
        >
          {openCount}
        </div>
      )}
    </div>
  );
}
