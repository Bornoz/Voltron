import { useCallback } from 'react';
import { tr, type TranslationKeys } from './tr';
import { en } from './en';
import { useLanguageStore, type Language } from '../stores/languageStore';

const translations: Record<Language, TranslationKeys> = { tr, en };

/**
 * Get a nested value from an object using a dot-separated key path.
 * e.g., getNestedValue(obj, 'header.title') -> obj.header.title
 */
function getNestedValue(obj: unknown, keyPath: string): string {
  const keys = keyPath.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return keyPath; // fallback: return the key itself
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (typeof current === 'string') {
    return current;
  }

  return keyPath; // fallback: return the key itself
}

/**
 * Hook for accessing translations.
 *
 * Usage:
 *   const { t, language, setLanguage } = useTranslation();
 *   t('header.title') // -> 'VOLTRON'
 *   t('actionFeed.events') // -> 'olay' (tr) or 'events' (en)
 */
export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = getNestedValue(translations[language], key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return value;
    },
    [language],
  );

  return { t, language, setLanguage } as const;
}

export type { Language };
