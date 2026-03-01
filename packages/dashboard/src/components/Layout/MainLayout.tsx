import { useState, useEffect, type ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { MobileRightSheet } from './MobileRightSheet';
import { useTranslation } from '../../i18n';
import { useBreakpoint } from '../../hooks/useBreakpoint';
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
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isTablet = bp === 'tablet';

  // Mobile: sidebar starts closed; tablet: sidebar starts closed; desktop: open
  const [leftCollapsed, setLeftCollapsed] = useState(isMobile || isTablet);
  const [rightCollapsed, setRightCollapsed] = useState(isMobile || isTablet);

  // Sync default state when breakpoint changes
  useEffect(() => {
    if (isMobile) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    } else if (isTablet) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [isMobile, isTablet]);

  // Auto-collapse panels when agent fullscreen
  useEffect(() => {
    if (agentFullscreen) {
      setLeftCollapsed(true);
      setRightCollapsed(true);
    }
  }, [agentFullscreen]);

  const toggleSidebar = () => setLeftCollapsed((v) => !v);

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <Header
        projectName={projectName}
        executionState={executionState}
        connectionStatus={connectionStatus}
        onOpenSettings={onOpenSettings}
        onLogout={onLogout}
        onToggleSidebar={toggleSidebar}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">

        {/* === MOBILE: Sidebar as overlay drawer === */}
        {isMobile && (
          <>
            {/* Backdrop */}
            {!leftCollapsed && (
              <div
                className="fixed inset-0 z-30 bg-black/50 animate-fade-in"
                onClick={() => setLeftCollapsed(true)}
              />
            )}
            {/* Drawer */}
            <div
              className={`fixed inset-y-0 left-0 z-40 w-[280px] transition-transform duration-300 ease-in-out ${
                leftCollapsed ? '-translate-x-full' : 'translate-x-0'
              }`}
              style={{ background: 'var(--color-bg-primary)', borderRight: '1px solid var(--glass-border)' }}
            >
              <Sidebar projectId={projectId} />
            </div>
          </>
        )}

        {/* === DESKTOP/TABLET: Sidebar inline === */}
        {!isMobile && (
          <>
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
              onClick={toggleSidebar}
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
          </>
        )}

        {/* Center content */}
        <div className={`flex-1 overflow-hidden flex flex-col ${isMobile ? 'pb-[56px]' : ''}`}>
          {centerContent}
        </div>

        {/* === DESKTOP/TABLET: Right panel inline === */}
        {!isMobile && (
          <>
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
          </>
        )}
      </div>

      {/* Mobile: Right panel as bottom sheet */}
      {isMobile && (
        <MobileRightSheet>
          {rightContent}
        </MobileRightSheet>
      )}

      {/* Status Bar — hidden on mobile (bottom nav takes its place) */}
      {!isMobile && (
        <StatusBar connectionStatus={connectionStatus} />
      )}
    </div>
  );
}
