import { create } from 'zustand';
import type { AiToolScanResult, AiToolDetectionResult } from '@voltron/shared';
import { getAiTools, rescanAiTools } from '../lib/api';

interface AiToolStore {
  scanResult: AiToolScanResult | null;
  loading: boolean;
  error: string | null;

  /** Fetch scan results (uses server cache if available) */
  fetch: () => Promise<void>;

  /** Force a fresh rescan */
  rescan: () => Promise<void>;

  /** Get only detected + spawnable tools */
  getSpawnableTools: () => AiToolDetectionResult[];
}

export const useAiToolStore = create<AiToolStore>((set, get) => ({
  scanResult: null,
  loading: false,
  error: null,

  fetch: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const result = await getAiTools();
      set({ scanResult: result, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  rescan: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const result = await rescanAiTools();
      set({ scanResult: result, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  getSpawnableTools: () => {
    const { scanResult } = get();
    if (!scanResult) return [];
    return scanResult.tools.filter(
      (t) => t.status === 'detected' && t.capabilities.canSpawn,
    );
  },
}));
