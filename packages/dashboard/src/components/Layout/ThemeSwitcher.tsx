import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore, ACCENT_COLORS, type ThemeMode } from '../../stores/themeStore';

const MODES: { mode: ThemeMode; icon: typeof Moon; label: string }[] = [
  { mode: 'dark', icon: Moon, label: 'Dark' },
  { mode: 'midnight', icon: Monitor, label: 'Midnight' },
  { mode: 'light', icon: Sun, label: 'Light' },
];

export function ThemeSwitcher() {
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);

  return (
    <div className="flex items-center gap-2">
      {/* Mode toggle */}
      <div className="flex items-center bg-gray-800 rounded-full p-0.5">
        {MODES.map(({ mode: m, icon: Icon }) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`p-1 rounded-full transition-colors ${
              mode === m ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
            title={m}
          >
            <Icon className="w-3 h-3" />
          </button>
        ))}
      </div>

      {/* Accent color dots */}
      <div className="flex items-center gap-0.5">
        {ACCENT_COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setAccent(c.value)}
            className={`w-3 h-3 rounded-full transition-all ${
              accent === c.value ? 'ring-1 ring-white ring-offset-1 ring-offset-gray-900 scale-125' : 'opacity-60 hover:opacity-100'
            }`}
            style={{ backgroundColor: c.hex }}
            title={c.name}
          />
        ))}
      </div>
    </div>
  );
}
