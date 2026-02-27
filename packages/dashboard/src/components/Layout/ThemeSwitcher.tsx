import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore, type ThemeMode } from '../../stores/themeStore';

const MODES: { mode: ThemeMode; icon: typeof Moon; label: string }[] = [
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'midnight', icon: Monitor, label: 'Midnight' },
  { mode: 'light', icon: Sun, label: 'Light' },
];

export function ThemeSwitcher() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div className="flex items-center">
      <div className="flex items-center rounded-full p-0.5" style={{ background: 'var(--color-bg-tertiary)' }}>
        {MODES.map(({ mode: m, icon: Icon }) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`p-1.5 rounded-full transition-all ${
              mode === m
                ? 'text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
            style={mode === m ? { background: 'var(--color-bg-secondary)' } : undefined}
            title={m}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}
