import { Check, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface SetupProgressProps {
  status: string;
  error: string | null;
  appliedCount: number;
}

const PHASES = ['analyzing', 'discovering', 'evaluating', 'ready', 'applying', 'completed'] as const;

export function SetupProgress({ status, error, appliedCount }: SetupProgressProps) {
  const { t } = useTranslation();

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/30">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        <div>
          <p className="text-xs font-medium text-red-300">{t('smartSetup.failed')}</p>
          {error && <p className="text-[10px] text-red-400 mt-0.5">{error}</p>}
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-900/20 border border-green-700/30">
        <Check className="w-4 h-4 text-green-400 shrink-0" />
        <div>
          <p className="text-xs font-medium text-green-300">{t('smartSetup.completed')}</p>
          <p className="text-[10px] text-green-400 mt-0.5">{appliedCount} repo kuruldu</p>
        </div>
      </div>
    );
  }

  const currentIdx = PHASES.indexOf(status as typeof PHASES[number]);

  return (
    <div className="space-y-2">
      {PHASES.slice(0, -1).map((phase, idx) => {
        const isActive = phase === status;
        const isDone = idx < currentIdx;
        const isPending = idx > currentIdx;

        // Don't show 'discovering' and 'evaluating' steps if status jumps from analyzing to ready (skipGithub)
        if (status === 'ready' && (phase === 'discovering' || phase === 'evaluating') && !isDone) return null;

        const label = t(`smartSetup.${phase}` as `smartSetup.${string}`);

        return (
          <div key={phase} className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center shrink-0">
              {isDone && <Check className="w-3.5 h-3.5 text-green-400" />}
              {isActive && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
              {isPending && <div className="w-2 h-2 rounded-full bg-gray-600" />}
            </div>
            <span
              className="text-[11px]"
              style={{ color: isActive ? 'var(--color-accent)' : isDone ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
