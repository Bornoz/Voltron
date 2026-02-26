import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown, Layers, X, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../../i18n';

interface DOMNode {
  tag: string;
  id: string | null;
  classes: string[];
  children: DOMNode[];
  rect: { x: number; y: number; width: number; height: number } | null;
  selector: string;
}

interface ComponentTreeProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  visible: boolean;
  onClose: () => void;
  onSelect: (selector: string) => void;
}

export const ComponentTree = memo(function ComponentTree({
  iframeRef, visible, onClose, onSelect,
}: ComponentTreeProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<DOMNode | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTree = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    setLoading(true);
    iframe.contentWindow.postMessage({ type: 'VOLTRON_GET_DOM_TREE' }, '*');
  }, [iframeRef]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'VOLTRON_DOM_TREE') {
        setTree(e.data.tree);
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (visible) fetchTree();
  }, [visible, fetchTree]);

  if (!visible) return null;

  return (
    <div
      className="absolute top-0 left-0 h-full flex flex-col"
      style={{
        width: 280,
        background: 'rgba(15,23,42,0.95)',
        borderRight: '1px solid rgba(71,85,105,0.4)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-slate-200">DOM Tree</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={fetchTree} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <RefreshCw size={12} />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {loading ? (
          <div className="p-3 text-xs text-slate-500">{t('common.loading')}</div>
        ) : tree ? (
          <TreeNode node={tree} depth={0} onSelect={onSelect} />
        ) : (
          <div className="p-3 text-xs text-slate-500">No DOM data</div>
        )}
      </div>
    </div>
  );
});

function TreeNode({ node, depth, onSelect }: { node: DOMNode; depth: number; onSelect: (s: string) => void }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const indent = depth * 12;

  const label = `<${node.tag}${node.id ? `#${node.id}` : ''}${node.classes.length > 0 ? `.${node.classes.slice(0, 2).join('.')}` : ''}>`;

  return (
    <div>
      <div
        className="flex items-center gap-0.5 py-0.5 hover:bg-slate-800/50 rounded cursor-pointer group"
        style={{ paddingLeft: indent }}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) setExpanded(!expanded);
          onSelect(node.selector);
        }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={10} className="text-slate-500 shrink-0" /> : <ChevronRight size={10} className="text-slate-500 shrink-0" />
        ) : (
          <span className="w-[10px] shrink-0" />
        )}
        <span className="text-[10px] font-mono text-slate-400 truncate group-hover:text-blue-400 transition-colors">
          {label.length > 36 ? label.slice(0, 35) + '…' : label}
        </span>
      </div>
      {expanded && hasChildren && node.children.map((child, i) => (
        <TreeNode key={`${child.selector}-${i}`} node={child} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}
