import { Search, Filter } from 'lucide-react';
import { useEventStore } from '../../stores/eventStore';
import { useTranslation } from '../../i18n';
import type { RiskLevel, OperationType } from '@voltron/shared';

const riskLevels: RiskLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const actionTypes: OperationType[] = [
  'FILE_CREATE', 'FILE_MODIFY', 'FILE_DELETE', 'FILE_RENAME',
  'DIR_CREATE', 'DIR_DELETE', 'DEPENDENCY_CHANGE', 'CONFIG_CHANGE',
];

const riskButtonColors: Record<RiskLevel, string> = {
  NONE: 'border-gray-600 text-gray-400 data-[active=true]:bg-gray-700 data-[active=true]:text-gray-200',
  LOW: 'border-green-700 text-green-500 data-[active=true]:bg-green-900/50 data-[active=true]:text-green-300',
  MEDIUM: 'border-yellow-700 text-yellow-500 data-[active=true]:bg-yellow-900/50 data-[active=true]:text-yellow-300',
  HIGH: 'border-orange-700 text-orange-500 data-[active=true]:bg-orange-900/50 data-[active=true]:text-orange-300',
  CRITICAL: 'border-red-700 text-red-500 data-[active=true]:bg-red-900/50 data-[active=true]:text-red-300',
};

export function ActionFilter() {
  const { t } = useTranslation();
  const filter = useEventStore((s) => s.filter);
  const setFilter = useEventStore((s) => s.setFilter);

  const actionTypeLabels: Record<OperationType, string> = {
    FILE_CREATE: t('operations.fileCreate'),
    FILE_MODIFY: t('operations.fileModify'),
    FILE_DELETE: t('operations.fileDelete'),
    FILE_RENAME: t('operations.fileRename'),
    DIR_CREATE: t('operations.dirCreate'),
    DIR_DELETE: t('operations.dirDelete'),
    DEPENDENCY_CHANGE: t('operations.dependencyChange'),
    CONFIG_CHANGE: t('operations.configChange'),
  };

  const toggleRisk = (level: RiskLevel) => {
    const current = filter.riskLevels ?? [];
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    setFilter({ riskLevels: next.length > 0 ? next : undefined });
  };

  const toggleAction = (type: OperationType) => {
    const current = filter.actionTypes ?? [];
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setFilter({ actionTypes: next.length > 0 ? next : undefined });
  };

  return (
    <div className="space-y-2 p-3 border-b border-gray-800 bg-gray-900/50">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
        <input
          type="text"
          placeholder={t('actionFilter.filterByFilePath')}
          value={filter.fileSearch ?? ''}
          onChange={(e) => setFilter({ fileSearch: e.target.value || undefined })}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Risk Level filters */}
      <div className="flex items-center gap-1.5">
        <Filter className="w-3 h-3 text-gray-500 shrink-0" />
        {riskLevels.map((level) => {
          const isActive = filter.riskLevels?.includes(level) ?? false;
          return (
            <button
              key={level}
              data-active={isActive}
              onClick={() => toggleRisk(level)}
              className={`px-1.5 py-0.5 text-[10px] font-medium border rounded transition-colors ${riskButtonColors[level]}`}
            >
              {level}
            </button>
          );
        })}
      </div>

      {/* Action Type filters */}
      <div className="flex items-center gap-1 flex-wrap">
        {actionTypes.map((type) => {
          const isActive = filter.actionTypes?.includes(type) ?? false;
          return (
            <button
              key={type}
              onClick={() => toggleAction(type)}
              className={`px-1.5 py-0.5 text-[10px] font-medium border rounded transition-colors ${
                isActive
                  ? 'bg-blue-900/50 border-blue-700 text-blue-300'
                  : 'border-gray-700 text-gray-500 hover:text-gray-400'
              }`}
            >
              {actionTypeLabels[type] ?? type}
            </button>
          );
        })}
      </div>
    </div>
  );
}
