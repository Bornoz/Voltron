import { AlertOctagon, Code, FileType, ArrowUpRight, Info } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface BreakingChange {
  type: 'api_signature' | 'type_change' | 'export_removed' | 'behavioral' | 'config_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file?: string;
  line?: number;
  before?: string;
  after?: string;
}

interface BreakingChangesProps {
  data?: {
    changes?: BreakingChange[];
    totalBreaking?: number;
    criticalCount?: number;
  };
}

const TYPE_CONFIG: Record<string, { icon: typeof Code; label: string; color: string }> = {
  api_signature: { icon: Code, label: 'API Signature', color: 'text-red-400' },
  type_change: { icon: FileType, label: 'Type Change', color: 'text-orange-400' },
  export_removed: { icon: ArrowUpRight, label: 'Export Removed', color: 'text-red-500' },
  behavioral: { icon: Info, label: 'Behavioral', color: 'text-yellow-400' },
  config_change: { icon: AlertOctagon, label: 'Config', color: 'text-purple-400' },
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-green-900/30 text-green-400 border-green-800',
  medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  high: 'bg-orange-900/30 text-orange-400 border-orange-800',
  critical: 'bg-red-900/30 text-red-400 border-red-800',
};

export function BreakingChanges({ data }: BreakingChangesProps) {
  const { t } = useTranslation();

  if (!data || !data.changes || data.changes.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertOctagon className="w-6 h-6 text-green-600 mx-auto mb-2" />
        <p className="text-xs text-green-400">{t('github.noBreakingChanges')}</p>
      </div>
    );
  }

  const { changes, totalBreaking, criticalCount } = data;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex items-center gap-1.5">
          <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-gray-300">
            <strong className="text-red-400">{totalBreaking ?? changes.length}</strong> {t('github.breakingChange')}
          </span>
        </div>
        {(criticalCount ?? 0) > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-red-900/50 text-red-400 border border-red-800 rounded">
            {criticalCount} CRITICAL
          </span>
        )}
      </div>

      {/* Changes list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
        {changes.map((change, i) => {
          const config = TYPE_CONFIG[change.type] ?? TYPE_CONFIG.behavioral;
          const Icon = config.icon;
          const severityClass = SEVERITY_COLORS[change.severity] ?? SEVERITY_COLORS.medium;

          return (
            <div key={i} className="border border-gray-800 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/30">
                <Icon className={`w-3 h-3 ${config.color} shrink-0`} />
                <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded border ${severityClass} ml-auto`}>
                  {change.severity.toUpperCase()}
                </span>
              </div>

              {/* Body */}
              <div className="px-3 py-2 space-y-1.5">
                <p className="text-[11px] text-gray-300">{change.description}</p>

                {change.file && (
                  <div className="text-[10px] text-gray-500 font-mono">
                    {change.file}{change.line ? `:${change.line}` : ''}
                  </div>
                )}

                {/* Before/After */}
                {(change.before || change.after) && (
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {change.before && (
                      <div className="bg-red-900/10 border border-red-900/30 rounded p-1.5">
                        <div className="text-[9px] text-red-500 mb-0.5">{t('github.before')}</div>
                        <code className="text-[10px] text-red-300 font-mono break-all">{change.before}</code>
                      </div>
                    )}
                    {change.after && (
                      <div className="bg-green-900/10 border border-green-900/30 rounded p-1.5">
                        <div className="text-[9px] text-green-500 mb-0.5">{t('github.after')}</div>
                        <code className="text-[10px] text-green-300 font-mono break-all">{change.after}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
