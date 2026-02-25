import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from '../../i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When any of these values change, the error state auto-resets (e.g. route path) */
  resetKeys?: unknown[];
  /** Optional custom fallback renderer */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error && this.props.resetKeys) {
      const prev = prevProps.resetKeys ?? [];
      const curr = this.props.resetKeys;
      if (curr.length !== prev.length || curr.some((k, i) => k !== prev[i])) {
        this.setState({ error: null });
      }
    }
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.handleReset);
      }

      return <DefaultFallback error={error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center h-full min-h-[200px] p-6">
      <div className="max-w-md w-full bg-gray-900 border border-red-800/50 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-red-900/50 flex items-center justify-center">
            <span className="text-red-400 text-lg">!</span>
          </div>
          <h2 className="text-sm font-semibold text-gray-200">{t('common.errorTitle')}</h2>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          {t('common.errorDescription')}
        </p>

        <button
          onClick={onReset}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          {t('common.retry')}
        </button>

        <details className="mt-4">
          <summary className="text-[10px] text-gray-500 cursor-pointer hover:text-gray-400">
            {t('common.technicalDetails')}
          </summary>
          <pre className="mt-2 p-2 bg-gray-950 rounded text-[10px] text-red-400 overflow-auto max-h-40 whitespace-pre-wrap break-all">
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      </div>
    </div>
  );
}
