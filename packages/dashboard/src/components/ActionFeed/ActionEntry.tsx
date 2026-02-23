import { useState } from 'react';
import {
  FilePlus, FileEdit, FileX, ArrowRightLeft,
  FolderPlus, FolderMinus, Package, Settings,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { AiActionEvent, OperationType } from '@voltron/shared';
import { Badge } from '../common/Badge';
import { formatRelativeTime, formatPath } from '../../lib/formatters';
import { DiffViewer } from '../DiffViewer/DiffViewer';

const actionIcons: Record<OperationType, typeof FilePlus> = {
  FILE_CREATE: FilePlus,
  FILE_MODIFY: FileEdit,
  FILE_DELETE: FileX,
  FILE_RENAME: ArrowRightLeft,
  DIR_CREATE: FolderPlus,
  DIR_DELETE: FolderMinus,
  DEPENDENCY_CHANGE: Package,
  CONFIG_CHANGE: Settings,
};

const actionColors: Record<OperationType, string> = {
  FILE_CREATE: 'text-green-400',
  FILE_MODIFY: 'text-yellow-400',
  FILE_DELETE: 'text-red-400',
  FILE_RENAME: 'text-blue-400',
  DIR_CREATE: 'text-green-400',
  DIR_DELETE: 'text-red-400',
  DEPENDENCY_CHANGE: 'text-purple-400',
  CONFIG_CHANGE: 'text-orange-400',
};

interface ActionEntryProps {
  event: AiActionEvent;
  isSelected: boolean;
  onSelect: (event: AiActionEvent) => void;
}

export function ActionEntry({ event, isSelected, onSelect }: ActionEntryProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = actionIcons[event.action];
  const color = actionColors[event.action];

  return (
    <div
      className={clsx(
        'border-b border-gray-800/50 transition-colors',
        isSelected && 'bg-blue-900/20 border-l-2 border-l-blue-500',
      )}
    >
      <button
        onClick={() => {
          onSelect(event);
          if (event.diff) setExpanded(!expanded);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800/30 transition-colors"
      >
        {/* Expand icon */}
        {event.diff ? (
          expanded ? (
            <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Action icon */}
        <Icon className={clsx('w-4 h-4 shrink-0', color)} />

        {/* File path */}
        <span className="flex-1 text-xs font-mono text-gray-300 truncate" title={event.file}>
          {formatPath(event.file, 60)}
        </span>

        {/* Risk badge */}
        <Badge risk={event.risk} />

        {/* Timestamp */}
        <span className="text-[10px] text-gray-500 shrink-0 w-20 text-right">
          {formatRelativeTime(event.timestamp)}
        </span>
      </button>

      {/* Expanded diff view */}
      {expanded && event.diff && (
        <div className="px-3 pb-2">
          <DiffViewer
            diff={event.diff}
            filePath={event.file}
            risk={event.risk}
            truncated={event.diffTruncated}
          />
        </div>
      )}
    </div>
  );
}
