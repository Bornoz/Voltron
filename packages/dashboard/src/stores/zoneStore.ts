import { create } from 'zustand';
import type { ProtectionZoneConfig } from '@voltron/shared';

interface ZoneState {
  zones: ProtectionZoneConfig[];
  loading: boolean;

  setZones: (zones: ProtectionZoneConfig[]) => void;
  addZone: (zone: ProtectionZoneConfig) => void;
  updateZone: (zone: ProtectionZoneConfig) => void;
  removeZone: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useZoneStore = create<ZoneState>((set) => ({
  zones: [],
  loading: false,

  setZones: (zones) => set({ zones }),

  addZone: (zone) =>
    set((state) => ({
      zones: [...state.zones, zone],
    })),

  updateZone: (zone) =>
    set((state) => ({
      zones: state.zones.map((z) => (z.id === zone.id ? zone : z)),
    })),

  removeZone: (id) =>
    set((state) => ({
      zones: state.zones.filter((z) => z.id !== id),
    })),

  setLoading: (loading) => set({ loading }),
}));
