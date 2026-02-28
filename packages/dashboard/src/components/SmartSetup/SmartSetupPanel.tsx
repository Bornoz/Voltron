import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Play, Zap, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useSmartSetupStore } from '../../stores/smartSetupStore';
import { getProjectProfile, type ProjectProfileResponse } from '../../lib/api';
import { ProjectProfile } from './ProjectProfile';
import { DiscoveryResults } from './DiscoveryResults';
import { SetupProgress } from './SetupProgress';

interface SmartSetupPanelProps {
  projectId: string;
}

export function SmartSetupPanel({ projectId }: SmartSetupPanelProps) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ProjectProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [useGithub, setUseGithub] = useState(true);

  const currentRun = useSmartSetupStore((s) => s.currentRun);
  const isLoading = useSmartSetupStore((s) => s.isLoading);
  const error = useSmartSetupStore((s) => s.error);
  const startRun = useSmartSetupStore((s) => s.startRun);
  const toggleRepoSelection = useSmartSetupStore((s) => s.toggleRepoSelection);
  const applySelected = useSmartSetupStore((s) => s.applySelected);
  const reset = useSmartSetupStore((s) => s.reset);

  // Load profile on mount
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    getProjectProfile(projectId)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setProfileLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { reset(); };
  }, [reset]);

  // Also use profile from run if available
  const displayProfile = currentRun?.profile ?? profile;

  const handleStartDiscovery = useCallback(() => {
    startRun(projectId, !useGithub);
  }, [projectId, startRun, useGithub]);

  const handleApply = useCallback(() => {
    if (!currentRun) return;
    applySelected(projectId, currentRun.id);
  }, [projectId, currentRun, applySelected]);

  const handleReset = useCallback(() => {
    reset();
    setProfile(null);
    setProfileLoading(true);
    getProjectProfile(projectId)
      .then((p) => setProfile(p))
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [projectId, reset]);

  const selectedCount = currentRun?.discoveries.filter((d) => d.selected).length ?? 0;
  const isTerminal = currentRun && ['ready', 'completed', 'failed'].includes(currentRun.status);
  const showDiscoveries = currentRun?.status === 'ready' && currentRun.discoveries.length > 0;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {t('smartSetup.title')}
          </h2>
        </div>
        {currentRun && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded hover:bg-gray-700 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <RotateCcw className="w-3 h-3" />
            {t('executionControls.reset')}
          </button>
        )}
      </div>

      <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
        {t('smartSetup.subtitle')}
      </p>

      {/* STEP 1: Project Profile */}
      {displayProfile && !profileLoading && (
        <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--glass-border)' }}>
          <ProjectProfile profile={displayProfile} />
        </div>
      )}

      {profileLoading && !displayProfile && (
        <div className="text-center py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {t('smartSetup.analyzing')}
        </div>
      )}

      {/* GitHub toggle + Start button */}
      {!currentRun && (
        <div className="space-y-3">
          {/* GitHub Discovery checkbox — %100 fonksiyonel */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useGithub}
              onChange={(e) => setUseGithub(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 accent-blue-500 cursor-pointer"
            />
            <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {t('smartSetup.useGithub')}
            </span>
          </label>

          {!useGithub && (
            <p className="text-[10px] px-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('smartSetup.skipGithubHint')}
            </p>
          )}

          <button
            onClick={handleStartDiscovery}
            disabled={isLoading || profileLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            <Play className="w-3.5 h-3.5" />
            {t('smartSetup.startDiscovery')}
          </button>
        </div>
      )}

      {/* STEP 2: Progress */}
      {currentRun && !isTerminal && (
        <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--glass-border)' }}>
          <SetupProgress
            status={currentRun.status}
            error={currentRun.error}
            appliedCount={currentRun.appliedCount}
          />
        </div>
      )}

      {/* Error state */}
      {currentRun?.status === 'failed' && (
        <SetupProgress status="failed" error={currentRun.error} appliedCount={0} />
      )}

      {/* Completed state */}
      {currentRun?.status === 'completed' && (
        <SetupProgress status="completed" error={null} appliedCount={currentRun.appliedCount} />
      )}

      {/* STEP 3: Discovery Results */}
      {showDiscoveries && (
        <div className="rounded-lg p-3 border" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--glass-border)' }}>
          <DiscoveryResults
            discoveries={currentRun.discoveries}
            onToggle={toggleRepoSelection}
          />
        </div>
      )}

      {/* Ready state — profile only, no GitHub */}
      {currentRun?.status === 'ready' && currentRun.discoveries.length === 0 && (
        <div className="rounded-lg p-3 border text-center" style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--glass-border)' }}>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {t('smartSetup.profileOnly')}
          </p>
        </div>
      )}

      {/* Apply button */}
      {showDiscoveries && selectedCount > 0 && (
        <button
          onClick={handleApply}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff' }}
        >
          <Zap className="w-3.5 h-3.5" />
          {t('smartSetup.applySelected')} ({selectedCount})
        </button>
      )}

      {/* Global error */}
      {error && !currentRun && (
        <div className="p-2 rounded-lg bg-red-900/20 border border-red-700/30">
          <p className="text-[11px] text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}
