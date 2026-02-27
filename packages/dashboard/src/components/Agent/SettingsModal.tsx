import { useState, useEffect } from 'react';
import { X, Globe, Layout, Bell, Cpu } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLanguageStore } from '../../stores/languageStore';
import { useWindowStore } from '../../stores/windowStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'voltron_user_settings';

interface UserSettings {
  language: 'en' | 'tr';
  defaultModel: string;
  notifications: boolean;
  defaultLayout: string;
}

function loadSettings(currentLang: string): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings(currentLang), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return defaultSettings(currentLang);
}

function saveSettings(settings: UserSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function defaultSettings(lang = 'en'): UserSettings {
  return {
    language: lang as 'en' | 'tr',
    defaultModel: 'claude-haiku-4-5-20251001',
    notifications: true,
    defaultLayout: 'ide-style',
  };
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t, language } = useTranslation();
  const setLang = useLanguageStore((s) => s.setLanguage);
  const applyPreset = useWindowStore((s) => s.applyPreset);
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings(language));

  useEffect(() => {
    if (isOpen) setSettings(loadSettings(language));
  }, [isOpen, language]);

  const update = (patch: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...patch };
    setSettings(newSettings);
    saveSettings(newSettings);

    if (patch.language) {
      setLang(patch.language);
    }
    if (patch.defaultLayout) {
      applyPreset(patch.defaultLayout as 'ide-style' | 'gps-focus' | 'monitor');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[440px] bg-gray-900/98 border border-gray-700/60 rounded-xl shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800/60">
          <h2 className="text-sm font-semibold text-gray-200">{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800/60 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Language */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-medium text-gray-300">{t('settings.language')}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => update({ language: 'en' })}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  settings.language === 'en'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                English
              </button>
              <button
                onClick={() => update({ language: 'tr' })}
                className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                  settings.language === 'tr'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:border-gray-600'
                }`}
              >
                Turkce
              </button>
            </div>
          </div>

          {/* Default Model */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium text-gray-300">{t('settings.defaultModel')}</span>
            </div>
            <select
              value={settings.defaultModel}
              onChange={(e) => update({ defaultModel: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-300 outline-none focus:border-blue-500/50"
            >
              <option value="claude-haiku-4-5-20251001">Haiku 4.5 (Hizli)</option>
              <option value="claude-sonnet-4-6">Sonnet 4.6 (Dengeli)</option>
              <option value="claude-opus-4-6">Opus 4.6 (Guclu)</option>
            </select>
          </div>

          {/* Default Layout */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layout className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-gray-300">{t('settings.defaultLayout')}</span>
            </div>
            <div className="flex gap-2">
              {(['ide-style', 'gps-focus', 'monitor'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => update({ defaultLayout: preset })}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                    settings.defaultLayout === preset
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-gray-800/40 border-gray-700/50 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {preset === 'ide-style' ? 'IDE' : preset === 'gps-focus' ? 'GPS' : 'Monitor'}
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-xs font-medium text-gray-300">{t('settings.notifications')}</span>
              </div>
              <button
                onClick={() => update({ notifications: !settings.notifications })}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  settings.notifications ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.notifications ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
