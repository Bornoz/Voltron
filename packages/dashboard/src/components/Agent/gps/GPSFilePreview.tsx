import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { X, Clock, Eye, Navigation, Code, MonitorPlay, Sparkles } from 'lucide-react';
import type { ForceNode } from './types';
import { ACTIVITY_COLORS, SYNTAX } from './constants';
import type { AgentBreadcrumb } from '@voltron/shared';
import { useTranslation } from '../../../i18n';
import { LivePreviewFrame, isRenderable } from './LivePreviewFrame';
import { DesignContextMenu } from './DesignContextMenu';
import type { ContextMenuEventData } from './LivePreviewFrame';

interface GPSFilePreviewProps {
  node: ForceNode | null;
  breadcrumbs: AgentBreadcrumb[];
  projectId: string;
  onClose: () => void;
  onRedirect: (filePath: string) => void;
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

export const GPSFilePreview = memo(function GPSFilePreview({
  node, breadcrumbs, projectId, onClose, onRedirect,
}: GPSFilePreviewProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);

  // View mode: 'preview' or 'code'
  const canPreview = node ? isRenderable(node.extension) : false;
  const [viewMode, setViewMode] = useState<'preview' | 'code'>(canPreview ? 'preview' : 'code');

  // Design context menu state
  const [designMenu, setDesignMenu] = useState<ContextMenuEventData | null>(null);

  // Reset view mode when node changes
  useEffect(() => {
    if (node) {
      setViewMode(isRenderable(node.extension) ? 'preview' : 'code');
      setDesignMenu(null);
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

  // Design context menu handlers
  const handlePreviewContextMenu = useCallback((data: ContextMenuEventData) => {
    setDesignMenu(data);
  }, []);

  const handleApplyStyle = useCallback((selector: string, styles: Record<string, string>) => {
    // Send to iframe
    const iframe = iframeContainerRef.current?.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'VOLTRON_APPLY_STYLE', selector, styles }, '*');
    }
  }, []);

  const handleEditText = useCallback((selector: string) => {
    const newText = prompt('Yeni metin girin:');
    if (newText !== null) {
      const iframe = iframeContainerRef.current?.querySelector('iframe');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'VOLTRON_EDIT_TEXT', selector, text: newText }, '*');
      }
    }
  }, []);

  const handleDeleteElement = useCallback((selector: string) => {
    const iframe = iframeContainerRef.current?.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'VOLTRON_DELETE_ELEMENT', selector }, '*');
    }
  }, []);

  const handleDuplicateElement = useCallback((selector: string) => {
    const iframe = iframeContainerRef.current?.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'VOLTRON_DUPLICATE_ELEMENT', selector }, '*');
    }
  }, []);

  const handleToggleVisibility = useCallback((selector: string) => {
    const iframe = iframeContainerRef.current?.querySelector('iframe');
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'VOLTRON_TOGGLE_VISIBILITY', selector }, '*');
    }
  }, []);

  const closeDesignMenu = useCallback(() => setDesignMenu(null), []);

  // Compute iframe offset for context menu positioning
  const getFrameOffset = useCallback((): { x: number; y: number } => {
    const container = iframeContainerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }, []);

  if (!node) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="absolute top-0 right-0 h-full flex flex-col animate-fade-in-up"
        style={{
          width: 400,
          background: 'rgba(10,15,30,0.95)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
          zIndex: 20,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 min-w-0">
            {viewMode === 'preview' ? (
              <MonitorPlay size={14} className="text-green-400 shrink-0" />
            ) : (
              <Eye size={14} className="text-blue-400 shrink-0" />
            )}
            <span className="text-xs font-mono text-slate-200 truncate">{node.fileName}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRedirect}
              className="p-1 rounded hover:bg-slate-700 text-blue-400"
              title={t('agent.gps.switchFile')}
            >
              <Navigation size={14} />
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Mode Toggle — Code/Preview */}
        <div className="flex border-b border-white/[0.06]">
          <button
            onClick={() => { setViewMode('preview'); setDesignMenu(null); }}
            disabled={!canPreview}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all flex-1 justify-center ${
              viewMode === 'preview'
                ? 'text-green-400 bg-green-500/10 border-b-2 border-green-400'
                : canPreview
                  ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                  : 'text-slate-700 cursor-not-allowed'
            }`}
          >
            <MonitorPlay size={12} />
            Onizleme
            {canPreview && viewMode === 'preview' && (
              <Sparkles size={9} className="text-green-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => { setViewMode('code'); setDesignMenu(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all flex-1 justify-center ${
              viewMode === 'code'
                ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
            }`}
          >
            <Code size={12} />
            Kod
          </button>
        </div>

        {/* File path */}
        <div className="px-3 py-1.5 text-[10px] font-mono text-slate-500 border-b border-white/[0.04]">
          {node.filePath}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 px-3 py-1.5 border-b border-white/[0.04]">
          <span className="text-[10px] text-slate-400">
            {node.visits} {t('agent.visits')}
          </span>
          <span className="text-[10px]" style={{ color: ACTIVITY_COLORS[node.lastActivity] }}>
            {node.lastActivity}
          </span>
          {canPreview && viewMode === 'preview' && (
            <span className="text-[9px] text-green-500/60 ml-auto flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Canli
            </span>
          )}
        </div>

        {/* Content area */}
        <div ref={iframeContainerRef} className="flex-1 overflow-hidden relative">
          {viewMode === 'preview' && canPreview ? (
            /* Live Preview Mode */
            <LivePreviewFrame
              filePath={node.filePath}
              projectId={projectId}
              extension={node.extension}
              content={content}
              onContextMenu={handlePreviewContextMenu}
            />
          ) : (
            /* Code Mode */
            <div className="h-full overflow-auto">
              {loading ? (
                <div className="p-4 text-xs text-slate-500">{t('common.loading')}</div>
              ) : content ? (
                <pre
                  className="p-3 text-[11px] leading-relaxed font-mono text-slate-300 whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{ __html: highlightSyntax(content.slice(0, 5000)) }}
                />
              ) : (
                <div className="p-4 text-xs text-slate-500">Preview not available</div>
              )}
            </div>
          )}
        </div>

        {/* Activity history */}
        {fileBreadcrumbs.length > 0 && (
          <div className="border-t border-white/[0.06] max-h-[160px] overflow-auto">
            <div className="px-3 py-1.5 flex items-center gap-1 text-[10px] text-slate-400 sticky top-0" style={{ background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(8px)' }}>
              <Clock size={10} />
              <span>Aktivite ({fileBreadcrumbs.length})</span>
            </div>
            {fileBreadcrumbs.slice(-20).reverse().map((bc, i) => (
              <div key={i} className="px-3 py-1 flex items-center gap-2 hover:bg-slate-800/50">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: ACTIVITY_COLORS[bc.activity] }}
                />
                <span className="text-[10px] font-mono text-slate-400 flex-1">
                  {bc.toolName ?? bc.activity}
                </span>
                <span className="text-[10px] text-slate-600">
                  {new Date(bc.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Design Context Menu — rendered outside the panel for proper positioning */}
      <DesignContextMenu
        data={designMenu}
        frameOffset={getFrameOffset()}
        onClose={closeDesignMenu}
        onApplyStyle={handleApplyStyle}
        onEditText={handleEditText}
        onDeleteElement={handleDeleteElement}
        onDuplicateElement={handleDuplicateElement}
        onToggleVisibility={handleToggleVisibility}
      />
    </>
  );
});
