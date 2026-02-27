import { Wifi, WifiOff, Settings, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import type { ConnectionStatus } from '../../lib/ws';
import type { ExecutionState } from '@voltron/shared';
import { useTranslation } from '../../i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';

const stateColors: Record<ExecutionState, { dot: string; text: string; glow: string }> = {
  IDLE: { dot: 'bg-gray-500', text: 'text-gray-400', glow: '' },
  RUNNING: { dot: 'bg-green-400', text: 'text-green-400', glow: 'shadow-[0_0_8px_rgba(34,197,94,0.4)]' },
  STOPPED: { dot: 'bg-red-400', text: 'text-red-400', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.4)]' },
  RESUMING: { dot: 'bg-yellow-400', text: 'text-yellow-400', glow: 'shadow-[0_0_8px_rgba(234,179,8,0.4)]' },
  ERROR: { dot: 'bg-red-500 animate-pulse', text: 'text-red-400', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]' },
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
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export function Header({ projectName, executionState, connectionStatus, onOpenSettings, onLogout }: HeaderProps) {
  const { t } = useTranslation();
  const isConnected = connectionStatus === 'connected';
  const stateStyle = stateColors[executionState] ?? stateColors.IDLE;

  return (
    <header className="glass relative flex items-center h-[52px] px-4 shrink-0 border-b-0" style={{ borderBottom: 'none' }}>
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-3">
        <img
          src="/voltronlogo.png"
          alt="Voltron"
          className="w-8 h-8 object-contain drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]"
        />
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight leading-none" style={{ color: 'var(--color-text-primary)' }}>VOLTRON</span>
          <span className="text-[9px] tracking-widest uppercase leading-none mt-0.5" style={{ color: 'var(--color-text-muted)' }}>AI Operation Control Center</span>
        </div>
      </div>

      {/* Center: Status pills */}
      <div className="flex items-center gap-2 ml-auto mr-4">
        {/* Execution state pill */}
        <div className={clsx(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full border',
          stateStyle.glow,
        )} style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--glass-border)' }}>
          <span className={clsx('w-2 h-2 rounded-full shrink-0', stateStyle.dot)} />
          <span className={clsx('text-[10px] font-bold uppercase tracking-wider', stateStyle.text)}>
            {stateLabels[executionState]}
          </span>
        </div>

        {/* Connection pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border" style={{ background: 'var(--color-bg-tertiary)', borderColor: 'var(--glass-border)' }}>
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-medium text-green-400">WS</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-medium text-red-400">WS</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher />

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ color: 'var(--color-text-muted)' }}
            title={t('settings.title')}
          >
            <Settings className="w-4 h-4" />
          </button>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg hover:text-red-400 transition-colors hover:bg-[var(--color-bg-tertiary)]"
            style={{ color: 'var(--color-text-muted)' }}
            title={t('login.signOut')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bottom accent glow line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--color-accent) 30%, transparent) 50%, transparent 100%)`,
        }}
      />
    </header>
  );
}
