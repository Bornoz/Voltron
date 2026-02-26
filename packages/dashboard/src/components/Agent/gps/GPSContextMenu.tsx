import { memo, useCallback, useEffect, useRef } from 'react';
import { Navigation, Crosshair, Eye, FileCode, Copy, MapPin } from 'lucide-react';
import type { ForceNode } from './types';
import { useTranslation } from '../../../i18n';

interface GPSContextMenuProps {
  node: ForceNode | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onRedirect: (filePath: string) => void;
  onPreview: (node: ForceNode) => void;
  onBreakpoint: (filePath: string) => void;
  breakpoints: Set<string>;
}

export const GPSContextMenu = memo(function GPSContextMenu({
  node, position, onClose, onRedirect, onPreview, onBreakpoint, breakpoints,
}: GPSContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleCopyPath = useCallback(() => {
    if (node) navigator.clipboard.writeText(node.filePath);
    onClose();
  }, [node, onClose]);

  if (!node || !position) return null;

  const hasBreakpoint = breakpoints.has(node.filePath);

  return (
    <div
      ref={menuRef}
      className="fixed flex flex-col py-1 rounded-lg shadow-xl"
      style={{
        left: position.x,
        top: position.y,
        background: 'rgba(15,23,42,0.95)',
        border: '1px solid rgba(71,85,105,0.5)',
        backdropFilter: 'blur(12px)',
        zIndex: 50,
        minWidth: 180,
      }}
    >
      {/* File name header */}
      <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 border-b border-slate-700/30 truncate">
        {node.filePath}
      </div>

      <MenuItem
        icon={<Eye size={13} />}
        label={t('agent.gps.viewContent')}
        onClick={() => { onPreview(node); onClose(); }}
      />

      <MenuItem
        icon={<Navigation size={13} />}
        label={t('agent.gps.switchFile')}
        onClick={() => { onRedirect(node.filePath); onClose(); }}
        accent
      />

      <MenuItem
        icon={<Crosshair size={13} />}
        label={hasBreakpoint ? 'Remove Breakpoint' : 'Set Breakpoint'}
        onClick={() => { onBreakpoint(node.filePath); onClose(); }}
        danger={hasBreakpoint}
      />

      <div className="my-0.5 mx-2 border-t border-slate-700/30" />

      <MenuItem
        icon={<Copy size={13} />}
        label={t('agent.gps.fileInfo')}
        onClick={handleCopyPath}
      />
    </div>
  );
});

function MenuItem({ icon, label, onClick, accent, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}) {
  const color = danger ? 'text-red-400' : accent ? 'text-blue-400' : 'text-slate-300';
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/50 text-left w-full ${color}`}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  );
}
