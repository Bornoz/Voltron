import { useState, useEffect, useCallback } from 'react';
import { Brain, TrendingUp, Shield, Zap, RefreshCw, Loader2, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
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
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
      <Icon className={`w-4 h-4 ${colors.text} shrink-0`} />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
            />
          </div>
          <span className={`text-sm font-mono font-bold ${colors.text} w-8 text-right`}>{score}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Metric descriptions for empty state ─── */

const METRIC_INFO = [
  {
    icon: Shield,
    title: 'Risk Puanı',
    desc: 'Agent aksiyonlarının risk seviyesini ölçer. Düşük riskli aksiyonlar yüksek puan alır.',
    color: 'text-blue-400',
  },
  {
    icon: Zap,
    title: 'Hız Puanı',
    desc: 'Agent\'ın aksiyon hızını değerlendirir. Çok hızlı veya çok yavaş olması puan düşürür.',
    color: 'text-yellow-400',
  },
  {
    icon: Shield,
    title: 'Uyumluluk Puanı',
    desc: 'Koruma bölgesi ihlallerini takip eder. İhlal yoksa tam puan alır.',
    color: 'text-green-400',
  },
];

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
      if (score) setLatest(score);
      await load();
    } catch {
      // silent
    } finally {
      setScoring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
      </div>
    );
  }

  // Determine if we have real data (not just the default zeros from API)
  const hasRealData = !!(latest?.id || latest?.totalActions || history.length > 0);
  const overall = latest?.overallScore ?? 0;
  const overallColors = getScoreLevel(overall);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{t('behavior.title')}</span>
        </div>
        <button
          onClick={handleScore}
          disabled={scoring}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {scoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {t('behavior.calculate')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {hasRealData ? (
          /* ── Active State: Real data available ── */
          <>
            {/* Overall score */}
            <div className="text-center py-4 rounded-lg" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div className="text-[10px] mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('behavior.overallScore')}</div>
              <div className={`text-4xl font-bold font-mono ${overallColors.text}`}>{overall}</div>
              <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>/ 100</div>
            </div>

            {/* Score breakdown */}
            <div className="space-y-2">
              <ScoreGauge label={t('behavior.riskScore')} score={latest?.riskScore ?? 0} icon={Shield} />
              <ScoreGauge label={t('behavior.velocityScore')} score={latest?.velocityScore ?? 0} icon={Zap} />
              <ScoreGauge label={t('behavior.complianceScore')} score={latest?.complianceScore ?? 0} icon={Shield} />
            </div>

            {/* Details */}
            {latest?.details && (
              <div className="text-[11px] space-y-1.5 px-1">
                <div className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>{t('behavior.details')}</div>
                <div className="flex justify-between" style={{ color: 'var(--color-text-muted)' }}>
                  <span>{t('behavior.totalActions')}</span>
                  <span className="font-mono font-medium" style={{ color: 'var(--color-text-secondary)' }}>{latest.totalActions}</span>
                </div>
                {latest.details.actionsPerMinute != null && (
                  <div className="flex justify-between" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{t('behavior.actionsPerMin')}</span>
                    <span className="font-mono font-medium" style={{ color: 'var(--color-text-secondary)' }}>{String(latest.details.actionsPerMinute)}/min</span>
                  </div>
                )}
                {latest.details.zoneViolations != null && (
                  <div className="flex justify-between" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{t('behavior.zoneViolations')}</span>
                    <span className="font-mono font-medium text-red-400">{String(latest.details.zoneViolations)}</span>
                  </div>
                )}
              </div>
            )}

            {/* History trend */}
            {history.length > 1 && (
              <div>
                <div className="flex items-center gap-1 text-[10px] mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  <TrendingUp className="w-3 h-3" />
                  {t('behavior.trend')}
                </div>
                <div className="flex items-end gap-0.5 h-14 px-1">
                  {history.slice(0, 20).reverse().map((s) => {
                    const h = Math.max(4, (s.overallScore / 100) * 52);
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
          </>
        ) : (
          /* ── Empty State: Informative explanation ── */
          <div className="space-y-4 py-2">
            {/* What is this panel */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                AI Davranış Analizi
              </h3>
              <p className="text-[11px] leading-relaxed px-2" style={{ color: 'var(--color-text-muted)' }}>
                Agent aksiyonlarını gerçek zamanlı analiz eder. Risk, hız ve uyumluluk puanları ile AI davranışını izlersiniz.
              </p>
            </div>

            {/* Metric descriptions */}
            <div className="space-y-2">
              {METRIC_INFO.map((m) => (
                <div
                  key={m.title}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                >
                  <m.icon className={`w-4 h-4 ${m.color} shrink-0 mt-0.5`} />
                  <div>
                    <div className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>{m.title}</div>
                    <div className="text-[10px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="px-3 py-2.5 rounded-lg" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nasıl Çalışır?</span>
              </div>
              <div className="space-y-1.5 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>1</span>
                  <span>Agent çalışırken aksiyonlar otomatik loglanır</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>2</span>
                  <span>Her 5 dakikada davranış puanı hesaplanır</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>3</span>
                  <span>Trend grafik ile geçmiş performans takip edilir</span>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                Agent aktif olduğunda veriler otomatik oluşacak
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
