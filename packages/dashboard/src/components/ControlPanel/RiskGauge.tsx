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

const riskGlowColors: Record<RiskLevel, string> = {
  NONE: '',
  LOW: 'shadow-[0_0_16px_rgba(34,197,94,0.1)]',
  MEDIUM: 'shadow-[0_0_16px_rgba(234,179,8,0.1)]',
  HIGH: 'shadow-[0_0_16px_rgba(249,115,22,0.15)]',
  CRITICAL: 'shadow-[0_0_16px_rgba(239,68,68,0.2)]',
};

// SVG arc gauge helpers
const ARC_RADIUS = 70;
const ARC_STROKE = 8;
const ARC_CENTER_X = 90;
const ARC_CENTER_Y = 80;
const ARC_START_ANGLE = Math.PI; // 180 degrees (left)
const ARC_END_ANGLE = 0; // 0 degrees (right)

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy - r * Math.sin(angle),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = startAngle - endAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

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
    if (highestValue === 4) break;
  }

  // Count by risk level
  const riskCounts: Record<RiskLevel, number> = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  for (const event of events) {
    riskCounts[event.risk]++;
  }

  const gaugePercent = highestValue / 4;
  // Needle angle: from PI (left, 0%) to 0 (right, 100%)
  const needleAngle = ARC_START_ANGLE - gaugePercent * Math.PI;
  const needleTip = polarToCartesian(ARC_CENTER_X, ARC_CENTER_Y, ARC_RADIUS - 4, needleAngle);
  const needleBase1 = polarToCartesian(ARC_CENTER_X, ARC_CENTER_Y, 6, needleAngle + Math.PI / 2);
  const needleBase2 = polarToCartesian(ARC_CENTER_X, ARC_CENTER_Y, 6, needleAngle - Math.PI / 2);

  return (
    <Card
      title={t('riskGauge.title')}
      className={clsx(riskGlowColors[highestRisk], 'transition-shadow duration-500')}
    >
      {/* SVG Arc Gauge */}
      <div className="flex justify-center mb-2">
        <svg width="180" height="100" viewBox="0 0 180 100">
          <defs>
            <linearGradient id="riskArcGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={RISK_COLORS.NONE} />
              <stop offset="25%" stopColor={RISK_COLORS.LOW} />
              <stop offset="50%" stopColor={RISK_COLORS.MEDIUM} />
              <stop offset="75%" stopColor={RISK_COLORS.HIGH} />
              <stop offset="100%" stopColor={RISK_COLORS.CRITICAL} />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d={describeArc(ARC_CENTER_X, ARC_CENTER_Y, ARC_RADIUS, ARC_START_ANGLE, ARC_END_ANGLE)}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
          />

          {/* Colored arc */}
          <path
            d={describeArc(ARC_CENTER_X, ARC_CENTER_Y, ARC_RADIUS, ARC_START_ANGLE, ARC_END_ANGLE)}
            fill="none"
            stroke="url(#riskArcGrad)"
            strokeWidth={ARC_STROKE}
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Needle */}
          <polygon
            points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
            fill={RISK_COLORS[highestRisk]}
            opacity="0.9"
            style={{ transition: 'all 0.5s ease-in-out' }}
          />

          {/* Center dot */}
          <circle
            cx={ARC_CENTER_X}
            cy={ARC_CENTER_Y}
            r="4"
            fill={RISK_COLORS[highestRisk]}
            opacity="0.8"
          />

          {/* Risk label */}
          <text
            x={ARC_CENTER_X}
            y={ARC_CENTER_Y - 10}
            textAnchor="middle"
            className={clsx('text-2xl font-bold', riskLabelColors[highestRisk])}
            fill="currentColor"
            fontSize="20"
            fontWeight="700"
          >
            {highestRisk}
          </text>

          {/* Scale labels */}
          <text x="16" y="96" fill="rgba(255,255,255,0.3)" fontSize="8">{t('riskLevels.none')}</text>
          <text x="145" y="96" fill="rgba(255,255,255,0.3)" fontSize="8">{t('riskLevels.critical')}</text>
        </svg>
      </div>

      {/* Risk distribution bars */}
      <div className="space-y-1.5">
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const).map((level) => (
          <div key={level} className="flex items-center gap-2 text-xs">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: RISK_COLORS[level],
                boxShadow: riskCounts[level] > 0 ? `0 0 6px ${RISK_COLORS[level]}40` : 'none',
              }}
            />
            <span className="text-gray-400 w-16">{level}</span>
            <div className="flex-1 bg-white/[0.04] rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: events.length > 0 ? `${(riskCounts[level] / events.length) * 100}%` : '0%',
                  backgroundColor: RISK_COLORS[level],
                  boxShadow: `0 0 8px ${RISK_COLORS[level]}30`,
                }}
              />
            </div>
            <span className="text-gray-500 w-8 text-right font-mono">{riskCounts[level]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
