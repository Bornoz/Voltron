import { Shield, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import type { ConnectionStatus } from '../../lib/ws';
import type { ExecutionState } from '@voltron/shared';
import { useTranslation } from '../../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';

const stateColors: Record<ExecutionState, string> = {
  IDLE: 'bg-gray-600 text-gray-200',
  RUNNING: 'bg-green-600 text-green-100',
  STOPPED: 'bg-red-600 text-red-100',
  RESUMING: 'bg-yellow-600 text-yellow-100',
  ERROR: 'bg-red-800 text-red-100',
};

const stateLabels: Record<ExecutionState, string> = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  STOPPED: 'STOPPED',
  RESUMING: 'RESUMING',
  ERROR: 'ERROR',
};

interface HeaderProps {
  projectName: string | null;
  executionState: ExecutionState;
  connectionStatus: ConnectionStatus;
}

export function Header({ projectName, executionState, connectionStatus }: HeaderProps) {
  const { t } = useTranslation();
  const isConnected = connectionStatus === 'connected';

  const connectionStatusLabel = t(`header.${connectionStatus}` as const);

  return (
    <header className="flex items-center justify-between h-14 px-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur-sm shrink-0">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-blue-400">
          <Shield className="w-6 h-6" />
          <span className="text-lg font-bold tracking-tight text-gray-100">{t('header.title')}</span>
        </div>
        {projectName && (
          <>
            <span className="text-gray-600">/</span>
            <span className="text-sm font-medium text-gray-400">{projectName}</span>
          </>
        )}
      </div>

      {/* Right: Language + State Badge + Connection */}
      <div className="flex items-center gap-4">
        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Execution State */}
        <div
          className={clsx(
            'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
            stateColors[executionState],
            executionState === 'RUNNING' && 'animate-pulse',
          )}
        >
          {stateLabels[executionState]}
        </div>

        {/* Connection Indicator */}
        <div className="flex items-center gap-2 text-sm">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-green-400" />
              <span className="hidden sm:inline text-green-400 text-xs">{connectionStatusLabel}</span>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-dot" />
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline text-red-400 text-xs">{connectionStatusLabel}</span>
              <div className="w-2 h-2 rounded-full bg-red-400" />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
