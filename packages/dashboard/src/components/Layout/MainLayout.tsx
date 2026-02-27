import { useState, useEffect, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { useTranslation } from '../../i18n';
import type { ConnectionStatus } from '../../lib/ws';
import type { ExecutionState } from '@voltron/shared';

interface MainLayoutProps {
  projectId: string | null;
  projectName: string | null;
  executionState: ExecutionState;
  connectionStatus: ConnectionStatus;
  centerContent: ReactNode;
  rightContent: ReactNode;
  agentFullscreen?: boolean;
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export function MainLayout({
  projectId,
  projectName,
  executionState,
  connectionStatus,
  centerContent,
  rightContent,
  agentFullscreen = false,
  onOpenSettings,
  onLogout,
}: MainLayoutProps) {
  const { t } = useTranslation();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Auto-collapse panels when agent fullscreen
  useEffect(() => {
    if (agentFullscreen) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [agentFullscreen]);

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <Header
        projectName={projectName}
        executionState={executionState}
        connectionStatus={connectionStatus}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
      />

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={`relative transition-all duration-300 ease-in-out ${
            leftCollapsed ? 'w-0 overflow-hidden' : 'w-[280px]'
          }`}
          style={{ borderRight: '1px solid var(--glass-border)' }}
        >
          <Sidebar projectId={projectId} />
        </div>

        {/* Left toggle button */}
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="flex items-center justify-center w-5 shrink-0 transition-colors"
          style={{ color: 'var(--color-text-muted)', borderRight: '1px solid var(--glass-border)' }}
          title={leftCollapsed ? t('layout.showSidebar') : t('layout.hideSidebar')}
        >
          {leftCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Center content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {centerContent}
        </div>

        {/* Right toggle button */}
        <button
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="flex items-center justify-center w-5 shrink-0 transition-colors"
          style={{ color: 'var(--color-text-muted)', borderLeft: '1px solid var(--glass-border)' }}
          title={rightCollapsed ? t('layout.showPanel') : t('layout.hidePanel')}
        >
          {rightCollapsed ? (
            <PanelRightOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelRightClose className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Right Panel */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-y-auto ${
            rightCollapsed ? 'w-0 overflow-hidden' : 'w-[320px]'
          }`}
          style={{ borderLeft: '1px solid var(--glass-border)' }}
        >
          <div className="p-3 space-y-3">
            {rightContent}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar connectionStatus={connectionStatus} />
    </div>
  );
}
