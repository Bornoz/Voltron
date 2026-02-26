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
    <div className="absolute bottom-0 left-0 right-0 z-[99998] flex items-center gap-1 px-2 py-1 bg-gray-950/90 border-t border-gray-800/50 backdrop-blur-sm">
      {minimizedPanels.map((p) => (
        <button
          key={p.id}
          onClick={() => {
            toggleMinimize(p.id);
            bringToFront(p.id);
          }}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 rounded transition-all"
        >
          {PANEL_ICONS[p.id]}
          <span>{SHORT_NAMES[p.id]}</span>
        </button>
      ))}
    </div>
  );
}
