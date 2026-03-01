import { memo, useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Clock, Eye, Navigation, Code, MonitorPlay, Sparkles,
  Maximize2, Minimize2, PanelRightClose, History, Send, Trash2,
  FileText, ChevronDown, Layers,
} from 'lucide-react';
import type { ForceNode } from './types';
import { ACTIVITY_COLORS, SYNTAX } from './constants';
import type { AgentBreadcrumb } from '@voltron/shared';
import { useTranslation } from '../../../i18n';
import { LivePreviewFrame, isRenderable } from './LivePreviewFrame';
import { DesignContextMenu } from './DesignContextMenu';
import type { ContextMenuEventData } from './LivePreviewFrame';
import { useVisualEditStore, type DesignChange, generateMultiFilePrompt } from '../../../stores/visualEditStore';

/* ═══ Multi-File Change Indicator ═══ */
function MultiFileIndicator({ changesByFile, currentFilePath, onClearFile, onClearAll, onSendAll }: {
  changesByFile: Record<string, DesignChange[]>;
  currentFilePath: string;
  onClearFile: (filePath: string) => void;
  onClearAll: () => void;
  onSendAll?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const files = Object.entries(changesByFile).filter(([, c]) => c.length > 0);
  const totalCount = files.reduce((sum, [, c]) => sum + c.length, 0);

  if (files.length === 0) return null;

  return (
    <div className="absolute top-3 right-3 z-20" style={{ maxWidth: 320 }}>
      {/* Collapsed badge */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{
          background: 'rgba(10,15,30,0.92)',
          border: '1px solid rgba(139,92,246,0.25)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 12px rgba(139,92,246,0.1)',
        }}
      >
        <Layers size={12} className="text-purple-400" />
        <span className="text-purple-300">{totalCount} degisiklik</span>
        <span className="text-slate-500">· {files.length} dosya</span>
        <ChevronDown size={10} className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="mt-1.5 rounded-xl overflow-hidden animate-fade-in-up"
          style={{
            background: 'rgba(10,15,30,0.96)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.06)',
          }}
        >
          {/* File list */}
          <div className="max-h-48 overflow-auto">
            {files.map(([fp, changes]) => (
              <div
                key={fp}
                className={`flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] last:border-0 ${
                  fp === currentFilePath ? 'bg-blue-500/[0.06]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <FileText size={11} className={fp === currentFilePath ? 'text-blue-400' : 'text-slate-500'} />
                <span className="flex-1 text-[10px] font-mono text-slate-400 truncate" title={fp}>
                  {fp.split('/').pop()}
                </span>
                <span className="text-[9px] text-purple-400 font-semibold shrink-0">{changes.length}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onClearFile(fp); }}
                  className="p-0.5 rounded hover:bg-white/[0.06] text-slate-600 hover:text-red-400 transition-colors"
                  title="Bu dosyanin degisikliklerini temizle"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.06]">
            <button
              onClick={onClearAll}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/[0.06] border border-white/[0.06] transition-all"
            >
              <Trash2 size={9} />
              Tumunu Temizle
            </button>
            {onSendAll && (
              <button
                onClick={onSendAll}
                className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-semibold text-white transition-all active:scale-[0.97]"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
              >
                <Send size={9} />
                Tumunu AI'ye Gonder ({totalCount})
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface GPSFilePreviewProps {
  node: ForceNode | null;
  breadcrumbs: AgentBreadcrumb[];
  projectId: string;
  onClose: () => void;
  onRedirect: (filePath: string) => void;
  onInject?: (prompt: string, context?: { filePath?: string }) => void;
}

function highlightSyntax(code: string): string {
  let result = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  result = result.replace(SYNTAX.COMMENTS_SINGLE, '<span style="color:#6b7280">$&</span>');
  result = result.replace(SYNTAX.COMMENTS_MULTI, '<span style="color:#6b7280">$&</span>');
  result = result.replace(SYNTAX.STRINGS, '<span style="color:#a5d6ff">$&</span>');
  result = result.replace(SYNTAX.KEYWORDS, '<span style="color:#ff7b72">$&</span>');
  result = result.replace(SYNTAX.NUMBERS, '<span style="color:#79c0ff">$&</span>');

  return result;
}

/* ═══ Premium Inline Text Editor Modal ═══ */
function PremiumTextEditor({ selector, currentText, onSubmit, onCancel }: {
  selector: string;
  currentText: string;
  onSubmit: (selector: string, text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(currentText);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        onSubmit(selector, text);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selector, text, onSubmit, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in-up"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden animate-fade-in-up"
        style={{
          width: 480,
          background: 'rgba(10,15,30,0.97)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center">
            <Code size={16} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Metin Duzenle</h3>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selector}</p>
          </div>
          <button
            onClick={onCancel}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <label className="text-[11px] text-slate-400 font-medium mb-2 block">Yeni icerik</label>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded-xl px-4 py-3 text-sm text-slate-200 font-mono leading-relaxed resize-none focus:outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
              e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2), 0 0 12px rgba(59,130,246,0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.2)';
            }}
            placeholder="Yeni metin giriniz..."
          />
          <p className="text-[9px] text-slate-600 mt-2">Ctrl+Enter ile hizlica uygulayabilirsiniz</p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-white/[0.04] border border-white/[0.06] transition-all"
          >
            Iptal
          </button>
          <button
            onClick={() => onSubmit(selector, text)}
            className="ml-auto px-5 py-2 text-xs font-semibold text-white rounded-lg transition-all active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              boxShadow: '0 4px 16px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            Uygula
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Premium Confirm Dialog ═══ */
function PremiumConfirm({ title, message, onConfirm, onCancel, danger }: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in-up"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col rounded-2xl overflow-hidden animate-fade-in-up"
        style={{
          width: 400,
          background: 'rgba(10,15,30,0.97)',
          border: `1px solid ${danger ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.1)'}`,
          backdropFilter: 'blur(24px)',
          boxShadow: danger
            ? '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(239,68,68,0.08)'
            : '0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(59,130,246,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            danger ? 'bg-red-500/10 border border-red-500/20' : 'bg-blue-500/10 border border-blue-500/20'
          }`}>
            {danger ? <X size={16} className="text-red-400" /> : <Sparkles size={16} className="text-blue-400" />}
          </div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-400 rounded-lg hover:bg-white/[0.04] border border-white/[0.06] transition-all"
          >
            Vazgec
          </button>
          <button
            onClick={onConfirm}
            className={`ml-auto px-5 py-2 text-xs font-semibold text-white rounded-lg transition-all active:scale-[0.97] ${
              danger ? '' : ''
            }`}
            style={{
              background: danger
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #3b82f6, #6366f1)',
              boxShadow: danger
                ? '0 4px 16px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
                : '0 4px 16px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            Onayla
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Action Toast ═══ */
function ActionToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl text-xs text-slate-200 font-medium animate-fade-in-up"
      style={{
        background: 'rgba(10,15,30,0.92)',
        border: '1px solid rgba(59,130,246,0.15)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 16px rgba(59,130,246,0.08)',
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={12} className="text-blue-400" />
        {message}
      </div>
    </div>
  );
}

/* ═══ Main Component ═══ */
export const GPSFilePreview = memo(function GPSFilePreview({
  node, breadcrumbs, projectId, onClose, onRedirect, onInject,
}: GPSFilePreviewProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const iframeContainerRef = useRef<HTMLDivElement>(null);

  // View & layout state
  const canPreview = node ? isRenderable(node.extension) : false;
  const [viewMode, setViewMode] = useState<'preview' | 'code'>(canPreview ? 'preview' : 'code');
  const [maximized, setMaximized] = useState(true); // default: fullscreen overlay
  const [historyVisible, setHistoryVisible] = useState(false);

  // Design context menu state
  const [designMenu, setDesignMenu] = useState<ContextMenuEventData | null>(null);

  // Premium dialogs state
  const [textEditor, setTextEditor] = useState<{ selector: string; text: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ selector: string; type: 'delete' } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Design change tracking (multi-file store — survives file navigation)
  const currentFilePath = node?.filePath ?? '';
  const changesByFile = useVisualEditStore((s) => s.changesByFile);
  const designChanges = changesByFile[currentFilePath] ?? [];
  const totalChanges = Object.values(changesByFile).reduce((sum, c) => sum + c.length, 0);

  // Reset states when node changes
  useEffect(() => {
    if (node) {
      setViewMode(isRenderable(node.extension) ? 'preview' : 'code');
      setDesignMenu(null);
      setTextEditor(null);
      setConfirmDialog(null);
    }
  }, [node?.id]);

  // Fetch file content
  useEffect(() => {
    if (!node) return;
    setLoading(true);
    const token = localStorage.getItem('voltron_token');
    fetch(`/api/projects/${projectId}/agent/preview/${node.filePath}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.text() : null)
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setContent(null);
        setLoading(false);
      });
  }, [node, projectId]);

  const fileBreadcrumbs = breadcrumbs.filter((bc) => node && bc.filePath === node.filePath);

  const handleRedirect = useCallback(() => {
    if (node) onRedirect(node.filePath);
  }, [node, onRedirect]);

  // ─── iframe communication helpers ───
  const sendToIframe = useCallback((message: Record<string, unknown>) => {
    const iframe = iframeContainerRef.current?.querySelector('iframe');
    iframe?.contentWindow?.postMessage(message, '*');
  }, []);

  // ─── Design change tracker ───
  const handleDesignChange = useCallback((selector: string, tagName: string, property: string, value: string) => {
    if (!node) return;
    useVisualEditStore.getState().addChange(node.filePath, { selector, tagName, property, value, timestamp: Date.now() });
  }, [node]);

  const handleSendToAI = useCallback(() => {
    if (!onInject) return;
    const store = useVisualEditStore.getState();
    const total = store.totalCount();
    if (total === 0) return;
    const prompt = generateMultiFilePrompt(store.changesByFile);
    onInject(prompt, { filePath: node?.filePath });
    setToast(`${total} degisiklik AI'ye gonderildi`);
    store.clearAll();
  }, [onInject, node]);

  const handleClearChanges = useCallback(() => {
    if (!node) return;
    useVisualEditStore.getState().clearFile(node.filePath);
    setToast('Degisiklik gecmisi temizlendi');
  }, [node]);

  const handleUndo = useCallback(() => {
    if (!node) return;
    useVisualEditStore.getState().undoLastChange(node.filePath);
  }, [node]);

  const handleAskAI = useCallback((selector: string, elementInfo: string) => {
    if (!onInject || !node) return;
    const prompt = `Bu element hakkinda yardim istiyorum:\n${elementInfo}\nSelector: ${selector}\nDosya: ${node.filePath}`;
    onInject(prompt, { filePath: node.filePath });
  }, [onInject, node]);

  // ─── Design context menu handlers ───
  const handlePreviewContextMenu = useCallback((data: ContextMenuEventData) => {
    setDesignMenu(data);
  }, []);

  const handleApplyStyle = useCallback((selector: string, styles: Record<string, string>) => {
    sendToIframe({ type: 'VOLTRON_APPLY_STYLE', selector, styles });
    setToast('Stil uygulandı');
    // Note: individual change tracking is done via DesignContextMenu's onDesignChange callback
  }, [sendToIframe]);

  const handleEditText = useCallback((selector: string) => {
    // Open premium text editor instead of browser prompt()
    const currentText = designMenu?.textContent ?? '';
    setTextEditor({ selector, text: currentText });
    setDesignMenu(null);
  }, [designMenu]);

  const handleTextSubmit = useCallback((selector: string, text: string) => {
    sendToIframe({ type: 'VOLTRON_EDIT_TEXT', selector, text });
    setTextEditor(null);
    setToast('Metin guncellendi');
    if (node) useVisualEditStore.getState().addChange(node.filePath, { selector, tagName: 'unknown', property: '__textContent', value: text, timestamp: Date.now() });
  }, [sendToIframe, node]);

  const handleDeleteElement = useCallback((selector: string) => {
    // Open premium confirm dialog
    setConfirmDialog({ selector, type: 'delete' });
    setDesignMenu(null);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (confirmDialog) {
      sendToIframe({ type: 'VOLTRON_DELETE_ELEMENT', selector: confirmDialog.selector });
      setConfirmDialog(null);
      setToast('Element silindi');
      if (node) useVisualEditStore.getState().addChange(node.filePath, { selector: confirmDialog.selector, tagName: 'unknown', property: '__delete', value: 'true', timestamp: Date.now() });
    }
  }, [confirmDialog, sendToIframe, node]);

  const handleDuplicateElement = useCallback((selector: string) => {
    sendToIframe({ type: 'VOLTRON_DUPLICATE_ELEMENT', selector });
    setDesignMenu(null);
    setToast('Element kopyalandi');
    if (node) useVisualEditStore.getState().addChange(node.filePath, { selector, tagName: 'unknown', property: '__duplicate', value: 'true', timestamp: Date.now() });
  }, [sendToIframe, node]);

  const handleToggleVisibility = useCallback((selector: string) => {
    sendToIframe({ type: 'VOLTRON_TOGGLE_VISIBILITY', selector });
    setDesignMenu(null);
    setToast('Gorunurluk degistirildi');
  }, [sendToIframe]);

  const closeDesignMenu = useCallback(() => setDesignMenu(null), []);

  // Compute iframe offset for context menu positioning
  const getFrameOffset = useCallback((): { x: number; y: number } => {
    const container = iframeContainerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }, []);

  // Escape to close
  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !textEditor && !confirmDialog && !designMenu) {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [node, onClose, textEditor, confirmDialog, designMenu]);

  if (!node) return null;

  return (
    <>
      {/* ═══ Backdrop for fullscreen mode ═══ */}
      {maximized && (
        <div
          className="fixed inset-0 z-[25] animate-fade-in-up"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      {/* ═══ Main Container ═══ */}
      <div
        className={`flex flex-col animate-fade-in-up ${
          maximized
            ? 'fixed z-[30]'
            : 'absolute top-0 right-0 h-full z-20'
        }`}
        style={maximized ? {
          inset: '8px 8px 8px 8px',
          background: 'rgba(8,12,24,0.98)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 100px rgba(0,0,0,0.8), 0 0 60px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
        } : {
          width: 440,
          background: 'rgba(10,15,30,0.95)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* ─── Header ─── */}
        <div className={`flex items-center justify-between border-b border-white/[0.06] shrink-0 ${
          maximized ? 'px-5 py-3' : 'px-3 py-2'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Icon */}
            <div className={`rounded-lg flex items-center justify-center shrink-0 ${
              viewMode === 'preview'
                ? 'bg-gradient-to-br from-green-500/15 to-emerald-500/15 border border-green-500/20'
                : 'bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/20'
            } ${maximized ? 'w-9 h-9' : 'w-7 h-7'}`}>
              {viewMode === 'preview' ? (
                <MonitorPlay size={maximized ? 18 : 14} className="text-green-400" />
              ) : (
                <Eye size={maximized ? 18 : 14} className="text-blue-400" />
              )}
            </div>
            {/* File info */}
            <div className="min-w-0">
              <h3 className={`font-semibold text-slate-100 truncate ${maximized ? 'text-sm' : 'text-xs'}`}>
                {node.fileName}
              </h3>
              <p className={`font-mono text-slate-500 truncate ${maximized ? 'text-[11px]' : 'text-[9px]'}`}>
                {node.filePath}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Stats badges */}
            <span className={`font-mono text-slate-500 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md ${
              maximized ? 'text-[10px]' : 'text-[9px]'
            }`}>
              {node.visits} ziyaret
            </span>
            <span className={`font-mono bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md ${
              maximized ? 'text-[10px]' : 'text-[9px]'
            }`} style={{ color: ACTIVITY_COLORS[node.lastActivity] }}>
              {node.lastActivity}
            </span>

            {canPreview && viewMode === 'preview' && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/15 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Canli
              </span>
            )}

            <div className="w-px h-5 bg-white/[0.06] mx-1" />

            {/* History toggle */}
            <button
              onClick={() => setHistoryVisible(!historyVisible)}
              className={`p-1.5 rounded-lg transition-all ${
                historyVisible ? 'bg-blue-500/15 text-blue-400' : 'hover:bg-white/[0.06] text-slate-500 hover:text-slate-300'
              }`}
              title="Aktivite gecmisi"
            >
              <History size={maximized ? 16 : 14} />
            </button>

            {/* Redirect */}
            <button
              onClick={handleRedirect}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-blue-400 transition-all"
              title={t('agent.gps.switchFile')}
            >
              <Navigation size={maximized ? 16 : 14} />
            </button>

            {/* Maximize/Minimize */}
            <button
              onClick={() => setMaximized(!maximized)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-all"
              title={maximized ? 'Kucult' : 'Tam ekran'}
            >
              {maximized ? <PanelRightClose size={16} /> : <Maximize2 size={14} />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
              title="Kapat (Esc)"
            >
              <X size={maximized ? 16 : 14} />
            </button>
          </div>
        </div>

        {/* ─── Mode Toggle — Code/Preview ─── */}
        <div className="flex border-b border-white/[0.06] shrink-0">
          <button
            onClick={() => { setViewMode('preview'); setDesignMenu(null); }}
            disabled={!canPreview}
            className={`flex items-center gap-2 px-5 py-2.5 font-medium transition-all flex-1 justify-center ${
              maximized ? 'text-xs' : 'text-[11px]'
            } ${
              viewMode === 'preview'
                ? 'text-green-400 bg-green-500/8 border-b-2 border-green-400'
                : canPreview
                  ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                  : 'text-slate-700 cursor-not-allowed'
            }`}
          >
            <MonitorPlay size={14} />
            Gorsel Onizleme
            {canPreview && viewMode === 'preview' && (
              <Sparkles size={10} className="text-green-400 animate-pulse" />
            )}
          </button>
          <div className="w-px bg-white/[0.04]" />
          <button
            onClick={() => { setViewMode('code'); setDesignMenu(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 font-medium transition-all flex-1 justify-center ${
              maximized ? 'text-xs' : 'text-[11px]'
            } ${
              viewMode === 'code'
                ? 'text-blue-400 bg-blue-500/8 border-b-2 border-blue-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
            }`}
          >
            <Code size={14} />
            Kaynak Kod
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="flex flex-1 min-h-0">
          {/* Preview / Code area */}
          <div ref={iframeContainerRef} className="flex-1 flex flex-col overflow-hidden relative">
            {viewMode === 'preview' && canPreview ? (
              <LivePreviewFrame
                filePath={node.filePath}
                projectId={projectId}
                extension={node.extension}
                content={content}
                onContextMenu={handlePreviewContextMenu}
              />
            ) : (
              <div className="h-full overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
                      <span className="text-xs text-slate-500">{t('common.loading')}</span>
                    </div>
                  </div>
                ) : content ? (
                  <pre
                    className={`p-4 font-mono text-slate-300 whitespace-pre-wrap break-words ${
                      maximized ? 'text-[13px] leading-6' : 'text-[11px] leading-relaxed'
                    }`}
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(content.slice(0, maximized ? 20000 : 5000)) }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-sm text-slate-500">Onizleme kullanilamiyor</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── Floating multi-file change indicator ─── */}
            {totalChanges > 0 && Object.keys(changesByFile).filter((f) => changesByFile[f].length > 0).length > 0 && (
              <MultiFileIndicator
                changesByFile={changesByFile}
                currentFilePath={currentFilePath}
                onClearFile={(fp) => useVisualEditStore.getState().clearFile(fp)}
                onClearAll={() => useVisualEditStore.getState().clearAll()}
                onSendAll={onInject ? handleSendToAI : undefined}
              />
            )}

            {/* Toast notifications */}
            {toast && <ActionToast message={toast} onDone={() => setToast(null)} />}
          </div>

          {/* History sidebar */}
          {historyVisible && fileBreadcrumbs.length > 0 && (
            <div
              className="overflow-auto shrink-0 border-l border-white/[0.06]"
              style={{ width: maximized ? 280 : 200, background: 'rgba(6,10,20,0.5)' }}
            >
              <div className="px-3 py-2 flex items-center gap-2 text-xs text-slate-400 sticky top-0 border-b border-white/[0.04]" style={{ background: 'rgba(6,10,20,0.9)', backdropFilter: 'blur(8px)' }}>
                <Clock size={12} />
                <span className="font-medium">Aktivite</span>
                <span className="ml-auto text-[10px] font-mono text-slate-600">{fileBreadcrumbs.length}</span>
              </div>
              {fileBreadcrumbs.slice(-30).reverse().map((bc, i) => (
                <div key={i} className="px-3 py-1.5 flex items-center gap-2 hover:bg-white/[0.03] transition-colors">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: ACTIVITY_COLORS[bc.activity], boxShadow: `0 0 6px ${ACTIVITY_COLORS[bc.activity]}40` }}
                  />
                  <span className="text-[11px] font-mono text-slate-400 flex-1 truncate">
                    {bc.toolName ?? bc.activity}
                  </span>
                  <span className="text-[10px] text-slate-600 shrink-0">
                    {new Date(bc.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Bottom info bar + AI Send ─── */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-white/[0.06] shrink-0 text-[10px] text-slate-600">
          <span className="font-mono">{node.extension}</span>
          <span className="w-px h-3 bg-white/[0.06]" />
          <span>{node.visits} ziyaret</span>
          {viewMode === 'preview' && canPreview && (
            <>
              <span className="w-px h-3 bg-white/[0.06]" />
              <span className="text-green-500/60">Sag tikla: Tasarim modu</span>
            </>
          )}

          {/* Design changes indicator + AI send */}
          {totalChanges > 0 && (
            <>
              <span className="w-px h-3 bg-white/[0.06]" />
              <span className="flex items-center gap-1.5 text-blue-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                {designChanges.length > 0
                  ? `${designChanges.length} degisiklik`
                  : null}
                {totalChanges > designChanges.length && (
                  <span className="text-purple-400/80 text-[9px]">
                    {designChanges.length > 0 ? '· ' : ''}toplam {totalChanges} ({Object.keys(changesByFile).filter((f) => changesByFile[f].length > 0).length} dosya)
                  </span>
                )}
              </span>
              {designChanges.length > 0 && (
                <button
                  onClick={handleClearChanges}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/[0.06] text-slate-500 hover:text-red-400 transition-all"
                  title="Bu dosyanin degisikliklerini temizle"
                >
                  <Trash2 size={10} />
                </button>
              )}
              {onInject && (
                <button
                  onClick={handleSendToAI}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold text-white transition-all active:scale-[0.97]"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                  }}
                  title="Tum dosyalardaki degisiklikleri AI'ye gonder"
                >
                  <Send size={11} />
                  AI'ye Gonder ({totalChanges})
                </button>
              )}
            </>
          )}

          {totalChanges === 0 && <span className="ml-auto">Esc: Kapat</span>}
        </div>
      </div>

      {/* ═══ Design Context Menu ═══ */}
      <DesignContextMenu
        data={designMenu}
        frameOffset={getFrameOffset()}
        onClose={closeDesignMenu}
        onApplyStyle={handleApplyStyle}
        onEditText={handleEditText}
        onDeleteElement={handleDeleteElement}
        onDuplicateElement={handleDuplicateElement}
        onToggleVisibility={handleToggleVisibility}
        onDesignChange={handleDesignChange}
        onUndo={designChanges.length > 0 ? handleUndo : undefined}
        onAskAI={onInject ? handleAskAI : undefined}
      />

      {/* ═══ Premium Text Editor Modal ═══ */}
      {textEditor && (
        <PremiumTextEditor
          selector={textEditor.selector}
          currentText={textEditor.text}
          onSubmit={handleTextSubmit}
          onCancel={() => setTextEditor(null)}
        />
      )}

      {/* ═══ Premium Confirm Dialog ═══ */}
      {confirmDialog && (
        <PremiumConfirm
          title="Elementi Sil"
          message="Bu element DOM'dan tamamen kaldirilacak. Bu islem geri alinamaz. Devam etmek istiyor musunuz?"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDialog(null)}
          danger
        />
      )}
    </>
  );
});
