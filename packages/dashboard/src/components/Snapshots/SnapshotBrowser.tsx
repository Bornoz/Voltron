import { useState, useCallback, useEffect } from 'react';
import {
  GitCommit, Clock, Tag, RotateCcw, Trash2, ChevronDown, ChevronRight,
  Files, Loader2, AlertTriangle, Shield,
} from 'lucide-react';
import * as api from '../../lib/api';
import type { Snapshot } from '@voltron/shared';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTranslation } from '../../i18n';
import { formatRelativeTime } from '../../lib/formatters';

interface SnapshotBrowserProps {
  projectId: string;
}

export function SnapshotBrowser({ projectId }: SnapshotBrowserProps) {
  const { t } = useTranslation();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);
  const [confirmPrune, setConfirmPrune] = useState(false);
  const [pruneKeep, setPruneKeep] = useState(100);

  const PAGE_SIZE = 25;

  const loadSnapshots = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSnapshots(projectId, PAGE_SIZE, 0);
      setSnapshots(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await api.getSnapshots(projectId, PAGE_SIZE, snapshots.length);
      setSnapshots((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFiles = async (snapshotId: string) => {
    if (expandedId === snapshotId) {
      setExpandedId(null);
      setExpandedFiles([]);
      return;
    }
    setExpandedId(snapshotId);
    setFilesLoading(true);
    try {
      const result = await api.getSnapshotFiles(projectId, snapshotId);
      setExpandedFiles(result.files);
    } catch {
      setExpandedFiles([]);
    } finally {
      setFilesLoading(false);
    }
  };

  const saveLabel = async (snapshotId: string) => {
    try {
      await api.labelSnapshot(projectId, snapshotId, labelInput);
      setSnapshots((prev) =>
        prev.map((s) => (s.id === snapshotId ? { ...s, label: labelInput } : s)),
      );
      setEditingLabel(null);
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('notifications.unknownError'),
        message: err instanceof Error ? err.message : '',
      });
    }
  };

  const handleRollback = async (snapshotId: string) => {
    try {
      await api.rollbackSnapshot(projectId, snapshotId);
      setConfirmRollback(null);
      addNotification({
        type: 'success',
        title: t('snapshots.rollbackSuccess'),
        message: t('snapshots.rollbackMessage'),
        autoClose: 5000,
      });
      loadSnapshots();
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('notifications.unknownError'),
        message: err instanceof Error ? err.message : '',
      });
    }
  };

  const handlePrune = async () => {
    try {
      const result = await api.pruneSnapshots(projectId, pruneKeep);
      setConfirmPrune(false);
      addNotification({
        type: 'success',
        title: t('snapshots.pruneSuccess'),
        message: t('snapshots.pruneMessage')
          .replace('{deleted}', String(result.deleted))
          .replace('{remaining}', String(result.remaining)),
        autoClose: 5000,
      });
      loadSnapshots();
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('notifications.unknownError'),
        message: err instanceof Error ? err.message : '',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 bg-gray-900/30">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-semibold text-gray-300">{t('snapshots.title')}</span>
          <span className="text-[10px] text-gray-600">({snapshots.length})</span>
        </div>
        <button
          onClick={() => setConfirmPrune(true)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          {t('snapshots.prune')}
        </button>
      </div>

      {/* Prune confirm */}
      {confirmPrune && (
        <div className="px-3 py-2 bg-red-900/20 border-b border-red-800 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
          <span className="text-[11px] text-red-300 flex-1">
            {t('snapshots.pruneConfirm').replace('{keep}', String(pruneKeep))}
          </span>
          <input
            type="number"
            value={pruneKeep}
            onChange={(e) => setPruneKeep(Math.max(1, parseInt(e.target.value) || 100))}
            className="w-16 px-1 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-200"
          />
          <button
            onClick={handlePrune}
            className="px-2 py-0.5 text-[10px] bg-red-600 hover:bg-red-500 text-white rounded"
          >
            {t('snapshots.prune')}
          </button>
          <button
            onClick={() => setConfirmPrune(false)}
            className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto">
        {snapshots.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-600">{t('snapshots.noSnapshots')}</p>
          </div>
        )}

        {snapshots.map((snap) => (
          <div key={snap.id} className="border-b border-gray-800/50">
            <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800/30 transition-colors">
              {/* Expand toggle */}
              <button onClick={() => toggleFiles(snap.id)} className="text-gray-500 hover:text-gray-300">
                {expandedId === snap.id ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>

              {/* Commit hash */}
              <span className="text-[10px] font-mono text-blue-400 shrink-0">
                {snap.gitCommitHash?.substring(0, 8) ?? '---'}
              </span>

              {/* Label */}
              {editingLabel === snap.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    type="text"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveLabel(snap.id)}
                    className="flex-1 px-1 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded text-gray-200"
                    autoFocus
                  />
                  <button
                    onClick={() => saveLabel(snap.id)}
                    className="text-[10px] text-green-400 hover:text-green-300"
                  >
                    {t('common.ok')}
                  </button>
                  <button
                    onClick={() => setEditingLabel(null)}
                    className="text-[10px] text-gray-500 hover:text-gray-300"
                  >
                    {t('common.close')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {snap.label ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/30 border border-blue-800 rounded text-blue-300 truncate">
                      {snap.label}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingLabel(snap.id);
                        setLabelInput(snap.label ?? '');
                      }}
                      className="text-[10px] text-gray-600 hover:text-gray-400"
                    >
                      <Tag className="w-3 h-3" />
                    </button>
                  )}
                  {snap.isCritical && (
                    <Shield className="w-3 h-3 text-red-400 shrink-0" />
                  )}
                </div>
              )}

              {/* Timestamp */}
              <span className="text-[10px] text-gray-600 shrink-0 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {formatRelativeTime(snap.createdAt)}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleFiles(snap.id)}
                  className="text-gray-600 hover:text-gray-300 p-0.5"
                  title={t('snapshots.showFiles')}
                >
                  <Files className="w-3 h-3" />
                </button>
                {confirmRollback === snap.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRollback(snap.id)}
                      className="text-[9px] px-1.5 py-0.5 bg-orange-600 hover:bg-orange-500 text-white rounded"
                    >
                      {t('snapshots.rollback')}
                    </button>
                    <button
                      onClick={() => setConfirmRollback(null)}
                      className="text-[9px] text-gray-500"
                    >
                      {t('common.close')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRollback(snap.id)}
                    className="text-gray-600 hover:text-orange-400 p-0.5"
                    title={t('snapshots.rollback')}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Expanded files list */}
            {expandedId === snap.id && (
              <div className="px-6 py-2 bg-gray-900/30 border-t border-gray-800/50">
                {filesLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />
                    <span className="text-[10px] text-gray-500">{t('common.loading')}</span>
                  </div>
                ) : expandedFiles.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    <div className="text-[10px] text-gray-500 mb-1">
                      {expandedFiles.length} {t('snapshots.files')}
                    </div>
                    {expandedFiles.slice(0, 100).map((file) => (
                      <div key={file} className="text-[10px] font-mono text-gray-400 truncate">
                        {file}
                      </div>
                    ))}
                    {expandedFiles.length > 100 && (
                      <div className="text-[10px] text-gray-600">
                        +{expandedFiles.length - 100} more...
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600 py-1">{t('snapshots.noSnapshots')}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Load more */}
        {hasMore && snapshots.length > 0 && (
          <div className="px-3 py-3 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-3 py-1 text-[11px] text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-600 rounded transition-colors disabled:opacity-50 flex items-center gap-1 mx-auto"
            >
              {loadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
              {t('snapshots.loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
