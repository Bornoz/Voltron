import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'tr' | 'en';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'tr',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'voltron-language',
    },
  ),
);
