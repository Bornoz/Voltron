import { useControlStore } from '../../stores/controlStore';
import { formatRelativeTime } from '../../lib/formatters';
import { useTranslation } from '../../i18n';

const STATE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  IDLE: { bg: 'bg-gray-800', text: 'text-gray-400', dot: 'bg-gray-500' },
  RUNNING: { bg: 'bg-green-900/30', text: 'text-green-400', dot: 'bg-green-500' },
  STOPPED: { bg: 'bg-red-900/30', text: 'text-red-400', dot: 'bg-red-500' },
  RESUMING: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  ERROR: { bg: 'bg-red-900/50', text: 'text-red-300', dot: 'bg-red-600' },
};

export function StateHistory() {
  const { t } = useTranslation();
  const history = useControlStore((s) => s.history);

  if (history.length === 0) {
    return (
      <div className="p-3 border border-gray-800 rounded-lg">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{t('stateHistory.title')}</h4>
        <p className="text-xs text-gray-600 text-center py-3">{t('stateHistory.noTransitions')}</p>
      </div>
    );
  }

  // Show most recent 20 transitions
  const recent = history.slice(-20).reverse();

  return (
    <div className="p-3 border border-gray-800 rounded-lg">
      <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
        {t('stateHistory.title')}
        <span className="ml-2 text-gray-600 font-normal">({history.length} {t('stateHistory.total')})</span>
      </h4>
      <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
        {recent.map((entry, i) => {
          const style = STATE_STYLES[entry.state] ?? STATE_STYLES.IDLE;
          return (
            <div
              key={`${entry.timestamp}-${i}`}
              className={`flex items-center gap-2 px-2 py-1.5 rounded ${style.bg}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
              <span className={`text-[11px] font-mono font-medium uppercase ${style.text}`}>
                {entry.state}
              </span>
              {entry.reason && (
                <span className="text-[10px] text-gray-500 truncate flex-1">
                  {entry.reason}
                </span>
              )}
              <span className="text-[10px] text-gray-600 shrink-0 ml-auto">
                {entry.actor && <span className="text-gray-500 mr-1">{entry.actor}</span>}
                {formatRelativeTime(entry.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
