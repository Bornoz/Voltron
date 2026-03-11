import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Sparkles, Shield, AlertTriangle, Zap, Activity } from 'lucide-react';
import * as api from '../../lib/api';
import { useTranslation } from '../../i18n';
import { useWindowStore } from '../../stores/windowStore';

interface DemoBannerProps {
  variant: 'full' | 'compact';
  onDemoStarted?: (sessionId: string) => void;
  onDemoStopped?: () => void;
}

export function DemoBanner({ variant, onDemoStarted, onDemoStopped }: DemoBannerProps) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);

  // Poll demo status while running
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      try {
        const status = await api.getDemoStatus();
        setRunning(status.running);
        if (status.phase != null) setPhase(status.phase);
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [running]);

  const applyPreset = useWindowStore((s) => s.applyPreset);

  const handleStart = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.startDemo();
      setRunning(result.running);
      if (result.running && result.sessionId) {
        onDemoStarted?.(result.sessionId);
        applyPreset('gps-focus');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [applyPreset, onDemoStarted]);

  const handleStop = useCallback(async () => {
    try {
      await api.stopDemo();
      setRunning(false);
      setPhase(0);
      onDemoStopped?.();
    } catch {
      // ignore
    }
  }, [onDemoStopped]);

  const phases = [
    { icon: <Zap className="w-3 h-3" />, label: t('demo.phaseProjectSetup'), color: 'text-blue-400' },
    { icon: <Activity className="w-3 h-3" />, label: t('demo.phaseBuilding'), color: 'text-green-400' },
    { icon: <AlertTriangle className="w-3 h-3" />, label: t('demo.phaseConfigChanges'), color: 'text-yellow-400' },
    { icon: <Shield className="w-3 h-3" />, label: t('demo.phaseCritical'), color: 'text-red-400' },
    { icon: <Sparkles className="w-3 h-3" />, label: t('demo.phaseCascadeAttack'), color: 'text-purple-400' },
  ];

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        {running ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-green-400 font-medium">{t('demo.running')}</span>
              {phases[phase] && (
                <span className={`text-[10px] ${phases[phase].color}`}>
                  — {phases[phase].label}
                </span>
              )}
            </div>
            <button
              onClick={handleStop}
              className="ml-auto px-2 py-1 text-[10px] rounded-md bg-red-900/30 border border-red-900/40 text-red-400 hover:bg-red-900/50 transition-colors"
            >
              <Square className="w-3 h-3 inline mr-1" />
              {t('demo.stop')}
            </button>
          </>
        ) : (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20
              text-purple-300 hover:from-purple-500/20 hover:to-blue-500/20 hover:text-purple-200"
          >
            <Play className="w-3.5 h-3.5" />
            {loading ? t('demo.starting') : t('demo.tryDemo')}
          </button>
        )}
      </div>
    );
  }

  // Full variant — hero-style CTA
  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      {running ? (
        <>
          {/* Demo running state */}
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 flex items-center justify-center">
              <Activity className="w-8 h-8 text-green-400 animate-pulse" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 animate-ping" />
          </div>

          <h3 className="text-lg font-semibold text-gray-200 mb-2">{t('demo.inProgress')}</h3>
          <p className="text-sm text-gray-400 mb-4 max-w-md">
            {t('demo.inProgressDesc')}
          </p>

          {/* Phase progress */}
          <div className="flex items-center gap-1 mb-6">
            {phases.map((p, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-all ${
                  i === phase
                    ? `${p.color} bg-white/[0.06] border border-white/[0.1] font-medium`
                    : i < phase
                      ? 'text-gray-500 line-through'
                      : 'text-gray-600'
                }`}
              >
                {p.icon}
                {p.label}
              </div>
            ))}
          </div>

          <button
            onClick={handleStop}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all
              bg-red-900/20 border border-red-900/30 text-red-400 hover:bg-red-900/30"
          >
            <Square className="w-3.5 h-3.5 inline mr-1.5" />
            {t('demo.stopDemo')}
          </button>
        </>
      ) : (
        <>
          {/* Idle — CTA to start demo */}
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center
              shadow-[0_0_40px_rgba(168,85,247,0.15)]">
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-gray-200 mb-2">{t('demo.seeInAction')}</h3>
          <p className="text-sm text-gray-400 mb-2 max-w-md">
            {t('demo.seeInActionDesc1')}
          </p>
          <p className="text-xs text-gray-500 mb-6 max-w-sm">
            {t('demo.seeInActionDesc2')}
          </p>

          <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
              bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500
              text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30
              active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {loading ? t('demo.startingDemo') : t('demo.tryInteractiveDemo')}
          </button>
          <span className="text-[10px] text-gray-600 mt-2">{t('demo.zeroTokens')}</span>
        </>
      )}
    </div>
  );
}
