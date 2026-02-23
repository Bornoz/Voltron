import { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, Shield, Zap, RefreshCw, Loader2 } from 'lucide-react';
import * as api from '../../lib/api';
import { useTranslation } from '../../i18n';
import { formatRelativeTime } from '../../lib/formatters';

interface BehaviorPanelProps {
  projectId: string;
}

const SCORE_COLORS = {
  excellent: { text: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-800' },
  good: { text: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-800' },
  warning: { text: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-800' },
  danger: { text: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-800' },
};

function getScoreLevel(score: number) {
  if (score >= 80) return SCORE_COLORS.excellent;
  if (score >= 60) return SCORE_COLORS.good;
  if (score >= 40) return SCORE_COLORS.warning;
  return SCORE_COLORS.danger;
}

function ScoreGauge({ label, score, icon: Icon }: { label: string; score: number; icon: typeof Brain }) {
  const colors = getScoreLevel(score);
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded border ${colors.bg} ${colors.border}`}>
      <Icon className={`w-3.5 h-3.5 ${colors.text} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-500">{label}</div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
          <span className={`text-xs font-mono font-bold ${colors.text}`}>{score}</span>
        </div>
      </div>
    </div>
  );
}

export function BehaviorPanel({ projectId }: BehaviorPanelProps) {
  const { t } = useTranslation();
  const [latest, setLatest] = useState<api.BehaviorScore | null>(null);
  const [history, setHistory] = useState<api.BehaviorScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [latestData, historyData] = await Promise.all([
        api.getBehaviorLatest(projectId),
        api.getBehaviorScores(projectId, 20),
      ]);
      setLatest(latestData);
      setHistory(historyData);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleScore = async () => {
    setScoring(true);
    try {
      const score = await api.triggerBehaviorScore(projectId);
      setLatest(score);
      load();
    } catch {
      // silent
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      </div>
    );
  }

  const overall = latest?.overallScore ?? 0;
  const overallColors = getScoreLevel(overall);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/30">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-gray-300">{t('behavior.title')}</span>
        </div>
        <button
          onClick={handleScore}
          disabled={scoring}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
        >
          {scoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {t('behavior.calculate')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Overall score */}
        <div className={`text-center py-3 rounded-lg border ${overallColors.bg} ${overallColors.border}`}>
          <div className="text-[10px] text-gray-500 mb-1">{t('behavior.overallScore')}</div>
          <div className={`text-3xl font-bold font-mono ${overallColors.text}`}>{overall}</div>
          <div className={`text-[10px] ${overallColors.text}`}>/ 100</div>
        </div>

        {/* Score breakdown */}
        <div className="space-y-1.5">
          <ScoreGauge label={t('behavior.riskScore')} score={latest?.riskScore ?? 0} icon={Shield} />
          <ScoreGauge label={t('behavior.velocityScore')} score={latest?.velocityScore ?? 0} icon={Zap} />
          <ScoreGauge label={t('behavior.complianceScore')} score={latest?.complianceScore ?? 0} icon={Shield} />
        </div>

        {/* Details */}
        {latest?.details && (
          <div className="text-[10px] space-y-1">
            <div className="text-gray-500 font-semibold">{t('behavior.details')}</div>
            <div className="flex justify-between text-gray-400">
              <span>{t('behavior.totalActions')}</span>
              <span className="font-mono">{latest.totalActions}</span>
            </div>
            {latest.details.actionsPerMinute != null && (
              <div className="flex justify-between text-gray-400">
                <span>{t('behavior.actionsPerMin')}</span>
                <span className="font-mono">{String(latest.details.actionsPerMinute)}/min</span>
              </div>
            )}
            {latest.details.zoneViolations != null && (
              <div className="flex justify-between text-gray-400">
                <span>{t('behavior.zoneViolations')}</span>
                <span className="font-mono text-red-400">{String(latest.details.zoneViolations)}</span>
              </div>
            )}
          </div>
        )}

        {/* History trend */}
        {history.length > 1 && (
          <div>
            <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
              <TrendingUp className="w-3 h-3" />
              {t('behavior.trend')}
            </div>
            <div className="flex items-end gap-0.5 h-12">
              {history.slice(0, 20).reverse().map((s, i) => {
                const h = Math.max(4, (s.overallScore / 100) * 48);
                const color = s.overallScore >= 80 ? 'bg-green-500' : s.overallScore >= 60 ? 'bg-blue-500' : s.overallScore >= 40 ? 'bg-yellow-500' : 'bg-red-500';
                return (
                  <div
                    key={s.id}
                    className={`flex-1 rounded-t ${color} opacity-70 hover:opacity-100 transition-opacity`}
                    style={{ height: `${h}px` }}
                    title={`${s.overallScore}/100 - ${formatRelativeTime(s.windowEnd)}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {!latest?.overallScore && history.length === 0 && (
          <div className="text-center py-4 text-xs text-gray-600">{t('behavior.noData')}</div>
        )}
      </div>
    </div>
  );
}
