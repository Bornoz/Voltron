import { create } from 'zustand';
import {
  getProjectRules,
  updateProjectRules,
  toggleProjectRules,
  getProjectMemories,
  createProjectMemory,
  updateProjectMemory,
  deleteProjectMemory,
  toggleMemoryPin,
  getAgentSessionsTyped,
  type ProjectRules,
  type MemoryEntry,
  type AgentSessionInfo,
} from '../lib/api';

const USER_SETTINGS_KEY = 'voltron_user_settings';
const FALLBACK_MODEL = 'claude-sonnet-4-6';

/** Read the user's preferred default model from localStorage */
export function useUserDefaultModel(): string {
  try {
    const raw = localStorage.getItem(USER_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.defaultModel) return parsed.defaultModel;
    }
  } catch { /* ignore */ }
  return FALLBACK_MODEL;
}

interface SettingsState {
  // Rules
  rules: string;
  rulesActive: boolean;
  rulesLoading: boolean;
  rulesSaving: boolean;
  rulesLastSaved: number | null;
  loadRules: (projectId: string) => Promise<void>;
  saveRules: (projectId: string, content: string) => Promise<void>;
  toggleRules: (projectId: string) => Promise<void>;

  // Memory
  memories: MemoryEntry[];
  memoriesLoading: boolean;
  loadMemories: (projectId: string, category?: string) => Promise<void>;
  addMemory: (projectId: string, entry: { category: string; title: string; content: string }) => Promise<void>;
  updateMemory: (projectId: string, id: string, data: Partial<{ title: string; content: string; category: string }>) => Promise<void>;
  deleteMemory: (projectId: string, id: string) => Promise<void>;
  togglePin: (projectId: string, id: string) => Promise<void>;

  // Session History
  sessions: AgentSessionInfo[];
  sessionsLoading: boolean;
  loadSessions: (projectId: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Rules
  rules: '',
  rulesActive: true,
  rulesLoading: false,
  rulesSaving: false,
  rulesLastSaved: null,

  loadRules: async (projectId) => {
    set({ rulesLoading: true });
    try {
      const data = await getProjectRules(projectId);
      set({
        rules: data.content,
        rulesActive: data.isActive,
        rulesLoading: false,
        rulesLastSaved: data.updatedAt ?? null,
      });
    } catch {
      set({ rulesLoading: false });
    }
  },

  saveRules: async (projectId, content) => {
    set({ rulesSaving: true });
    try {
      const data = await updateProjectRules(projectId, content);
      set({
        rules: data.content,
        rulesSaving: false,
        rulesLastSaved: data.updatedAt ?? Date.now(),
      });
    } catch {
      set({ rulesSaving: false });
    }
  },

  toggleRules: async (projectId) => {
    try {
      const result = await toggleProjectRules(projectId);
      set({ rulesActive: result.isActive });
    } catch {
      // ignore
    }
  },

  // Memory
  memories: [],
  memoriesLoading: false,

  loadMemories: async (projectId, category?) => {
    set({ memoriesLoading: true });
    try {
      const data = await getProjectMemories(projectId, category);
      set({ memories: data, memoriesLoading: false });
    } catch {
      set({ memoriesLoading: false });
    }
  },

  addMemory: async (projectId, entry) => {
    try {
      const created = await createProjectMemory(projectId, entry);
      set((s) => ({ memories: [created, ...s.memories] }));
    } catch {
      // ignore
    }
  },

  updateMemory: async (projectId, id, data) => {
    try {
      const updated = await updateProjectMemory(projectId, id, data);
      set((s) => ({
        memories: s.memories.map((m) => (m.id === id ? updated : m)),
      }));
    } catch {
      // ignore
    }
  },

  deleteMemory: async (projectId, id) => {
    try {
      await deleteProjectMemory(projectId, id);
      set((s) => ({ memories: s.memories.filter((m) => m.id !== id) }));
    } catch {
      // ignore
    }
  },

  togglePin: async (projectId, id) => {
    try {
      const result = await toggleMemoryPin(projectId, id);
      set((s) => ({
        memories: s.memories.map((m) =>
          m.id === id ? { ...m, pinned: result.pinned } : m,
        ),
      }));
    } catch {
      // ignore
    }
  },

  // Sessions
  sessions: [],
  sessionsLoading: false,

  loadSessions: async (projectId) => {
    set({ sessionsLoading: true });
    try {
      const data = await getAgentSessionsTyped(projectId);
      set({ sessions: data, sessionsLoading: false });
    } catch {
      set({ sessionsLoading: false });
    }
  },
}));
