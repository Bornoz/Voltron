import { create } from 'zustand';
import type { RiskLevel } from '@voltron/shared';

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  riskLevel?: RiskLevel;
  timestamp: number;
  dismissed: boolean;
  autoClose?: number;
}

interface NotificationState {
  notifications: Notification[];

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'dismissed'>) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  getActive: () => Notification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (notification) =>
    set((state) => {
      const id = crypto.randomUUID();
      const entry: Notification = {
        ...notification,
        id,
        timestamp: Date.now(),
        dismissed: false,
      };

      // Auto-dismiss after timeout if set
      if (notification.autoClose) {
        setTimeout(() => {
          set((s) => ({
            notifications: s.notifications.map((n) =>
              n.id === id ? { ...n, dismissed: true } : n,
            ),
          }));
        }, notification.autoClose);
      }

      return {
        notifications: [entry, ...state.notifications].slice(0, 100),
      };
    }),

  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n,
      ),
    })),

  clearAll: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, dismissed: true })),
    })),

  getActive: () => get().notifications.filter((n) => !n.dismissed),
}));
