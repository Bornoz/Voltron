import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Settings, LogOut, Sun, Globe } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from '../../i18n';

interface MobileHeaderMenuProps {
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export function MobileHeaderMenu({ onOpenSettings, onLogout }: MobileHeaderMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => {
      document.removeEventListener('pointerdown', handler);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label={t('mobile.menu')}
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-56 rounded-xl shadow-xl z-50 animate-fade-in-up py-1"
          style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(16px)', border: '1px solid var(--glass-border)' }}
        >
          {/* Theme */}
          <div className="flex items-center justify-between px-3 py-2.5 min-h-[44px]">
            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Sun className="w-4 h-4" />
              <span className="text-xs">{t('mobile.theme')}</span>
            </div>
            <ThemeSwitcher />
          </div>

          {/* Language */}
          <div className="flex items-center justify-between px-3 py-2.5 min-h-[44px]">
            <div className="flex items-center gap-2" style={{ color: 'var(--color-text-secondary)' }}>
              <Globe className="w-4 h-4" />
              <span className="text-xs">{t('settings.language')}</span>
            </div>
            <LanguageSwitcher />
          </div>

          <div className="h-px mx-2 my-1" style={{ background: 'var(--glass-border)' }} />

          {/* Settings */}
          {onOpenSettings && (
            <button
              onClick={() => { onOpenSettings(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 min-h-[44px] text-xs transition-colors hover:bg-[var(--color-bg-tertiary)]"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <Settings className="w-4 h-4" />
              {t('settings.title')}
            </button>
          )}

          {/* Logout */}
          {onLogout && (
            <button
              onClick={() => { onLogout(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 min-h-[44px] text-xs transition-colors hover:bg-[var(--color-bg-tertiary)] text-red-400"
            >
              <LogOut className="w-4 h-4" />
              {t('login.signOut')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
