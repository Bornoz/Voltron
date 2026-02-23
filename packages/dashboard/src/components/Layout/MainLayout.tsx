import { useState, type ReactNode } from 'react';
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
}

export function MainLayout({
  projectId,
  projectName,
  executionState,
  connectionStatus,
  centerContent,
  rightContent,
}: MainLayoutProps) {
  const { t } = useTranslation();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <Header
        projectName={projectName}
        executionState={executionState}
        connectionStatus={connectionStatus}
      />

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div
          className={`relative border-r border-gray-800 transition-all duration-200 ${
            leftCollapsed ? 'w-0 overflow-hidden' : 'w-[280px]'
          }`}
        >
          <Sidebar projectId={projectId} />
        </div>

        {/* Left toggle button */}
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="flex items-center justify-center w-5 shrink-0 hover:bg-gray-800/50 text-gray-600 hover:text-gray-400 transition-colors border-r border-gray-800"
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
          className="flex items-center justify-center w-5 shrink-0 hover:bg-gray-800/50 text-gray-600 hover:text-gray-400 transition-colors border-l border-gray-800"
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
          className={`border-l border-gray-800 transition-all duration-200 overflow-y-auto ${
            rightCollapsed ? 'w-0 overflow-hidden' : 'w-[320px]'
          }`}
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
