import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useEventStore } from '../../stores/eventStore';
import { useTranslation } from '../../i18n';

const RISK_COLORS: Record<string, string> = {
  NONE: '#6b7280',
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

const RISK_ORDER = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function RiskBreakdown() {
  const { t } = useTranslation();
  const events = useEventStore((s) => s.events);

  const data = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const event of events) {
      const risk = event.risk ?? 'NONE';
      counts[risk] = (counts[risk] ?? 0) + 1;
    }

    return RISK_ORDER
      .filter((r) => (counts[r] ?? 0) > 0)
      .map((risk) => ({
        name: risk,
        value: counts[risk],
        color: RISK_COLORS[risk] ?? '#6b7280',
      }));
  }, [events]);

  const total = events.length;

  if (total === 0) {
    return (
      <div className="p-3 border border-gray-800 rounded-lg">
        <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{t('riskBreakdown.title')}</h4>
        <p className="text-xs text-gray-600 text-center py-6">{t('riskBreakdown.waitingForData')}</p>
      </div>
    );
  }

  return (
    <div className="p-3 border border-gray-800 rounded-lg">
      <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">{t('riskBreakdown.title')}</h4>
      <div className="flex items-center gap-3">
        {/* Pie chart */}
        <div className="w-20 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={20}
                outerRadius={35}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: '11px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[10px] text-gray-400">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-300 font-mono">{entry.value}</span>
                <span className="text-[9px] text-gray-600 w-8 text-right">
                  {((entry.value / total) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
          <div className="pt-1 border-t border-gray-800 flex items-center justify-between">
            <span className="text-[10px] text-gray-500">{t('riskBreakdown.total')}</span>
            <span className="text-[11px] text-gray-300 font-mono font-medium">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
