import { useState, useEffect, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface MobileRightSheetProps {
  children: ReactNode;
}

export function MobileRightSheet({ children }: MobileRightSheetProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  return (
    <>
      {/* Peek handle — fixed above bottom nav (accounting for safe area) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-0 right-0 z-20 flex items-center justify-center h-8"
          style={{
            bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--glass-border)',
          }}
          aria-label={t('mobile.showPanel')}
        >
          <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-[10px] ml-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('mobile.showPanel')}
          </span>
        </button>
      )}

      {/* Open sheet */}
      {open && (
        <div className="fixed inset-0 z-40 animate-fade-in" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 right-0 rounded-t-2xl animate-slide-up-sheet overflow-hidden"
            style={{
              bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--glass-border)',
              borderBottom: 'none',
              maxHeight: '70vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex items-center justify-between px-4 py-2 sticky top-0 z-10" style={{ background: 'var(--color-bg-primary)', borderBottom: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-2">
                <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {t('mobile.monitoring')}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{ color: 'var(--color-text-muted)' }}
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-3 space-y-3" style={{ maxHeight: 'calc(70vh - 44px)' }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
