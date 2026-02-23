import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { Columns2, Rows3 } from 'lucide-react';
import { Badge } from '../common/Badge';
import { formatPath } from '../../lib/formatters';
import { useTranslation } from '../../i18n';
import type { RiskLevel } from '@voltron/shared';

interface DiffViewerProps {
  diff: string;
  filePath: string;
  risk: RiskLevel;
  truncated?: boolean;
}

type LineType = 'add' | 'remove' | 'header' | 'context';

interface ParsedLine {
  type: LineType;
  text: string;
}

interface SplitLine {
  oldNum: number | null;
  newNum: number | null;
  oldText: string;
  newText: string;
  type: 'add' | 'remove' | 'modify' | 'context' | 'header';
}

function parseDiffLine(line: string): ParsedLine {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
    return { type: 'header', text: line };
  }
  if (line.startsWith('@@')) {
    return { type: 'header', text: line };
  }
  if (line.startsWith('+')) {
    return { type: 'add', text: line };
  }
  if (line.startsWith('-')) {
    return { type: 'remove', text: line };
  }
  return { type: 'context', text: line };
}

function parseSplitDiff(lines: string[]): SplitLine[] {
  const result: SplitLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  const removes: string[] = [];
  const adds: string[] = [];

  function flushPending() {
    const maxLen = Math.max(removes.length, adds.length);
    for (let i = 0; i < maxLen; i++) {
      const hasOld = i < removes.length;
      const hasNew = i < adds.length;
      if (hasOld && hasNew) {
        result.push({
          oldNum: oldLine++,
          newNum: newLine++,
          oldText: removes[i].substring(1),
          newText: adds[i].substring(1),
          type: 'modify',
        });
      } else if (hasOld) {
        result.push({
          oldNum: oldLine++,
          newNum: null,
          oldText: removes[i].substring(1),
          newText: '',
          type: 'remove',
        });
      } else {
        result.push({
          oldNum: null,
          newNum: newLine++,
          oldText: '',
          newText: adds[i].substring(1),
          type: 'add',
        });
      }
    }
    removes.length = 0;
    adds.length = 0;
  }

  for (const line of lines) {
    const parsed = parseDiffLine(line);

    if (parsed.type === 'header') {
      flushPending();
      // Extract line numbers from @@ -old,count +new,count @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({ oldNum: null, newNum: null, oldText: line, newText: line, type: 'header' });
      continue;
    }

    if (parsed.type === 'remove') {
      removes.push(line);
      continue;
    }

    if (parsed.type === 'add') {
      adds.push(line);
      continue;
    }

    // Context line
    flushPending();
    result.push({
      oldNum: oldLine++,
      newNum: newLine++,
      oldText: line.substring(1) || line,
      newText: line.substring(1) || line,
      type: 'context',
    });
  }

  flushPending();
  return result;
}

const lineStyles: Record<LineType, string> = {
  add: 'diff-add',
  remove: 'diff-remove',
  header: 'diff-header',
  context: 'text-gray-400',
};

const splitOldStyles: Record<SplitLine['type'], string> = {
  remove: 'diff-remove',
  modify: 'diff-remove',
  add: '',
  context: 'text-gray-400',
  header: 'diff-header',
};

const splitNewStyles: Record<SplitLine['type'], string> = {
  add: 'diff-add',
  modify: 'diff-add',
  remove: '',
  context: 'text-gray-400',
  header: 'diff-header',
};

export function DiffViewer({ diff, filePath, risk, truncated }: DiffViewerProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');
  const lines = useMemo(() => diff.split('\n'), [diff]);
  const splitLines = useMemo(() => viewMode === 'split' ? parseSplitDiff(lines) : [], [lines, viewMode]);

  return (
    <div className="rounded-lg border border-gray-800 overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs font-mono text-gray-300" title={filePath}>
          {formatPath(filePath, 70)}
        </span>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border border-gray-700 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('unified')}
              className={clsx(
                'px-1.5 py-0.5 text-[10px] flex items-center gap-1 transition-colors',
                viewMode === 'unified' ? 'bg-blue-900/50 text-blue-300' : 'text-gray-500 hover:text-gray-300',
              )}
              title={t('diffViewer.unified')}
            >
              <Rows3 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={clsx(
                'px-1.5 py-0.5 text-[10px] flex items-center gap-1 transition-colors',
                viewMode === 'split' ? 'bg-blue-900/50 text-blue-300' : 'text-gray-500 hover:text-gray-300',
              )}
              title={t('diffViewer.split')}
            >
              <Columns2 className="w-3 h-3" />
            </button>
          </div>
          <Badge risk={risk} />
        </div>
      </div>

      {/* Unified diff content */}
      {viewMode === 'unified' && (
        <div className="overflow-x-auto">
          <pre className="text-[11px] leading-5 font-mono">
            {lines.map((line, i) => {
              const parsed = parseDiffLine(line);
              return (
                <div
                  key={i}
                  className={clsx('px-3 min-w-fit', lineStyles[parsed.type])}
                >
                  <span className="text-gray-600 select-none w-8 inline-block text-right mr-2">
                    {i + 1}
                  </span>
                  {parsed.text || ' '}
                </div>
              );
            })}
          </pre>
        </div>
      )}

      {/* Split diff content */}
      {viewMode === 'split' && (
        <div className="overflow-x-auto">
          <div className="flex text-[11px] leading-5 font-mono min-w-fit">
            {/* Old file (left) */}
            <div className="flex-1 border-r border-gray-800 min-w-0">
              <div className="px-2 py-0.5 bg-gray-900/50 border-b border-gray-800 text-[9px] text-gray-600">
                {t('diffViewer.oldFile')}
              </div>
              {splitLines.map((sl, i) => (
                <div
                  key={i}
                  className={clsx(
                    'px-2 min-w-fit whitespace-pre',
                    splitOldStyles[sl.type],
                    sl.type === 'add' && 'opacity-30',
                  )}
                >
                  <span className="text-gray-600 select-none w-6 inline-block text-right mr-1.5">
                    {sl.oldNum ?? ''}
                  </span>
                  {sl.type === 'header' ? sl.oldText : (sl.oldText || ' ')}
                </div>
              ))}
            </div>
            {/* New file (right) */}
            <div className="flex-1 min-w-0">
              <div className="px-2 py-0.5 bg-gray-900/50 border-b border-gray-800 text-[9px] text-gray-600">
                {t('diffViewer.newFile')}
              </div>
              {splitLines.map((sl, i) => (
                <div
                  key={i}
                  className={clsx(
                    'px-2 min-w-fit whitespace-pre',
                    splitNewStyles[sl.type],
                    sl.type === 'remove' && 'opacity-30',
                  )}
                >
                  <span className="text-gray-600 select-none w-6 inline-block text-right mr-1.5">
                    {sl.newNum ?? ''}
                  </span>
                  {sl.type === 'header' ? sl.newText : (sl.newText || ' ')}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Truncated warning */}
      {truncated && (
        <div className="px-3 py-1.5 bg-yellow-900/20 border-t border-yellow-800/50 text-xs text-yellow-400">
          {t('diffViewer.diffTruncated')}
        </div>
      )}
    </div>
  );
}
