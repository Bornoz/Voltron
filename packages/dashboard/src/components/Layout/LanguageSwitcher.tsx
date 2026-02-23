import { clsx } from 'clsx';
import { useTranslation } from '../../i18n';
import type { Language } from '../../i18n';

const languages: Language[] = ['tr', 'en'];

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="flex items-center rounded-md border border-gray-700 overflow-hidden">
      {languages.map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={clsx(
            'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors',
            language === lang
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-500 hover:text-gray-300',
          )}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
