import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from '../i18n';
import type { Language } from '../i18n';

export function LoginPage() {
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const loading = useAuthStore((s) => s.loading);
  const storeError = useAuthStore((s) => s.error);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError ?? storeError;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password.trim()) {
      setLocalError(t('login.invalidCredentials'));
      return;
    }

    const success = await login(username, password);
    if (success) {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Background grid effect */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-accent)_0%,transparent_70%)] opacity-[0.06]" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 mb-4">
              <Shield className="w-7 h-7 text-[var(--color-accent)]" />
            </div>
            <h1 className="text-2xl font-bold tracking-wider text-[var(--color-text-primary)]">
              {t('login.title')}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 tracking-wide">
              {t('login.subtitle')}
            </p>
          </div>

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
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-colors disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLocalError(null); }}
                placeholder={t('login.password')}
                autoComplete="current-password"
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-colors disabled:opacity-50"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:brightness-110 active:brightness-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('login.signIn')}
            </button>
          </form>
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
