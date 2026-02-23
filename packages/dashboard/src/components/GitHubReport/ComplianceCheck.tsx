import { CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  details?: string;
  severity: 'info' | 'warning' | 'error';
}

interface ComplianceCheckProps {
  data?: {
    rules?: ComplianceRule[];
    score?: number;
    passCount?: number;
    failCount?: number;
    warnCount?: number;
  };
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  pass: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-900/20' },
  fail: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/20' },
  warn: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
  skip: { icon: Shield, color: 'text-gray-500', bg: 'bg-gray-800/30' },
};

export function ComplianceCheck({ data }: ComplianceCheckProps) {
  const { t } = useTranslation();

  if (!data || !data.rules || data.rules.length === 0) {
    return (
      <div className="text-center py-8">
        <Shield className="w-6 h-6 text-gray-700 mx-auto mb-2" />
        <p className="text-xs text-gray-600">{t('github.noComplianceData')}</p>
      </div>
    );
  }

  const { rules, score, passCount, failCount, warnCount } = data;

  return (
    <div className="space-y-3">
      {/* Score */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-gray-300">{t('github.complianceScore')}</span>
        </div>
        <div className="flex items-center gap-3">
          <ScoreBadge value={score ?? Math.round(((passCount ?? 0) / rules.length) * 100)} />
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-green-400">{passCount ?? rules.filter((r) => r.status === 'pass').length} {t('github.pass')}</span>
            <span className="text-red-400">{failCount ?? rules.filter((r) => r.status === 'fail').length} {t('github.fail')}</span>
            <span className="text-yellow-400">{warnCount ?? rules.filter((r) => r.status === 'warn').length} {t('github.warn')}</span>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-thin">
        {rules.map((rule) => {
          const config = STATUS_CONFIG[rule.status] ?? STATUS_CONFIG.skip;
          const Icon = config.icon;

          return (
            <div key={rule.id} className={`rounded-lg border border-gray-800 overflow-hidden ${config.bg}`}>
              <div className="flex items-start gap-2 px-3 py-2">
                <Icon className={`w-3.5 h-3.5 ${config.color} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-200 font-medium">{rule.name}</span>
                    <span className="text-[9px] text-gray-600 font-mono">{rule.id}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{rule.description}</p>
                  {rule.details && (
                    <p className={`text-[10px] mt-1 ${config.color}`}>{rule.details}</p>
                  )}
                </div>
                <span className={`text-[9px] font-medium uppercase ${config.color}`}>{rule.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBadge({ value }: { value: number }) {
  const color = value >= 80 ? 'text-green-400 border-green-800' : value >= 60 ? 'text-yellow-400 border-yellow-800' : 'text-red-400 border-red-800';
  return (
    <span className={`text-sm font-bold font-mono px-1.5 py-0.5 border rounded ${color}`}>
      {value}%
    </span>
  );
}
