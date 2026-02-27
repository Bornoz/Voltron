import { memo, useCallback, useEffect, useRef } from 'react';
import {
  Navigation, Crosshair, Eye, Copy, MonitorPlay,
  MessageSquare, Sparkles, Pencil,
} from 'lucide-react';
import type { ForceNode } from './types';
import { isRenderable } from './LivePreviewFrame';
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

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCopyPath = useCallback(() => {
    if (node) {
      navigator.clipboard.writeText(node.filePath);
      // Visual feedback
      const btn = menuRef.current?.querySelector('[data-action="copy"]');
      if (btn) {
        btn.textContent = 'Kopyalandi!';
        setTimeout(() => onClose(), 600);
        return;
      }
    }
    onClose();
  }, [node, onClose]);

  if (!node || !position) return null;

  const hasBreakpoint = breakpoints.has(node.filePath);
  const canPreview = isRenderable(node.extension);

  return (
    <div
      ref={menuRef}
      className="fixed flex flex-col py-1 rounded-xl animate-fade-in-up"
      style={{
        left: Math.min(position.x, window.innerWidth - 240),
        top: Math.min(position.y, window.innerHeight - 360),
        background: 'rgba(10,15,30,0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)',
        zIndex: 50,
        minWidth: 220,
      }}
    >
      {/* File name header */}
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <div className="text-[10px] font-mono text-slate-400 truncate">{node.filePath}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-slate-600">{node.visits} ziyaret</span>
          <span className="text-[9px] font-mono text-blue-400/60 bg-blue-900/20 px-1 rounded">{node.extension}</span>
        </div>
      </div>

      {/* Primary actions */}
      {canPreview && (
        <MenuItem
          icon={<MonitorPlay size={13} />}
          label="Gorsel Onizleme"
          description="Dosyayi canli render et, sag tikla ile duzenle"
          onClick={() => { onPreview(node); onClose(); }}
          accent
        />
      )}

      <MenuItem
        icon={<Eye size={13} />}
        label={t('agent.gps.viewContent')}
        description="Kaynak kodunu goruntule, syntax highlighting ile"
        onClick={() => { onPreview(node); onClose(); }}
      />

      <MenuItem
        icon={<Navigation size={13} />}
        label={t('agent.gps.switchFile')}
        description="Agent'i bu dosyaya yonlendir ve uzerinde calistir"
        onClick={() => { onRedirect(node.filePath); onClose(); }}
        accent
      />

      <MenuItem
        icon={<MessageSquare size={13} />}
        label="Agent'a Talimat Ver"
        description="Bu dosya hakkinda agent'a ozel prompt gonder"
        onClick={() => { onRedirect(node.filePath); onClose(); }}
      />

      <div className="my-1 mx-2 border-t border-white/[0.06]" />

      {/* Secondary actions */}
      <MenuItem
        icon={<Crosshair size={13} />}
        label={hasBreakpoint ? 'Breakpoint Kaldir' : 'Breakpoint Koy'}
        description={hasBreakpoint ? 'Dosyadaki durdurma noktasini kaldir' : 'Agent bu dosyaya gelince duraklat'}
        onClick={() => { onBreakpoint(node.filePath); onClose(); }}
        danger={hasBreakpoint}
      />

      <MenuItem
        icon={<Pencil size={13} />}
        label="Agent ile Duzenle"
        description="Agent'tan bu dosyayi iyilestirmesini iste"
        onClick={() => { onRedirect(node.filePath); onClose(); }}
      />

      <div className="my-1 mx-2 border-t border-white/[0.06]" />

      <MenuItem
        icon={<Copy size={13} />}
        label="Dosya Yolunu Kopyala"
        description="Tam dosya yolunu panoya kopyala"
        onClick={handleCopyPath}
        dataAction="copy"
      />

      {canPreview && (
        <MenuItem
          icon={<Sparkles size={13} />}
          label="Tasarim Modu"
          description="Gorsel duzenleyiciyi ac. Elementleri sag tikla ile duzenle"
          onClick={() => { onPreview(node); onClose(); }}
          accent
        />
      )}
    </div>
  );
});

function MenuItem({ icon, label, description, onClick, accent, danger, dataAction }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
  dataAction?: string;
}) {
  const color = danger ? 'text-red-400' : accent ? 'text-blue-400' : 'text-slate-300';
  return (
    <button
      onClick={onClick}
      data-action={dataAction}
      className={`flex items-start gap-2.5 px-3 py-2 hover:bg-white/[0.05] text-left w-full transition-colors group ${
        danger ? 'hover:bg-red-900/15' : ''
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${color}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <span className={`text-[11px] font-medium block ${color}`}>{label}</span>
        <span className="text-[9px] text-slate-600 block mt-0.5 leading-tight">{description}</span>
      </div>
    </button>
  );
}
