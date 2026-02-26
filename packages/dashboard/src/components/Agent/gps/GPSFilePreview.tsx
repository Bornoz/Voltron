import { memo, useState, useEffect, useCallback } from 'react';
import { X, Clock, Eye, Navigation } from 'lucide-react';
import type { ForceNode } from './types';
import { ACTIVITY_COLORS, SYNTAX } from './constants';
import type { AgentBreadcrumb } from '@voltron/shared';
import { useTranslation } from '../../../i18n';

interface GPSFilePreviewProps {
  node: ForceNode | null;
  breadcrumbs: AgentBreadcrumb[];
  projectId: string;
  onClose: () => void;
  onRedirect: (filePath: string) => void;
}

function highlightSyntax(code: string): string {
  // Apply highlighting in order: comments first, then strings, keywords, types, numbers
  let result = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Single-line comments
  result = result.replace(SYNTAX.COMMENTS_SINGLE, '<span style="color:#6b7280">$&</span>');
  // Multi-line comments
  result = result.replace(SYNTAX.COMMENTS_MULTI, '<span style="color:#6b7280">$&</span>');
  // Strings
  result = result.replace(SYNTAX.STRINGS, '<span style="color:#a5d6ff">$&</span>');
  // Keywords
  result = result.replace(SYNTAX.KEYWORDS, '<span style="color:#ff7b72">$&</span>');
  // Numbers
  result = result.replace(SYNTAX.NUMBERS, '<span style="color:#79c0ff">$&</span>');

  return result;
}

export const GPSFilePreview = memo(function GPSFilePreview({
  node, breadcrumbs, projectId, onClose, onRedirect,
}: GPSFilePreviewProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  if (!node) return null;

  return (
    <div
      className="absolute top-0 right-0 h-full flex flex-col"
      style={{
        width: 340,
        background: 'rgba(15,23,42,0.95)',
        borderLeft: '1px solid rgba(71,85,105,0.4)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
        animation: 'slideInRight 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={14} className="text-blue-400 shrink-0" />
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

      {/* File path */}
      <div className="px-3 py-1.5 text-[10px] font-mono text-slate-500 border-b border-slate-700/30">
        {node.filePath}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-slate-700/30">
        <span className="text-[10px] text-slate-400">
          {node.visits} {t('agent.visits')}
        </span>
        <span className="text-[10px]" style={{ color: ACTIVITY_COLORS[node.lastActivity] }}>
          {node.lastActivity}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
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

      {/* Activity history */}
      {fileBreadcrumbs.length > 0 && (
        <div className="border-t border-slate-700/30 max-h-[200px] overflow-auto">
          <div className="px-3 py-1.5 flex items-center gap-1 text-[10px] text-slate-400 sticky top-0 bg-slate-900/90">
            <Clock size={10} />
            <span>Activity ({fileBreadcrumbs.length})</span>
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
  );
});
