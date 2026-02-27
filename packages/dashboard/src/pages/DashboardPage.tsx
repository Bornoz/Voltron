import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, AlertCircle, GitBranch, GitCommit, Brain, FileText, Bot, LogOut, Settings } from 'lucide-react';
import type { ProjectConfig } from '@voltron/shared';
import * as api from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useEventStream } from '../hooks/useEventStream';
import { useKeyboard } from '../hooks/useKeyboard';
import { useControlStore } from '../stores/controlStore';
import { useEventStore } from '../stores/eventStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useAgentStore } from '../stores/agentStore';
import { useAgentStream } from '../hooks/useAgentStream';
import { useAgentHydration } from '../hooks/useAgentHydration';
import { useFileTreeStore } from '../stores/fileTreeStore';
import { useAuthStore } from '../stores/authStore';
import { useLanguageStore } from '../stores/languageStore';
import { MainLayout } from '../components/Layout/MainLayout';
import { ActionFeed } from '../components/ActionFeed/ActionFeed';
import { InterceptorStatus } from '../components/InterceptorStatus/InterceptorStatus';
import { ExecutionControls } from '../components/ControlPanel/ExecutionControls';
import { RiskGauge } from '../components/ControlPanel/RiskGauge';
import { RiskTimeline } from '../components/ControlPanel/RiskTimeline';
import { StateHistory } from '../components/ControlPanel/StateHistory';
import { ProjectStats } from '../components/Stats/ProjectStats';
import { ActivityChart } from '../components/Stats/ActivityChart';
import { RiskBreakdown } from '../components/Stats/RiskBreakdown';
import { Spinner } from '../components/common/Spinner';
import { AgentControlBar } from '../components/Agent/AgentControlBar';
import { GPSTracker } from '../components/Agent/GPSTracker';
import { PlanViewer } from '../components/Agent/PlanViewer';
import { CommandPalette } from '../components/Agent/CommandPalette';
import { KeyboardShortcuts } from '../components/Agent/KeyboardShortcuts';
import { StatusBar } from '../components/Agent/StatusBar';
import { SettingsModal } from '../components/Agent/SettingsModal';
import { PromptHistory } from '../components/Agent/PromptHistory';
import { WelcomeTour } from '../components/Agent/WelcomeTour';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useTranslation } from '../i18n';

