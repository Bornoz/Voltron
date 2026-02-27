import { create } from 'zustand';
import type { RiskLevel } from '@voltron/shared';
import { areNotificationsEnabled } from '../components/Agent/SettingsModal';

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

// Track auto-dismiss timers so we can clean them up
const autoCloseTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  addNotification: (notification) =>
    set((state) => {
      // Respect user notification settings (errors always shown)
      if (!areNotificationsEnabled() && notification.type !== 'error') {
        return state;
      }
      const id = crypto.randomUUID();
      const entry: Notification = {
        ...notification,
        id,
        timestamp: Date.now(),
        dismissed: false,
      };

      // Auto-dismiss after timeout if set
      if (notification.autoClose) {
        const timer = setTimeout(() => {
          autoCloseTimers.delete(id);
          set((s) => ({
            notifications: s.notifications.map((n) =>
              n.id === id ? { ...n, dismissed: true } : n,
            ),
          }));
        }, notification.autoClose);
        autoCloseTimers.set(id, timer);
      }

      return {
        notifications: [entry, ...state.notifications].slice(0, 100),
      };
    }),

  dismiss: (id) => {
    // Clear any pending auto-close timer
    const timer = autoCloseTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      autoCloseTimers.delete(id);
    }
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, dismissed: true } : n,
      ),
    }));
  },

  clearAll: () => {
    // Clear all pending timers
    for (const [id, timer] of autoCloseTimers) {
      clearTimeout(timer);
    }
    autoCloseTimers.clear();
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, dismissed: true })),
    }));
  },

  getActive: () => get().notifications.filter((n) => !n.dismissed),
}));
