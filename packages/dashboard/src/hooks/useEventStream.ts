import { useEffect } from 'react';
import type { VoltronWebSocket } from '../lib/ws';
import type { AiActionEvent, ExecutionState, ExecutionContext } from '@voltron/shared';
import { useEventStore } from '../stores/eventStore';
import { useControlStore } from '../stores/controlStore';
import { useFileTreeStore } from '../stores/fileTreeStore';
import { useZoneStore } from '../stores/zoneStore';
import { useNotificationStore } from '../stores/notificationStore';
import { useTranslation } from '../i18n';
import type { ProtectionZoneConfig } from '@voltron/shared';

export function useEventStream(client: VoltronWebSocket): void {
  const { t } = useTranslation();
  const addEvent = useEventStore((s) => s.addEvent);
  const setState = useControlStore((s) => s.setState);
  const addHistoryEntry = useControlStore((s) => s.addHistoryEntry);
  const addFile = useFileTreeStore((s) => s.addFile);
  const modifyFile = useFileTreeStore((s) => s.modifyFile);
  const deleteFile = useFileTreeStore((s) => s.deleteFile);
  const setZones = useZoneStore((s) => s.setZones);
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    // Listen to EVENT_BROADCAST messages
    const unsubEvent = client.on('EVENT_BROADCAST', (msg) => {
      const event = msg.payload as AiActionEvent;
      addEvent(event);

      // Update file tree based on action type
      switch (event.action) {
        case 'FILE_CREATE':
        case 'DIR_CREATE':
          addFile(event.file, event.action, event.timestamp, event.risk);
          break;
        case 'FILE_MODIFY':
        case 'FILE_RENAME':
        case 'DEPENDENCY_CHANGE':
        case 'CONFIG_CHANGE':
          modifyFile(event.file, event.action, event.timestamp, event.risk);
          break;
        case 'FILE_DELETE':
        case 'DIR_DELETE':
          deleteFile(event.file, event.timestamp);
          break;
      }
    });

    // Listen to STATE_CHANGE messages
    const unsubState = client.on('STATE_CHANGE', (msg) => {
      const payload = msg.payload as {
        state: ExecutionState;
        context: ExecutionContext;
        reason?: string;
        actor?: string;
      };
      setState(payload.state, payload.context);
      addHistoryEntry({
        state: payload.state,
        timestamp: msg.timestamp,
        reason: payload.reason,
        actor: payload.actor,
      });
    });

    // Listen to RISK_ALERT messages
    const unsubRisk = client.on('RISK_ALERT', (msg) => {
      const payload = msg.payload as {
        riskLevel: string;
        message: string;
        eventId?: string;
      };
      addNotification({
        type: payload.riskLevel === 'CRITICAL' ? 'error' : 'warning',
        title: `${t('notifications.riskAlert')}: ${payload.riskLevel}`,
        message: payload.message,
        riskLevel: payload.riskLevel as AiActionEvent['risk'],
        autoClose: payload.riskLevel === 'CRITICAL' ? undefined : 10000,
      });
    });

    // Listen to ZONE_BROADCAST messages
    const unsubZone = client.on('ZONE_BROADCAST', (msg) => {
      const zones = msg.payload as ProtectionZoneConfig[];
      setZones(zones);
    });

    return () => {
      unsubEvent();
      unsubState();
      unsubRisk();
      unsubZone();
    };
  }, [client, t, addEvent, setState, addHistoryEntry, addFile, modifyFile, deleteFile, setZones, addNotification]);
}
