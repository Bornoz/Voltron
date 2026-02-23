import {
  FileEdit, FilePlus, FileX, ArrowRightLeft, FolderPlus, FolderMinus, Package, Settings, Shield,
} from 'lucide-react';
import type { AiActionEvent, OperationType } from '@voltron/shared';
import { useTranslation } from '../../i18n';

const OP_ICONS: Record<OperationType, typeof FileEdit> = {
  FILE_CREATE: FilePlus,
  FILE_MODIFY: FileEdit,
  FILE_DELETE: FileX,
  FILE_RENAME: ArrowRightLeft,
  DIR_CREATE: FolderPlus,
  DIR_DELETE: FolderMinus,
  DEPENDENCY_CHANGE: Package,
  CONFIG_CHANGE: Settings,
};

const OP_COLORS: Record<OperationType, { color: string; bg: string }> = {
  FILE_CREATE: { color: 'text-green-400', bg: 'bg-green-900/30' },
  FILE_MODIFY: { color: 'text-blue-400', bg: 'bg-blue-900/30' },
  FILE_DELETE: { color: 'text-red-400', bg: 'bg-red-900/30' },
  FILE_RENAME: { color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  DIR_CREATE: { color: 'text-green-400', bg: 'bg-green-900/30' },
  DIR_DELETE: { color: 'text-red-400', bg: 'bg-red-900/30' },
  DEPENDENCY_CHANGE: { color: 'text-purple-400', bg: 'bg-purple-900/30' },
  CONFIG_CHANGE: { color: 'text-orange-400', bg: 'bg-orange-900/30' },
};

const OP_LABEL_KEYS: Record<OperationType, string> = {
  FILE_CREATE: 'diffHeader.created',
  FILE_MODIFY: 'diffHeader.modified',
  FILE_DELETE: 'diffHeader.deleted',
  FILE_RENAME: 'diffHeader.renamed',
  DIR_CREATE: 'diffHeader.dirCreated',
  DIR_DELETE: 'diffHeader.dirDeleted',
  DEPENDENCY_CHANGE: 'diffHeader.dependency',
  CONFIG_CHANGE: 'diffHeader.config',
};

const RISK_BADGES: Record<string, { text: string; border: string; bg: string }> = {
  NONE: { text: 'text-gray-500', border: 'border-gray-700', bg: 'bg-gray-800/50' },
  LOW: { text: 'text-green-400', border: 'border-green-800', bg: 'bg-green-900/30' },
  MEDIUM: { text: 'text-yellow-400', border: 'border-yellow-800', bg: 'bg-yellow-900/30' },
  HIGH: { text: 'text-orange-400', border: 'border-orange-800', bg: 'bg-orange-900/30' },
  CRITICAL: { text: 'text-red-400', border: 'border-red-800', bg: 'bg-red-900/30' },
};

interface DiffHeaderProps {
  event: AiActionEvent;
}

export function DiffHeader({ event }: DiffHeaderProps) {
  const { t } = useTranslation();
  const opColors = OP_COLORS[event.action] ?? OP_COLORS.FILE_MODIFY;
  const Icon = OP_ICONS[event.action] ?? FileEdit;
  const opLabel = t(OP_LABEL_KEYS[event.action] ?? 'diffHeader.modified');
  const riskStyle = RISK_BADGES[event.risk] ?? RISK_BADGES.NONE;
  const riskReasons = event.riskReasons ?? [];
  const fileName = event.file.split('/').pop() ?? event.file;
  const dirPath = event.file.substring(0, event.file.length - fileName.length);

  return (
    <div className={`border border-gray-800 rounded-t-lg ${opColors.bg}`}>
      {/* Main info bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className={`w-4 h-4 ${opColors.color} shrink-0`} />

        {/* File path */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-gray-500 font-mono truncate">{dirPath}</span>
            <span className="text-xs text-gray-200 font-mono font-medium">{fileName}</span>
          </div>
        </div>

        {/* Operation badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${opColors.color} ${opColors.bg} border border-current/20 font-medium`}>
          {opLabel}
        </span>

        {/* Risk badge */}
        {event.risk !== 'NONE' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${riskStyle.text} ${riskStyle.border} ${riskStyle.bg}`}>
            {event.risk}
          </span>
        )}

        {/* Protection zone */}
        {event.protectionZone && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/30 border border-yellow-800 text-yellow-400 font-medium flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {event.protectionZone}
          </span>
        )}

        {/* File size */}
        {event.fileSize != null && (
          <span className="text-[10px] text-gray-600">
            {event.fileSize > 1024 ? `${(event.fileSize / 1024).toFixed(1)}KB` : `${event.fileSize}B`}
          </span>
        )}
      </div>

      {/* Risk reasons */}
      {riskReasons.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800/50 flex flex-wrap gap-1">
          {riskReasons.map((reason: string, i: number) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 bg-gray-800/50 border border-gray-700 rounded text-gray-400">
              {reason}
            </span>
          ))}
        </div>
      )}

      {/* Hash info */}
      {(event.hash || event.previousHash) && (
        <div className="px-3 py-1 border-t border-gray-800/50 flex items-center gap-3 text-[9px] text-gray-600 font-mono">
          {event.previousHash && <span>old: {event.previousHash.substring(0, 8)}</span>}
          {event.hash && <span>new: {event.hash.substring(0, 8)}</span>}
        </div>
      )}
    </div>
  );
}
