import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Shield, ShieldAlert, ShieldOff, Edit2, Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useZoneStore } from '../../stores/zoneStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { useTranslation } from '../../i18n';
import * as api from '../../lib/api';
import type { ProtectionLevel } from '@voltron/shared';

const levelIcons = {
  NONE: ShieldOff,
  SURGICAL_ONLY: Shield,
  DO_NOT_TOUCH: ShieldAlert,
};

const levelColors = {
  NONE: 'text-gray-400 bg-gray-800',
  SURGICAL_ONLY: 'text-yellow-400 bg-yellow-900/30',
  DO_NOT_TOUCH: 'text-red-400 bg-red-900/30',
};

interface ZoneManagerProps {
  projectId: string | null;
}

export function ZoneManager({ projectId }: ZoneManagerProps) {
  const { t } = useTranslation();
  const zones = useZoneStore((s) => s.zones);
  const setZones = useZoneStore((s) => s.setZones);
  const addZone = useZoneStore((s) => s.addZone);
  const removeZone = useZoneStore((s) => s.removeZone);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [showForm, setShowForm] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newLevel, setNewLevel] = useState<ProtectionLevel>('SURGICAL_ONLY');
  const [newReason, setNewReason] = useState('');

  // Load zones on mount
  const loadZones = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api.getZones(projectId);
      setZones(data);
    } catch {
      // Silently fail - zones will be empty
    }
  }, [projectId, setZones]);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  const handleCreate = async () => {
    if (!projectId || !newPath.trim()) return;
    try {
      const zone = await api.createZone(projectId, {
        path: newPath.trim(),
        level: newLevel,
        reason: newReason.trim() || undefined,
      });
      addZone(zone);
      setNewPath('');
      setNewReason('');
      setShowForm(false);
      addNotification({
        type: 'success',
        title: t('zoneManager.zoneCreated'),
        message: t('zoneManager.zoneCreatedMessage').replace('{path}', newPath),
        autoClose: 3000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('zoneManager.createFailed'),
        message: err instanceof Error ? err.message : t('notifications.unknownError'),
      });
    }
  };

  const handleDelete = async (zoneId: string) => {
    if (!projectId) return;
    try {
      await api.deleteZone(projectId, zoneId);
      removeZone(zoneId);
      addNotification({
        type: 'info',
        title: t('zoneManager.zoneDeleted'),
        message: t('zoneManager.zoneDeletedMessage'),
        autoClose: 3000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('zoneManager.deleteFailed'),
        message: err instanceof Error ? err.message : t('zoneManager.cannotDeleteSystem'),
      });
    }
  };

  return (
    <div className="p-2 space-y-2">
      {/* Zone list */}
      {zones.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">{t('zoneManager.noZones')}</p>
      ) : (
        zones.map((zone) => {
          const LevelIcon = levelIcons[zone.level];
          return (
            <div
              key={zone.id}
              className="flex items-start gap-2 p-2 rounded-lg border border-gray-800 bg-gray-900/50"
            >
              <LevelIcon className={clsx('w-4 h-4 mt-0.5 shrink-0', levelColors[zone.level])} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-300 truncate" title={zone.path}>
                    {zone.path}
                  </span>
                  <span
                    className={clsx(
                      'text-[9px] px-1.5 py-0.5 rounded font-medium',
                      levelColors[zone.level],
                    )}
                  >
                    {zone.level.replace('_', ' ')}
                  </span>
                </div>
                {zone.reason && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{zone.reason}</p>
                )}
              </div>
              {!zone.isSystem && (
                <button
                  onClick={() => handleDelete(zone.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                  title={t('zoneManager.deleteZone')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })
      )}

      {/* Add form */}
      {showForm ? (
        <div className="p-2 rounded-lg border border-gray-700 bg-gray-800/50 space-y-2">
          <input
            type="text"
            placeholder={t('zoneManager.pathPattern')}
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as ProtectionLevel)}
            className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-blue-500"
          >
            <option value="SURGICAL_ONLY">SURGICAL ONLY</option>
            <option value="DO_NOT_TOUCH">DO NOT TOUCH</option>
            <option value="NONE">NONE</option>
          </select>
          <input
            type="text"
            placeholder={t('zoneManager.reasonOptional')}
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            className="w-full px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-1">
            <button
              onClick={handleCreate}
              disabled={!newPath.trim()}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
            >
              <Check className="w-3 h-3" /> {t('zoneManager.save')}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
            >
              <X className="w-3 h-3" /> {t('zoneManager.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 w-full px-2 py-1.5 text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 rounded transition-colors"
        >
          <Plus className="w-3 h-3" /> {t('zoneManager.addZone')}
        </button>
      )}
    </div>
  );
}
