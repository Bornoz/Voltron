import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useEventStore } from '../../stores/eventStore';
import { useTranslation } from '../../i18n';
import type { RiskLevel } from '@voltron/shared';

const RISK_COLORS: Record<string, string> = {
  NONE: '#6b7280',
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const RISK_VALUES: Record<string, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

interface TimelinePoint {
  time: string;
  timestamp: number;
  value: number;
  risk: string;
  count: number;
}

export function RiskTimeline() {
  const { t } = useTranslation();
  const events = useEventStore((s) => s.events);

  const data = useMemo(() => {
    if (events.length === 0) return [];

    // Group events into 30-second buckets
    const buckets = new Map<number, { maxRisk: string; count: number }>();
    const bucketSize = 30_000; // 30 seconds

    for (const event of events) {
      const ts = event.timestamp ?? Date.now();
      const bucketKey = Math.floor(ts / bucketSize) * bucketSize;
      const existing = buckets.get(bucketKey);
      const eventRisk = event.risk ?? 'NONE';

      if (!existing || RISK_VALUES[eventRisk] > RISK_VALUES[existing.maxRisk]) {
        buckets.set(bucketKey, {
          maxRisk: eventRisk,
          count: (existing?.count ?? 0) + 1,
        });
      } else {
        existing.count++;
      }
    }

    // Convert to array, sorted by time
    const points: TimelinePoint[] = [];
    const sorted = [...buckets.entries()].sort(([a], [b]) => a - b);

    // Only show last 50 buckets
    const recent = sorted.slice(-50);

    for (const [ts, { maxRisk, count }] of recent) {
      const date = new Date(ts);
      points.push({
        time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
        timestamp: ts,
        value: RISK_VALUES[maxRisk] ?? 0,
        risk: maxRisk,
        count,
      });
    }

    return points;
  }, [events]);

  if (data.length < 2) {
    return (
      <div className="p-3 border border-gray-800 rounded-lg">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{t('riskTimeline.title')}</h4>
        <p className="text-xs text-gray-600 text-center py-4">{t('riskTimeline.waitingForData')}</p>
      </div>
    );
  }

  return (
    <div className="p-3 border border-gray-800 rounded-lg">
      <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{t('riskTimeline.title')}</h4>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 4]}
            ticks={[0, 1, 2, 3, 4]}
            tickFormatter={(v: number) => ['N', 'L', 'M', 'H', 'C'][v] ?? ''}
            tick={{ fontSize: 9, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number, _name: string, props: any) => [
              `${props.payload.risk} (${props.payload.count} ${t('actionFeed.events')})`,
              t('riskTimeline.risk'),
            ]}
          />
          <ReferenceLine y={3} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Area
            type="stepAfter"
            dataKey="value"
            stroke="#ef4444"
            fill="url(#riskGradient)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: '#ef4444' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
