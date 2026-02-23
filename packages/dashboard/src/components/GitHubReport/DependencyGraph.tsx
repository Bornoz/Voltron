import { Package, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface Dependency {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency';
  outdated?: boolean;
  latestVersion?: string;
  hasVulnerability?: boolean;
}

interface DependencyGraphProps {
  data?: {
    dependencies?: Dependency[];
    conflicts?: Array<{ name: string; versions: string[] }>;
    totalDeps?: number;
    outdatedCount?: number;
  };
}

export function DependencyGraph({ data }: DependencyGraphProps) {
  const { t } = useTranslation();

  if (!data || !data.dependencies) {
    return <EmptyDeps />;
  }

  const { dependencies, conflicts, totalDeps, outdatedCount } = data;

  // Separate by type
  const prod = dependencies.filter((d) => d.type === 'dependency');
  const dev = dependencies.filter((d) => d.type === 'devDependency');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={t('github.total')} value={totalDeps ?? dependencies.length} />
        <StatCard label={t('github.outdated')} value={outdatedCount ?? dependencies.filter((d) => d.outdated).length} color="text-yellow-400" />
        <StatCard label={t('github.conflicts')} value={conflicts?.length ?? 0} color={conflicts && conflicts.length > 0 ? 'text-red-400' : 'text-green-400'} />
      </div>

      {/* Conflicts */}
      {conflicts && conflicts.length > 0 && (
        <div className="border border-red-800 rounded-lg p-2">
          <h5 className="text-[10px] text-red-400 font-semibold uppercase mb-1">{t('github.versionConflicts')}</h5>
          {conflicts.map((c) => (
            <div key={c.name} className="flex items-center gap-2 py-1">
              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
              <span className="text-[11px] text-gray-300 font-mono">{c.name}</span>
              <div className="flex items-center gap-1">
                {c.versions.map((v, i) => (
                  <span key={i}>
                    <span className="text-[10px] text-red-300">{v}</span>
                    {i < c.versions.length - 1 && <span className="text-gray-600 mx-0.5">vs</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Production deps */}
      <DepSection title={t('github.dependencies')} deps={prod} />

      {/* Dev deps */}
      <DepSection title={t('github.devDependencies')} deps={dev} />
    </div>
  );
}

function DepSection({ title, deps }: { title: string; deps: Dependency[] }) {
  if (deps.length === 0) return null;

  return (
    <div>
      <h5 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
        {title} ({deps.length})
      </h5>
      <div className="space-y-0.5 max-h-48 overflow-y-auto scrollbar-thin">
        {deps.map((dep) => (
          <div key={dep.name} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800/50">
            <Package className="w-3 h-3 text-gray-600 shrink-0" />
            <span className="text-[11px] text-gray-300 font-mono flex-1 truncate">{dep.name}</span>
            <span className="text-[10px] text-gray-500 font-mono">{dep.version}</span>
            {dep.outdated && dep.latestVersion && (
              <>
                <ArrowRight className="w-2.5 h-2.5 text-yellow-600" />
                <span className="text-[10px] text-yellow-400 font-mono">{dep.latestVersion}</span>
              </>
            )}
            {dep.hasVulnerability && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
            {!dep.outdated && !dep.hasVulnerability && <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-gray-200' }: { label: string; value: number; color?: string }) {
  return (
    <div className="border border-gray-800 rounded-lg p-2 text-center">
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
      <div className="text-[9px] text-gray-600 uppercase">{label}</div>
    </div>
  );
}

function EmptyDeps() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-8">
      <Package className="w-6 h-6 text-gray-700 mx-auto mb-2" />
      <p className="text-xs text-gray-600">{t('github.noDependencyData')}</p>
    </div>
  );
}
