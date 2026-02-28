import { useState, useEffect } from 'react';
import { X, Globe, Layout, Bell, Cpu, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLanguageStore } from '../../stores/languageStore';
import { useWindowStore } from '../../stores/windowStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useAuthStore } from '../../stores/authStore';

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

// Global flag so notificationStore can check it
let notificationsEnabled = true;
export function areNotificationsEnabled(): boolean {
  return notificationsEnabled;
}

function loadSettings(currentLang: string): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const settings = { ...defaultSettings(currentLang), ...JSON.parse(raw) };
      notificationsEnabled = settings.notifications;
      return settings;
    }
  } catch { /* ignore */ }
  return defaultSettings(currentLang);
}

function saveSettings(settings: UserSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  notificationsEnabled = settings.notifications;
}

function defaultSettings(lang = 'en'): UserSettings {
  return {
    language: lang as 'en' | 'tr',
    defaultModel: 'claude-sonnet-4-6',
    notifications: true,
    defaultLayout: 'ide-style',
  };
}

// Initialize on load
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    notificationsEnabled = parsed.notifications !== false;
  }
} catch { /* ignore */ }

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
        className="w-[440px] rounded-xl backdrop-blur-xl overflow-hidden"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-elevated)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('settings.title')}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
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
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{t('settings.language')}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => update({ language: 'en' })}
                className="flex-1 px-3 py-2 text-xs rounded-lg border transition-colors"
                style={settings.language === 'en' ? {
                  background: 'rgba(37,99,235,0.2)', borderColor: 'rgba(59,130,246,0.5)', color: 'rgb(147,197,253)'
                } : {
                  background: 'var(--color-bg-tertiary)', borderColor: 'var(--glass-border)', color: 'var(--color-text-secondary)'
                }}
              >
                English
              </button>
              <button
                onClick={() => update({ language: 'tr' })}
                className="flex-1 px-3 py-2 text-xs rounded-lg border transition-colors"
                style={settings.language === 'tr' ? {
                  background: 'rgba(37,99,235,0.2)', borderColor: 'rgba(59,130,246,0.5)', color: 'rgb(147,197,253)'
                } : {
                  background: 'var(--color-bg-tertiary)', borderColor: 'var(--glass-border)', color: 'var(--color-text-secondary)'
                }}
              >
                {t('settings.turkish')}
              </button>
            </div>
          </div>

          {/* Default Model */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{t('settings.defaultModel')}</span>
            </div>
            <select
              value={settings.defaultModel}
              onChange={(e) => update({ defaultModel: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg outline-none focus:border-blue-500/50"
              style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="claude-haiku-4-5-20251001">Haiku 4.5 ({t('settings.modelFast')})</option>
              <option value="claude-sonnet-4-6">Sonnet 4.6 ({t('settings.modelBalanced')})</option>
              <option value="claude-opus-4-6">Opus 4.6 ({t('settings.modelPowerful')})</option>
            </select>
          </div>

          {/* Default Layout */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layout className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{t('settings.defaultLayout')}</span>
            </div>
            <div className="flex gap-2">
              {(['ide-style', 'gps-focus', 'monitor'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => update({ defaultLayout: preset })}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border transition-colors"
                  style={settings.defaultLayout === preset ? {
                    background: 'rgba(16,185,129,0.2)', borderColor: 'rgba(52,211,153,0.5)', color: 'rgb(110,231,183)'
                  } : {
                    background: 'var(--color-bg-tertiary)', borderColor: 'var(--glass-border)', color: 'var(--color-text-secondary)'
                  }}
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
                <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{t('settings.notifications')}</span>
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

          {/* Change Password */}
          <ChangePasswordSection />
        </div>
      </div>
    </div>
  );
}

/* ─── Change Password Section ─── */

function ChangePasswordSection() {
  const { t } = useTranslation();
  const changePassword = useAuthStore((s) => s.changePassword);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = async () => {
    setErrorMsg('');

    if (!currentPw || !newPw) {
      setErrorMsg(t('settings.pwFieldsRequired'));
      setStatus('error');
      return;
    }
    if (newPw.length < 6) {
      setErrorMsg(t('login.passwordMin'));
      setStatus('error');
      return;
    }
    if (newPw !== confirmPw) {
      setErrorMsg(t('login.passwordMismatch'));
      setStatus('error');
      return;
    }

    setStatus('loading');
    const result = await changePassword(currentPw, newPw);
    if (result.success) {
      setStatus('success');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setErrorMsg(result.error ?? 'Failed');
      setStatus('error');
    }
  };

  const inputCls = "w-full px-3 py-1.5 text-xs rounded-lg outline-none focus:border-blue-500/50";
  const inputStyle = { background: 'var(--color-bg-tertiary)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' };

  return (
    <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--glass-border)' }}>
      <div className="flex items-center gap-2">
        <Lock className="w-3.5 h-3.5 text-red-400" />
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{t('settings.changePassword')}</span>
      </div>

      <input
        type="password"
        placeholder={t('settings.currentPassword')}
        value={currentPw}
        onChange={(e) => { setCurrentPw(e.target.value); setStatus('idle'); }}
        className={inputCls}
        style={inputStyle}
        autoComplete="current-password"
      />
      <input
        type="password"
        placeholder={t('login.newPassword')}
        value={newPw}
        onChange={(e) => { setNewPw(e.target.value); setStatus('idle'); }}
        className={inputCls}
        style={inputStyle}
        autoComplete="new-password"
      />
      <input
        type="password"
        placeholder={t('login.confirmPassword')}
        value={confirmPw}
        onChange={(e) => { setConfirmPw(e.target.value); setStatus('idle'); }}
        className={inputCls}
        style={inputStyle}
        autoComplete="new-password"
      />

      {status === 'error' && errorMsg && (
        <div className="flex items-center gap-1.5 text-[10px] text-red-400">
          <AlertCircle className="w-3 h-3" />
          {errorMsg}
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-1.5 text-[10px] text-green-400">
          <CheckCircle2 className="w-3 h-3" />
          {t('settings.passwordChanged')}
        </div>
      )}

      <button
        onClick={handleChange}
        disabled={status === 'loading'}
        className="w-full px-3 py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50"
        style={{
          background: 'rgba(239,68,68,0.15)',
          borderColor: 'rgba(239,68,68,0.3)',
          color: 'rgb(252,165,165)',
        }}
      >
        {status === 'loading' ? '...' : t('settings.updatePassword')}
      </button>
    </div>
  );
}
