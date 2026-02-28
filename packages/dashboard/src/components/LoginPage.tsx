import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, AlertCircle, Loader2, UserPlus, LogIn } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from '../i18n';
import type { Language } from '../i18n';

export function LoginPage() {
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const checkSetup = useAuthStore((s) => s.checkSetup);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);
  const setupRequired = useAuthStore((s) => s.setupRequired);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError ?? storeError;
  const isSetup = setupRequired === true;

  // Check if first-time setup is needed
  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password.trim()) {
      setLocalError(t('login.invalidCredentials'));
      return;
    }

    if (isSetup) {
      // Registration mode
      if (username.trim().length < 3) {
        setLocalError(t('login.usernameMin'));
        return;
      }
      if (password.length < 6) {
        setLocalError(t('login.passwordMin'));
        return;
      }
      if (password !== confirmPassword) {
        setLocalError(t('login.passwordMismatch'));
        return;
      }
      const success = await register(username, password);
      if (success) {
        navigate('/dashboard', { replace: true });
      }
    } else {
      // Login mode
      const success = await login(username, password);
      if (success) {
        navigate('/dashboard', { replace: true });
      }
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at 25% 50%, color-mix(in srgb, var(--color-accent) 6%, transparent) 0%, transparent 50%),
              radial-gradient(ellipse at 75% 20%, rgba(139, 92, 246, 0.05) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 80%, rgba(6, 182, 212, 0.04) 0%, transparent 50%)
            `,
          }}
        />
      </div>

      {/* Grid effect */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4 animate-fade-in-up">
        <div
          className="glass rounded-2xl p-8"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
              <img
                src="/voltronlogo.png"
                alt="Voltron"
                className="w-20 h-20 object-contain"
                style={{ filter: 'drop-shadow(0 0 24px rgba(59, 130, 246, 0.3))' }}
              />
            </div>
            <h1 className="text-2xl font-bold tracking-wider text-[var(--color-text-primary)]">
              {t('login.title')}
            </h1>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 tracking-[0.2em] uppercase">
              AI Operation Control Center
            </p>
          </div>

          {/* Setup banner */}
          {isSetup && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <UserPlus className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-semibold text-blue-400">{t('login.firstTimeSetup')}</span>
              </div>
              <p className="text-[10px] text-blue-300/70">{t('login.createAdminDesc')}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setLocalError(null); }}
                placeholder={t('login.username')}
                autoComplete="username"
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.03] border border-white/[0.06] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLocalError(null); }}
                placeholder={isSetup ? t('login.newPassword') : t('login.password')}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.03] border border-white/[0.06] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all disabled:opacity-50"
              />
            </div>

            {/* Confirm Password (only in setup mode) */}
            {isSetup && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(null); }}
                  placeholder={t('login.confirmPassword')}
                  autoComplete="new-password"
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/[0.03] border border-white/[0.06] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20 transition-all disabled:opacity-50"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 animate-fade-in-up">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-b from-[var(--color-accent)] to-[var(--color-accent-hover)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:brightness-110 active:scale-[0.98] active:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px color-mix(in srgb, var(--color-accent) 25%, transparent)' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSetup ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  {t('login.createAdmin')}
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {t('login.signIn')}
                </>
              )}
            </button>
          </form>

          {/* Password requirements hint (setup mode) */}
          {isSetup && (
            <p className="mt-3 text-[10px] text-center text-[var(--color-text-muted)]">
              {t('login.passwordRequirements')}
            </p>
          )}
        </div>
      </div>

      {/* Language switcher - bottom right */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 z-10">
        {(['tr', 'en'] as Language[]).map((lang) => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`px-2 py-1 text-[10px] font-semibold rounded transition-colors ${
              language === lang
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {t(`language.${lang}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
