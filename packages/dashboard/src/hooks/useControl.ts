import { useCallback } from 'react';
import * as api from '../lib/api';
import { useTranslation } from '../i18n';
import { useControlStore } from '../stores/controlStore';
import { useNotificationStore } from '../stores/notificationStore';

interface UseControlReturn {
  stop: () => Promise<void>;
  continue_: () => Promise<void>;
  reset: () => Promise<void>;
}

export function useControl(projectId: string | null): UseControlReturn {
  const { t } = useTranslation();
  const setState = useControlStore((s) => s.setState);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const stop = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await api.controlStop(projectId);
      setState(result.state, result.context);
      addNotification({
        type: 'warning',
        title: t('notifications.executionStopped'),
        message: t('notifications.stoppedMessage'),
        autoClose: 5000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('notifications.stopFailed'),
        message: err instanceof Error ? err.message : t('notifications.unknownError'),
      });
    }
  }, [projectId, setState, addNotification, t]);

  const continue_ = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await api.controlContinue(projectId);
      setState(result.state, result.context);
      addNotification({
        type: 'success',
        title: t('notifications.executionResumed'),
        message: t('notifications.resumedMessage'),
        autoClose: 5000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('notifications.continueFailed'),
        message: err instanceof Error ? err.message : t('notifications.unknownError'),
      });
    }
  }, [projectId, setState, addNotification, t]);

  const reset = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await api.controlReset(projectId);
      setState(result.state, result.context);
      addNotification({
        type: 'info',
        title: t('notifications.executionReset'),
        message: t('notifications.resetMessage'),
        autoClose: 5000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: t('notifications.resetFailed'),
        message: err instanceof Error ? err.message : t('notifications.unknownError'),
      });
    }
  }, [projectId, setState, addNotification, t]);

  return { stop, continue_, reset };
}
