import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, CheckCircle2, Circle, Play, Bot, Shield, Paintbrush, Sparkles, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface ChecklistItem {
  id: string;
  icon: typeof Bot;
  label: string;
  description: string;
  color: string;
  action?: () => void;
  actionLabel?: string;
}

const STORAGE_KEY = 'voltron_onboarding_state';
const DISMISSED_KEY = 'voltron_onboarding_dismissed';

interface GettingStartedProps {
  onTryDemo: () => void;
  onSpawnAgent: () => void;
  onOpenSettings: () => void;
  hasEvents: boolean;
  agentEverRun: boolean;
}

export function GettingStarted({ onTryDemo, onSpawnAgent, onOpenSettings, hasEvents, agentEverRun }: GettingStartedProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISSED_KEY) === 'true'; } catch { return false; }
  });
  const [completedItems, setCompletedItems] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Auto-complete items based on state
  useEffect(() => {
    const newCompleted = new Set(completedItems);
    if (hasEvents && !newCompleted.has('demo')) {
      newCompleted.add('demo');
    }
    if (agentEverRun && !newCompleted.has('agent')) {
      newCompleted.add('agent');
    }
    if (newCompleted.size !== completedItems.size) {
      setCompletedItems(newCompleted);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...newCompleted])); } catch {}
    }
  }, [hasEvents, agentEverRun, completedItems]);

  const markComplete = useCallback((id: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(DISMISSED_KEY, 'true'); } catch {}
  }, []);

  if (dismissed) return null;

  const items: ChecklistItem[] = [
    {
      id: 'demo',
      icon: Play,
      label: t('gettingStarted.tryDemo'),
      description: t('gettingStarted.tryDemoDesc'),
      color: 'text-purple-400',
      action: onTryDemo,
      actionLabel: t('gettingStarted.startDemo'),
    },
    {
      id: 'agent',
      icon: Bot,
      label: t('gettingStarted.spawnAgent'),
      description: t('gettingStarted.spawnAgentDesc'),
      color: 'text-blue-400',
      action: onSpawnAgent,
      actionLabel: t('gettingStarted.spawnAgentBtn'),
    },
    {
      id: 'zones',
      icon: Shield,
      label: t('gettingStarted.setupZones'),
      description: t('gettingStarted.setupZonesDesc'),
      color: 'text-red-400',
    },
    {
      id: 'customize',
      icon: Paintbrush,
      label: t('gettingStarted.customize'),
      description: t('gettingStarted.customizeDesc'),
      color: 'text-amber-400',
      action: onOpenSettings,
      actionLabel: t('gettingStarted.openSettings'),
    },
  ];

  const completedCount = items.filter(i => completedItems.has(i.id)).length;
  const allDone = completedCount === items.length;
  const progressPercent = (completedCount / items.length) * 100;

  // Auto-dismiss when all done
  if (allDone) return null;

  return (
    <div className="mx-2 mb-2 rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--glass-border)' }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-gray-200">{t('gettingStarted.title')}</span>
          <span className="text-[10px] text-gray-500 ml-2">{completedCount}/{items.length}</span>
        </div>
        {/* Progress bar */}
        <div className="w-16 h-1.5 rounded-full bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
        <button
          onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
          className="p-1 rounded hover:bg-white/[0.05] text-gray-600 hover:text-gray-400 transition-colors"
          title={t('gettingStarted.dismiss')}
        >
          <X className="w-3 h-3" />
        </button>
      </button>

      {/* Checklist */}
      {!collapsed && (
        <div className="px-4 pb-3 space-y-1">
          {items.map((item) => {
            const done = completedItems.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  done ? 'opacity-50' : 'hover:bg-white/[0.03]'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className={`w-4 h-4 ${item.color} shrink-0 mt-0.5`} />
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${done ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{item.description}</div>
                </div>
                {!done && item.action && (
                  <button
                    onClick={() => {
                      item.action?.();
                      markComplete(item.id);
                    }}
                    className="px-2.5 py-1 text-[10px] font-medium rounded-md transition-all shrink-0
                      bg-white/[0.05] border border-white/[0.08] text-gray-300 hover:bg-white/[0.08] hover:text-white"
                  >
                    {item.actionLabel}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
