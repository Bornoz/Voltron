import { memo, useMemo } from 'react';
import { GitCompare, X } from 'lucide-react';

interface VisualEdit {
  id: string;
  type: string;
  selector: string;
  desc: string;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
}

interface DiffViewerProps {
  edits: VisualEdit[];
  visible: boolean;
  onClose: () => void;
}

export const DiffViewer = memo(function DiffViewer({ edits, visible, onClose }: DiffViewerProps) {
  const diffLines = useMemo(() => {
    const lines: Array<{ type: 'header' | 'remove' | 'add' | 'context'; text: string }> = [];

    for (const edit of edits) {
      lines.push({ type: 'header', text: `--- ${edit.selector} (${edit.type})` });
      lines.push({ type: 'header', text: `+++ ${edit.desc}` });

      const fromKeys = Object.keys(edit.from);
      const toKeys = Object.keys(edit.to);
      const allKeys = [...new Set([...fromKeys, ...toKeys])];

      for (const key of allKeys) {
        const fromVal = edit.from[key];
        const toVal = edit.to[key];
        if (fromVal !== undefined && fromVal !== toVal) {
          lines.push({ type: 'remove', text: `  ${key}: ${String(fromVal)}` });
        }
        if (toVal !== undefined && toVal !== fromVal) {
          lines.push({ type: 'add', text: `  ${key}: ${String(toVal)}` });
        }
        if (fromVal !== undefined && fromVal === toVal) {
          lines.push({ type: 'context', text: `  ${key}: ${String(fromVal)}` });
        }
      }
    }

    return lines;
  }, [edits]);

  if (!visible || edits.length === 0) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex flex-col"
      style={{
        maxHeight: '50%',
        background: 'rgba(15,23,42,0.95)',
        borderTop: '1px solid rgba(71,85,105,0.4)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <GitCompare size={14} className="text-blue-400" />
          <span className="text-xs font-medium text-slate-200">Visual Diff ({edits.length} edits)</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        <pre className="text-[11px] font-mono leading-relaxed">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={
                line.type === 'header'
                  ? 'text-blue-400 font-bold'
                  : line.type === 'remove'
                  ? 'bg-red-500/10 text-red-400'
                  : line.type === 'add'
                  ? 'bg-green-500/10 text-green-400'
                  : 'text-slate-500'
              }
            >
              {line.type === 'remove' ? '- ' : line.type === 'add' ? '+ ' : line.type === 'header' ? '' : '  '}
              {line.text}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
});
