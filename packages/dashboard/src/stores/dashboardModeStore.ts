import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DashboardMode = 'essential' | 'active' | 'power';

interface DashboardModeState {
  mode: DashboardMode;
  setMode: (mode: DashboardMode) => void;
}

export const useDashboardModeStore = create<DashboardModeState>()(
  persist(
    (set) => ({
      mode: 'essential',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'voltron-dashboard-mode',
    }
  )
);
