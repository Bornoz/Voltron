import {
  Monitor, Map, Radio, ListChecks, MessageSquare, Activity, Terminal,
  ClipboardList, Brain, History,
} from 'lucide-react';
import { useWindowStore, type PanelId } from '../../../stores/windowStore';
import { useTranslation } from '../../../i18n';

const PANEL_ICONS: Record<PanelId, React.ReactNode> = {
  'visual-editor': <Monitor className="w-3 h-3" />,
  'gps-navigator': <Map className="w-3 h-3" />,
  'agent-tracker': <Radio className="w-3 h-3" />,
  'phase-viewer': <ListChecks className="w-3 h-3" />,
  'prompt-injector': <MessageSquare className="w-3 h-3" />,
  'activity-timeline': <Activity className="w-3 h-3" />,
  'agent-output': <Terminal className="w-3 h-3" />,
  'rules-editor': <ClipboardList className="w-3 h-3" />,
  'memory-manager': <Brain className="w-3 h-3" />,
  'session-history': <History className="w-3 h-3" />,
};

const SHORT_NAMES: Record<PanelId, string> = {
  'visual-editor': 'Editor',
  'gps-navigator': 'GPS',
  'agent-tracker': 'Tracker',
  'phase-viewer': 'Phases',
  'prompt-injector': 'Inject',
  'activity-timeline': 'Timeline',
  'agent-output': 'Output',
  'rules-editor': 'Rules',
  'memory-manager': 'Memory',
  'session-history': 'History',
};

export function Taskbar() {
  const panels = useWindowStore((s) => s.panels);
  const toggleMinimize = useWindowStore((s) => s.toggleMinimize);
  const bringToFront = useWindowStore((s) => s.bringToFront);
  const { t: _t } = useTranslation();

  const minimizedPanels = Object.values(panels).filter((p) => p.visible && p.minimized);

  if (minimizedPanels.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[99998] flex items-center gap-1 px-2 py-1 backdrop-blur-sm" style={{ background: 'var(--glass-bg)', borderTop: '1px solid var(--glass-border)' }}>
      {minimizedPanels.map((p) => (
        <button
          key={p.id}
          onClick={() => {
            toggleMinimize(p.id);
            bringToFront(p.id);
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-all"
          style={{ color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)' }}
        >
          {PANEL_ICONS[p.id]}
          <span>{SHORT_NAMES[p.id]}</span>
        </button>
      ))}
    </div>
  );
}
