import { useState, useEffect } from 'react';
import {
  Clock, FileEdit, FilePlus, FileX, ArrowRightLeft,
  FolderPlus, FolderMinus, Package, Settings,
} from 'lucide-react';
import * as api from '../../lib/api';
import type { AiActionEvent, OperationType } from '@voltron/shared';
import { Badge } from '../common/Badge';
import { formatRelativeTime } from '../../lib/formatters';
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

const OP_COLORS: Record<OperationType, string> = {
  FILE_CREATE: 'text-green-400',
  FILE_MODIFY: 'text-blue-400',
  FILE_DELETE: 'text-red-400',
  FILE_RENAME: 'text-yellow-400',
  DIR_CREATE: 'text-green-400',
  DIR_DELETE: 'text-red-400',
  DEPENDENCY_CHANGE: 'text-purple-400',
  CONFIG_CHANGE: 'text-orange-400',
};

interface FileHistoryProps {
  projectId: string;
  filePath: string;
  onClose: () => void;
}

export function FileHistory({ projectId, filePath, onClose }: FileHistoryProps) {
  const { t } = useTranslation();
  const [actions, setActions] = useState<AiActionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getActionsByFile(projectId, filePath);
        if (!cancelled) {
          setActions(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('fileHistory.failedToLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, filePath, t]);

  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900/50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-gray-500" />
          <span className="text-[11px] font-medium text-gray-300 truncate max-w-[200px]">
            {filePath.split('/').pop()}
          </span>
          <span className="text-[10px] text-gray-600">({actions.length} {t('fileHistory.operations')})</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs px-1">{t('common.close')}</button>
      </div>

      <div className="max-h-60 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-4 h-4 border-2 border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-center text-xs text-red-400">{error}</div>
        )}

        {!loading && !error && actions.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-gray-600">{t('fileHistory.notFound')}</div>
        )}

        {!loading && actions.map((action) => {
          const Icon = OP_ICONS[action.action] ?? FileEdit;
          const color = OP_COLORS[action.action] ?? 'text-gray-400';

          return (
            <div key={action.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/50 hover:bg-gray-800/30">
              <Icon className={`w-3 h-3 ${color} shrink-0`} />
              <span className={`text-[11px] font-mono ${color}`}>{action.action.replace('FILE_', '').replace('DIR_', '')}</span>
              <Badge risk={action.risk} />
              {action.fileSize != null && action.fileSize > 0 && (
                <span className="text-[10px] text-gray-600">{action.fileSize}B</span>
              )}
              <span className="text-[10px] text-gray-600 ml-auto shrink-0">
                {formatRelativeTime(action.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
