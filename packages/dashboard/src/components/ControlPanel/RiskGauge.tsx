import { clsx } from 'clsx';
import type { RiskLevel } from '@voltron/shared';
import { RISK_COLORS } from '@voltron/shared';
import { Card } from '../common/Card';
import { useEventStore } from '../../stores/eventStore';
import { useTranslation } from '../../i18n';

const riskValues: Record<RiskLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const riskLabelColors: Record<RiskLevel, string> = {
  NONE: 'text-gray-400',
  LOW: 'text-green-400',
  MEDIUM: 'text-yellow-400',
  HIGH: 'text-orange-400',
  CRITICAL: 'text-red-400',
};

export function RiskGauge() {
  const { t } = useTranslation();
  const events = useEventStore((s) => s.events);

  // Find highest risk from recent events
  let highestRisk: RiskLevel = 'NONE';
  let highestValue = 0;

  for (const event of events) {
    const val = riskValues[event.risk];
    if (val > highestValue) {
      highestValue = val;
      highestRisk = event.risk;
    }
    // Early exit if already at max
    if (highestValue === 4) break;
  }

  // Count by risk level
  const riskCounts: Record<RiskLevel, number> = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const event of events) {
    riskCounts[event.risk]++;
  }

  const gaugePercent = (highestValue / 4) * 100;

  return (
    <Card title={t('riskGauge.title')}>
      {/* Gauge bar */}
      <div className="mb-3">
        <div className="relative h-3 rounded-full overflow-hidden risk-gauge-bg opacity-30">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${gaugePercent}%`,
              backgroundColor: RISK_COLORS[highestRisk],
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-gray-600">
          <span>{t('riskLevels.none')}</span>
          <span>{t('riskLevels.low')}</span>
          <span>{t('riskLevels.medium')}</span>
          <span>{t('riskLevels.high')}</span>
          <span>{t('riskLevels.critical')}</span>
        </div>
      </div>

      {/* Current highest */}
      <div className="text-center mb-3">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{t('riskGauge.highestRisk')}</span>
        <div className={clsx('text-2xl font-bold', riskLabelColors[highestRisk])}>
          {highestRisk}
        </div>
      </div>

      {/* Risk distribution */}
      <div className="space-y-1">
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: RISK_COLORS[level] }}
            />
            <span className="text-gray-400 w-16">{level}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-1.5">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: events.length > 0 ? `${(riskCounts[level] / events.length) * 100}%` : '0%',
                  backgroundColor: RISK_COLORS[level],
                }}
              />
            </div>
            <span className="text-gray-500 w-8 text-right">{riskCounts[level]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
