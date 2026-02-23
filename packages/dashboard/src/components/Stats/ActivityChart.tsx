import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useEventStore } from '../../stores/eventStore';
import { useTranslation } from '../../i18n';

const OP_COLORS: Record<string, string> = {
  FILE_CREATE: '#22c55e',
  FILE_MODIFY: '#3b82f6',
  FILE_DELETE: '#ef4444',
  FILE_RENAME: '#eab308',
  CONFIG_CHANGE: '#a855f7',
};

interface ActivityBucket {
  time: string;
  FILE_CREATE: number;
  FILE_MODIFY: number;
  FILE_DELETE: number;
  FILE_RENAME: number;
  CONFIG_CHANGE: number;
  total: number;
}

export function ActivityChart() {
  const { t } = useTranslation();
  const events = useEventStore((s) => s.events);

  const data = useMemo(() => {
    if (events.length === 0) return [];

    // Group events into 1-minute buckets
    const buckets = new Map<number, ActivityBucket>();
    const bucketSize = 60_000; // 1 minute

    for (const event of events) {
      const ts = event.timestamp ?? Date.now();
      const key = Math.floor(ts / bucketSize) * bucketSize;

      if (!buckets.has(key)) {
        const date = new Date(key);
        buckets.set(key, {
          time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
          FILE_CREATE: 0,
          FILE_MODIFY: 0,
          FILE_DELETE: 0,
          FILE_RENAME: 0,
          CONFIG_CHANGE: 0,
          total: 0,
        });
      }

      const bucket = buckets.get(key)!;
      const op = event.action as keyof Pick<ActivityBucket, 'FILE_CREATE' | 'FILE_MODIFY' | 'FILE_DELETE' | 'FILE_RENAME' | 'CONFIG_CHANGE'>;
      if (op in bucket && typeof bucket[op] === 'number') {
        (bucket[op] as number)++;
      }
      bucket.total++;
    }

    // Sort by time, last 30 buckets
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .slice(-30)
      .map(([, v]) => v);
  }, [events]);

  if (data.length < 2) {
    return (
      <div className="p-3 border border-gray-800 rounded-lg">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{t('activityChart.title')}</h4>
        <p className="text-xs text-gray-600 text-center py-6">{t('activityChart.waitingForData')}</p>
      </div>
    );
  }

  return (
    <div className="p-3 border border-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{t('activityChart.title')}</h4>
        <div className="flex items-center gap-2">
          {Object.entries(OP_COLORS).map(([op, color]) => (
            <div key={op} className="flex items-center gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[8px] text-gray-600">{op}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
            labelStyle={{ color: '#9ca3af' }}
          />
          <Bar dataKey="FILE_CREATE" stackId="a" fill={OP_COLORS.FILE_CREATE} />
          <Bar dataKey="FILE_MODIFY" stackId="a" fill={OP_COLORS.FILE_MODIFY} />
          <Bar dataKey="FILE_DELETE" stackId="a" fill={OP_COLORS.FILE_DELETE} />
          <Bar dataKey="FILE_RENAME" stackId="a" fill={OP_COLORS.FILE_RENAME} />
          <Bar dataKey="CONFIG_CHANGE" stackId="a" fill={OP_COLORS.CONFIG_CHANGE} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
