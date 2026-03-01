import { useState, useEffect } from 'react';
import { FileText, GitBranch, Bot, Sparkles, MoreHorizontal, GitCommit, Brain, BookOpen, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';

type TabId = 'feed' | 'github' | 'agent' | 'smart-setup' | 'snapshots' | 'behavior' | 'prompts';

interface MobileBottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  agentActive?: boolean;
}

const primaryTabs: { id: TabId; iconKey: string }[] = [
  { id: 'feed', iconKey: 'feed' },
  { id: 'github', iconKey: 'github' },
  { id: 'agent', iconKey: 'agent' },
  { id: 'smart-setup', iconKey: 'setup' },
];

const moreTabs: { id: TabId; iconKey: string }[] = [
  { id: 'snapshots', iconKey: 'snapshots' },
  { id: 'behavior', iconKey: 'behavior' },
  { id: 'prompts', iconKey: 'prompts' },
];

function TabIcon({ id, className }: { id: TabId; className?: string }) {
  switch (id) {
    case 'feed': return <FileText className={className} />;
    case 'github': return <GitBranch className={className} />;
    case 'agent': return <Bot className={className} />;
    case 'smart-setup': return <Sparkles className={className} />;
    case 'snapshots': return <GitCommit className={className} />;
    case 'behavior': return <Brain className={className} />;
    case 'prompts': return <BookOpen className={className} />;
  }
}

export function MobileBottomNav({ activeTab, onTabChange, agentActive }: MobileBottomNavProps) {
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreTabs.some((tab) => tab.id === activeTab);

  // Lock body scroll when more sheet is open
  useEffect(() => {
    if (showMore) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [showMore]);

  const getLabel = (key: string) => {
    return t(`mobile.${key}` as `mobile.${string}`);
  };

  return (
    <>
      {/* More sheet overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 animate-fade-in" onClick={() => setShowMore(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-[56px] left-0 right-0 rounded-t-2xl animate-slide-up-sheet pb-safe"
            style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderBottom: 'none' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {t('mobile.more')}
              </span>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 px-3 pb-3">
              {moreTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { onTabChange(tab.id); setShowMore(false); }}
                  aria-label={getLabel(tab.iconKey)}
                  className={clsx(
                    'flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors min-h-[60px]',
                    activeTab === tab.id
                      ? 'bg-[var(--color-accent)]/10'
                      : 'hover:bg-[var(--color-bg-tertiary)]',
                  )}
                  style={{ color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                >
                  <TabIcon id={tab.id} className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{getLabel(tab.iconKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 animate-slide-up pb-safe"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--glass-border)',
          height: '56px',
        }}
        aria-label={t('mobile.bottomNav')}
      >
        <div className="flex items-center justify-around h-[56px] max-w-lg mx-auto px-2">
          {primaryTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isAgent = tab.id === 'agent';

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                aria-label={getLabel(tab.iconKey)}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors',
                  isActive && !isAgent && 'text-[var(--color-accent)]',
                  isAgent && isActive && 'text-green-400',
                  isAgent && !isActive && agentActive && 'text-green-400/60',
                  !isActive && !isAgent && 'text-[var(--color-text-muted)]',
                )}
              >
                <div className="relative">
                  <TabIcon id={tab.id} className="w-5 h-5" />
                  {isAgent && agentActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none">{getLabel(tab.iconKey)}</span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full"
                    style={{ background: isAgent ? '#4ade80' : 'var(--color-accent)' }}
                  />
                )}
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            aria-label={t('mobile.more')}
            className={clsx(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors',
              isMoreActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]',
            )}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-none">{t('mobile.more')}</span>
            {isMoreActive && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
