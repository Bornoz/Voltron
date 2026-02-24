import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <h1 className="text-8xl font-black text-[var(--color-text-muted)] opacity-30 select-none">404</h1>
        <p className="text-lg text-[var(--color-text-secondary)] mt-2 mb-6">
          {t('notFound.message')}
        </p>
        <Link
          to="/dashboard"
          className="inline-block px-5 py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:brightness-110 transition-all"
        >
          {t('notFound.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
