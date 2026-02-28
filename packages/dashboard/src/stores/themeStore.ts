import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'midnight';

export interface AccentColor {
  name: string;
  value: string; // tailwind class prefix e.g. 'blue', 'purple', 'green'
  hex: string;
}

export const ACCENT_COLORS: AccentColor[] = [
  { name: 'Blue', value: 'blue', hex: '#3b82f6' },
  { name: 'Purple', value: 'purple', hex: '#a855f7' },
  { name: 'Green', value: 'green', hex: '#22c55e' },
  { name: 'Orange', value: 'orange', hex: '#f97316' },
  { name: 'Red', value: 'red', hex: '#ef4444' },
  { name: 'Cyan', value: 'cyan', hex: '#06b6d4' },
  { name: 'Pink', value: 'pink', hex: '#ec4899' },
];

interface ThemeState {
  mode: ThemeMode;
  accent: string; // accent color value
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      accent: 'blue',
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: 'voltron-theme',
      // Migrate: if user had 'light' theme selected, fall back to 'dark'
      merge: (persisted, current) => {
        const p = persisted as Partial<ThemeState>;
        return {
          ...current,
          ...p,
          mode: (p.mode === 'light' || !p.mode) ? 'dark' : p.mode,
        } as ThemeState;
      },
    },
  ),
);
