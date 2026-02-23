import { useState } from 'react';
import { StopCircle, PlayCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { useControlStore } from '../../stores/controlStore';
import { useControl } from '../../hooks/useControl';
import { formatRelativeTime } from '../../lib/formatters';
import { useTranslation } from '../../i18n';
import type { ExecutionState } from '@voltron/shared';

const stateStyles: Record<ExecutionState, { bg: string; text: string; label: string }> = {
  IDLE: { bg: 'bg-gray-800', text: 'text-gray-300', label: 'IDLE' },
  RUNNING: { bg: 'bg-green-900/40', text: 'text-green-400', label: 'RUNNING' },
  STOPPED: { bg: 'bg-red-900/40', text: 'text-red-400', label: 'STOPPED' },
  RESUMING: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: 'RESUMING' },
  ERROR: { bg: 'bg-red-900/60', text: 'text-red-300', label: 'ERROR' },
};

interface ExecutionControlsProps {
  projectId: string | null;
}

export function ExecutionControls({ projectId }: ExecutionControlsProps) {
  const { t } = useTranslation();
  const executionState = useControlStore((s) => s.executionState);
  const context = useControlStore((s) => s.context);
  const history = useControlStore((s) => s.history);
  const { stop, continue_, reset } = useControl(projectId);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const stateStyle = stateStyles[executionState] ?? stateStyles.IDLE;

  const handleReset = () => {
    if (showResetConfirm) {
      reset();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  return (
    <Card title={t('executionControls.title')}>
      {/* Current State */}
      <div className="mb-4">
        <div
          className={clsx(
            'flex items-center justify-center py-3 rounded-lg border',
            stateStyle.bg,
            executionState === 'RUNNING' && 'animate-pulse',
            'border-gray-700',
          )}
        >
          <span className={clsx('text-lg font-bold tracking-widest', stateStyle.text)}>
            {stateStyle.label}
          </span>
        </div>

        {/* Context info */}
        {context && (
          <div className="mt-2 space-y-1 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>{t('executionControls.processed')}</span>
              <span className="text-gray-400">{context.totalActionsProcessed}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('executionControls.pending')}</span>
              <span className="text-gray-400">{context.pendingActions}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('executionControls.autoStopThreshold')}</span>
              <span className="text-gray-400">{context.autoStopRiskThreshold}</span>
            </div>
            {context.stopReason && (
              <div className="flex justify-between">
                <span>{t('executionControls.stopReason')}</span>
                <span className="text-yellow-400">{context.stopReason}</span>
              </div>
            )}
            {context.errorMessage && (
              <div className="flex items-start gap-1 mt-1 p-2 bg-red-900/20 rounded text-red-400">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{context.errorMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2 mb-4">
        <Button
          variant="danger"
          size="sm"
          icon={<StopCircle className="w-4 h-4" />}
          onClick={stop}
          disabled={executionState === 'STOPPED' || executionState === 'IDLE'}
          className="flex-1"
        >
          {t('executionControls.stop')}
        </Button>
        <Button
          variant="success"
          size="sm"
          icon={<PlayCircle className="w-4 h-4" />}
          onClick={continue_}
          disabled={executionState !== 'STOPPED'}
          className="flex-1"
        >
          {t('executionControls.continue')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={handleReset}
          className={clsx('flex-1', showResetConfirm && 'border-red-600 text-red-400')}
        >
          {showResetConfirm ? t('executionControls.confirm') : t('executionControls.reset')}
        </Button>
      </div>

      {/* State History */}
      {history.length > 0 && (
        <div>
          <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
            {t('executionControls.stateHistory')}
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {history.slice(0, 10).map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    stateStyles[entry.state]?.bg ?? 'bg-gray-700',
                  )}
                />
                <span className={stateStyles[entry.state]?.text ?? 'text-gray-400'}>
                  {entry.state}
                </span>
                {entry.reason && (
                  <span className="text-gray-600 truncate">({entry.reason})</span>
                )}
                <span className="text-gray-600 ml-auto shrink-0">
                  {formatRelativeTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
