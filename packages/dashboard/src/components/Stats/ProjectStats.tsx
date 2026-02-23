import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '../common/Card';
import { useEventStore } from '../../stores/eventStore';
import { useTranslation } from '../../i18n';
import { RISK_COLORS } from '@voltron/shared';
import type { RiskLevel, OperationType } from '@voltron/shared';

const riskOrder: RiskLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
function getActionLabels(t: (key: string) => string): Record<OperationType, string> {
  return {
    FILE_CREATE: t('operations.fileCreate'),
    FILE_MODIFY: t('operations.fileModify'),
    FILE_DELETE: t('operations.fileDelete'),
    FILE_RENAME: t('operations.fileRename'),
    DIR_CREATE: t('operations.dirCreate'),
    DIR_DELETE: t('operations.dirDelete'),
    DEPENDENCY_CHANGE: t('operations.dependencyChange'),
    CONFIG_CHANGE: t('operations.configChange'),
  };
}

const actionBarColors: Record<OperationType, string> = {
  FILE_CREATE: '#22c55e',
  FILE_MODIFY: '#eab308',
  FILE_DELETE: '#ef4444',
  FILE_RENAME: '#3b82f6',
  DIR_CREATE: '#22c55e',
  DIR_DELETE: '#ef4444',
  DEPENDENCY_CHANGE: '#a855f7',
  CONFIG_CHANGE: '#f97316',
};

export function ProjectStats() {
  const { t } = useTranslation();
  const events = useEventStore((s) => s.events);
  const actionLabels = getActionLabels(t);

  // Compute stats
  const riskData = riskOrder.map((level) => ({
    name: level,
    count: events.filter((e) => e.risk === level).length,
    color: RISK_COLORS[level],
  }));

  const actionCounts = new Map<OperationType, number>();
  for (const event of events) {
    actionCounts.set(event.action, (actionCounts.get(event.action) ?? 0) + 1);
  }
  const actionData = [...actionCounts.entries()]
    .map(([action, count]) => ({
      name: actionLabels[action] ?? action,
      count,
      color: actionBarColors[action] ?? '#6b7280',
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <Card title={t('projectStats.title')}>
      {/* Total */}
      <div className="text-center mb-4">
        <span className="text-3xl font-bold text-gray-200">{events.length}</span>
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{t('projectStats.totalEvents')}</p>
      </div>

      {/* Risk distribution chart */}
      {events.length > 0 && (
        <>
          <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
            {t('projectStats.byRiskLevel')}
          </h4>
          <div className="h-28 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#f3f4f6',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Action type chart */}
          <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
            {t('projectStats.byActionType')}
          </h4>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actionData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#f3f4f6',
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {actionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