// Lazy-loaded heavy tab components for chunk splitting
const RepoAnalyzer = lazy(() => import('../components/GitHubReport/RepoAnalyzer').then(m => ({ default: m.RepoAnalyzer })));
const SnapshotBrowser = lazy(() => import('../components/Snapshots/SnapshotBrowser').then(m => ({ default: m.SnapshotBrowser })));
const BehaviorPanel = lazy(() => import('../components/BehaviorScore/BehaviorPanel').then(m => ({ default: m.BehaviorPanel })));
const PromptManager = lazy(() => import('../components/PromptVersioning/PromptManager').then(m => ({ default: m.PromptManager })));
const AgentWorkspace = lazy(() => import('../components/Agent/AgentWorkspace').then(m => ({ default: m.AgentWorkspace })));
const SpawnDialog = lazy(() => import('../components/Agent/SpawnDialog').then(m => ({ default: m.SpawnDialog })));

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [centerTab, setCenterTab] = useState<'feed' | 'github' | 'snapshots' | 'behavior' | 'prompts' | 'agent'>('feed');
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);
  const [spawnDefaultConfig, setSpawnDefaultConfig] = useState<{ model?: string; prompt?: string; targetDir?: string } | undefined>();
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPromptHistory, setShowPromptHistory] = useState(false);
  const [showWelcomeTour, setShowWelcomeTour] = useState(() => !localStorage.getItem('voltron_tour_completed'));

  const projectId = selectedProject?.id ?? null;

  // Hooks
  const { status, client } = useWebSocket(projectId);
  useEventStream(client);
  useAgentStream(client);
  useAgentHydration(projectId);
  useKeyboard(projectId);

  // Global keyboard shortcuts: Ctrl+K (command palette) and ? (shortcuts)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K — Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }
      // ? — Keyboard Shortcuts (only when not typing)
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '?' && !isInput && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const logout = useAuthStore((s) => s.logout);
  const agentStatus = useAgentStore((s) => s.status);
  const agentLocation = useAgentStore((s) => s.location);
  const setAgentCurrentFile = useFileTreeStore((s) => s.setAgentCurrentFile);

  // Sync agent location to file tree
  useEffect(() => {
    if (agentLocation) {
      setAgentCurrentFile(agentLocation.filePath);
    }
  }, [agentLocation, setAgentCurrentFile]);

  const executionState = useControlStore((s) => s.executionState);
  const setState = useControlStore((s) => s.setState);
  const setHistory = useControlStore((s) => s.setHistory);
  const allNotifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const notifications = allNotifications.filter((n) => !n.dismissed);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProjects();
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.failedToLoadProjects'));
    } finally {
      setLoading(false);
    }
  }, [selectedProject, t]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load control state when project changes
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const [stateResult, historyResult] = await Promise.all([
          api.getControlState(projectId),
          api.getControlHistory(projectId),
        ]);
        setState(stateResult.state, stateResult.context);
        setHistory(historyResult);
      } catch {
        // Server might not be running yet
      }
    })();
  }, [projectId, setState, setHistory]);

  // Load initial events
  const addEvents = useEventStore((s) => s.addEvents);
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const events = await api.getActions(projectId, { limit: 200 });
        addEvents(events);
      } catch {
        // Server might not be running yet
      }
    })();
  }, [projectId, addEvents]);

  // Language hooks — MUST be before conditional returns (Rules of Hooks)
  const setLangDirect = useLanguageStore((s) => s.setLanguage);
  const currentLang = useLanguageStore((s) => s.language);

  const handleCommandPaletteAction = useCallback((action: string, _data?: Record<string, unknown>) => {
    switch (action) {
      case 'pause': if (projectId) api.agentStop(projectId).catch(() => {}); break;
      case 'resume': if (projectId) api.agentResume(projectId).catch(() => {}); break;
      case 'stop': if (projectId) api.agentKill(projectId).catch(() => {}); break;
      case 'spawn': setShowSpawnDialog(true); break;
      case 'showShortcuts': setShowShortcuts(true); break;
      case 'openSettings': setShowSettings(true); break;
      case 'promptHistory': setShowPromptHistory(true); break;
      case 'switchLanguage': setLangDirect(currentLang === 'tr' ? 'en' : 'tr'); break;
    }
  }, [projectId, currentLang, setLangDirect]);

  // Loading screen
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <p className="text-gray-400 text-sm">{t('app.loadingVoltron')}</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error && projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-200 mb-2">{t('app.connectionError')}</h1>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={loadProjects}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm"
          >
            {t('app.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Agent action handlers
  const handleAgentSpawn = async (config: { model: string; prompt: string; targetDir: string }) => {
    if (!projectId) return;
    try {
      await api.agentSpawn(projectId, config);
      setShowSpawnDialog(false);
    } catch {
      // Error will come through WS
    }
  };

  const handleAgentPause = () => {
    if (!projectId) return;
    api.agentStop(projectId).catch(() => {});
  };

  const handleAgentResume = () => {
    if (!projectId) return;
    api.agentResume(projectId).catch(() => {});
  };

  const handleAgentKill = () => {
    if (!projectId) return;
    api.agentKill(projectId).catch(() => {});
  };

  const handleAgentInject = (prompt: string, context?: { filePath?: string; constraints?: string[] }) => {
    if (!projectId) return;
    api.agentInject(projectId, { prompt, context }).catch(() => {});
  };

  // Center content
  const centerContent = (
    <div className="flex flex-col h-full">
      {/* Project selector bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800 bg-gray-900/30">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{t('app.project')}</span>
        <div className="relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center gap-2 px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded hover:border-gray-600 transition-colors"
          >
            <span className="text-gray-300">{selectedProject?.name ?? t('app.select')}</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
          {showProjectDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProject(p);
                    setShowProjectDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-700 transition-colors ${
                    p.id === selectedProject?.id ? 'text-blue-400' : 'text-gray-300'
                  }`}
                >
                  {p.name}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-500">{t('app.noProjects')}</div>
              )}
            </div>
          )}
        </div>

        {/* Center tabs */}
        <div className="flex items-center gap-1 ml-auto" role="tablist" aria-label="Dashboard tabs">
          <button
            id="tab-feed"
            role="tab"
            aria-selected={centerTab === 'feed'}
            onClick={() => setCenterTab('feed')}
            className={`px-2 py-1 text-[10px] rounded transition-colors ${
              centerTab === 'feed' ? 'bg-blue-900/50 text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t('app.actionFeed')}
          </button>
          <button
            id="tab-github"
            role="tab"
            aria-selected={centerTab === 'github'}
            onClick={() => setCenterTab('github')}
            className={`px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1 ${
              centerTab === 'github' ? 'bg-blue-900/50 text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <GitBranch className="w-3 h-3" />
            {t('app.github')}
          </button>
          <button
            id="tab-snapshots"
            role="tab"
            aria-selected={centerTab === 'snapshots'}
            onClick={() => setCenterTab('snapshots')}
            className={`px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1 ${
              centerTab === 'snapshots' ? 'bg-blue-900/50 text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <GitCommit className="w-3 h-3" />
            {t('app.snapshots')}
          </button>
          <button
            id="tab-behavior"
            role="tab"
            aria-selected={centerTab === 'behavior'}
            onClick={() => setCenterTab('behavior')}
            className={`px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1 ${
              centerTab === 'behavior' ? 'bg-purple-900/50 text-purple-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Brain className="w-3 h-3" />
            {t('app.behavior')}
          </button>
          <button
            id="tab-prompts"
            role="tab"
            aria-selected={centerTab === 'prompts'}
            onClick={() => setCenterTab('prompts')}
            className={`px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1 ${
              centerTab === 'prompts' ? 'bg-indigo-900/50 text-indigo-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <FileText className="w-3 h-3" />
            {t('app.prompts')}
          </button>
          <button
            id="tab-agent"
            role="tab"
            aria-selected={centerTab === 'agent'}
            onClick={() => setCenterTab('agent')}
            className={`px-2 py-1 text-[10px] rounded transition-colors flex items-center gap-1 ${
              centerTab === 'agent' ? 'bg-green-900/50 text-green-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Bot className="w-3 h-3" />
            {t('agent.tab')}
            {agentStatus !== 'IDLE' && agentStatus !== 'COMPLETED' && agentStatus !== 'CRASHED' && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title={t('login.signOut')}
            className="ml-2 p-1 text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden" role="tabpanel" aria-labelledby={`tab-${centerTab}`}>
        <ErrorBoundary resetKeys={[centerTab, projectId]}>
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner size="md" /></div>}>
            {centerTab === 'feed' && <ActionFeed />}
            {centerTab === 'github' && projectId && <RepoAnalyzer projectId={projectId} />}
            {centerTab === 'github' && !projectId && (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">
                {t('app.selectProjectFirst')}
              </div>
            )}
            {centerTab === 'snapshots' && projectId && <SnapshotBrowser projectId={projectId} />}
            {centerTab === 'snapshots' && !projectId && (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">
                {t('app.selectProjectFirst')}
              </div>
            )}
            {centerTab === 'behavior' && projectId && <BehaviorPanel projectId={projectId} />}
            {centerTab === 'behavior' && !projectId && (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">
                {t('app.selectProjectFirst')}
              </div>
            )}
            {centerTab === 'prompts' && projectId && <PromptManager projectId={projectId} />}
            {centerTab === 'prompts' && !projectId && (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">
                {t('app.selectProjectFirst')}
              </div>
            )}
            {centerTab === 'agent' && projectId && (
              <AgentWorkspace
                projectId={projectId}
                onSpawn={(config?: { model?: string; prompt?: string; targetDir?: string }) => {
                  setSpawnDefaultConfig(config);
                  setShowSpawnDialog(true);
                }}
                onPause={handleAgentPause}
                onResume={handleAgentResume}
                onKill={handleAgentKill}
                onInject={handleAgentInject}
              />
            )}
            {centerTab === 'agent' && !projectId && (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">
                {t('app.selectProjectFirst')}
              </div>
            )}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );

  // Right panel content
  const rightContent = (
    <>
      {/* Agent Control - show mini widgets only when NOT on agent tab */}
      {projectId && centerTab !== 'agent' && (
        <div className="space-y-2 p-2 border-b border-gray-800">
          <AgentControlBar
            onSpawn={() => { setSpawnDefaultConfig(undefined); setShowSpawnDialog(true); }}
            onPause={handleAgentPause}
            onResume={handleAgentResume}
            onKill={handleAgentKill}
          />
          {agentStatus !== 'IDLE' && agentStatus !== 'COMPLETED' && agentStatus !== 'CRASHED' && (
            <>
              <div className="px-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('agent.gpsTracker')}</div>
                <GPSTracker />
              </div>
              <div className="px-1">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t('agent.plan')}</div>
                <PlanViewer />
              </div>
            </>
          )}
        </div>
      )}

      {projectId && <InterceptorStatus projectId={projectId} />}
      <ExecutionControls projectId={projectId} />
      <RiskGauge />
      <RiskTimeline />
      <StateHistory />
      <ActivityChart />
      <RiskBreakdown />
      <ProjectStats />
    </>
  );

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-hidden">
        <MainLayout
          projectId={projectId}
          projectName={selectedProject?.name ?? null}
          executionState={executionState}
          connectionStatus={status}
          centerContent={centerContent}
          rightContent={rightContent}
        />
      </div>

      {/* Status Bar */}
      <StatusBar wsConnected={status === 'connected'} projectId={projectId} />

      {/* Spawn Dialog */}
      {showSpawnDialog && projectId && (
        <Suspense fallback={null}>
          <SpawnDialog
            projectId={projectId}
            defaultConfig={spawnDefaultConfig}
            onSpawn={handleAgentSpawn}
            onClose={() => { setShowSpawnDialog(false); setSpawnDefaultConfig(undefined); }}
          />
        </Suspense>
      )}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onAgentAction={handleCommandPaletteAction}
      />

      {/* Keyboard Shortcuts (?) */}
      <KeyboardShortcuts
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Prompt History */}
      <PromptHistory
        isOpen={showPromptHistory}
        onClose={() => setShowPromptHistory(false)}
        onSelect={(prompt) => {
          setShowPromptHistory(false);
          if (projectId) {
            setSpawnDefaultConfig({ prompt });
            setShowSpawnDialog(true);
          }
        }}
      />

      {/* Welcome Tour (first visit) */}
      <WelcomeTour
        isOpen={showWelcomeTour}
        onClose={() => setShowWelcomeTour(false)}
      />

      {/* Notification toasts */}
      {notifications.length > 0 && (
        <div className="fixed bottom-10 right-4 z-50 space-y-2 max-w-sm">
          {notifications.slice(0, 5).map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-2 p-3 rounded-lg border shadow-lg ${
                n.type === 'error'
                  ? 'bg-red-900/90 border-red-700 text-red-100'
                  : n.type === 'warning'
                    ? 'bg-yellow-900/90 border-yellow-700 text-yellow-100'
                    : n.type === 'success'
                      ? 'bg-green-900/90 border-green-700 text-green-100'
                      : 'bg-gray-800/90 border-gray-700 text-gray-100'
              }`}
            >
              <div className="flex-1">
                <p className="text-xs font-semibold">{n.title}</p>
                <p className="text-[11px] opacity-80">{n.message}</p>
              </div>
              <button
                onClick={() => dismiss(n.id)}
                className="text-current opacity-50 hover:opacity-100"
              >
                <span className="text-xs">X</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
