import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  loading: boolean;
  error: string | null;
  setupRequired: boolean | null; // null = not checked yet
  checkSetup: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

function apiBase(): string {
  try {
    return import.meta.env.DEV ? 'http://localhost:8600' : '';
  } catch {
    return '';
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: !!localStorage.getItem('voltron_token'),
      username: null,
      loading: false,
      error: null,
      setupRequired: null,

      checkSetup: async () => {
        try {
          const res = await fetch(`${apiBase()}/api/auth/setup-required`);
          if (res.ok) {
            const data = await res.json() as { setupRequired: boolean };
            set({ setupRequired: data.setupRequired });
          } else {
            // If endpoint doesn't exist (old server), assume no setup needed
            set({ setupRequired: false });
          }
        } catch {
          set({ setupRequired: false });
        }
      },

      login: async (username, password) => {
        if (!username.trim() || !password.trim()) {
          set({ error: 'Username and password cannot be empty' });
          return false;
        }

        set({ loading: true, error: null });

        try {
          const res = await fetch(`${apiBase()}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.trim(), password }),
          });

          if (res.status === 404) {
            // Auth route not registered — server doesn't require app-level auth (dev mode)
            localStorage.setItem('voltron_token', 'dev-mode');
            set({ isAuthenticated: true, username: username.trim(), loading: false, error: null });
            return true;
          }

          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: 'Login failed' }));
            set({ loading: false, error: body.error ?? 'Login failed' });
            return false;
          }

          const { token } = await res.json() as { token: string; expiresAt: number };
          localStorage.setItem('voltron_token', token);
          set({ isAuthenticated: true, username: username.trim(), loading: false, error: null });
          return true;
        } catch {
          set({ loading: false, error: 'Server unreachable. Please check the connection.' });
          return false;
        }
      },

      register: async (username, password) => {
        if (!username.trim() || !password.trim()) {
          set({ error: 'Username and password cannot be empty' });
          return false;
        }

        set({ loading: true, error: null });

        try {
          const res = await fetch(`${apiBase()}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.trim(), password }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: 'Registration failed' }));
            set({ loading: false, error: body.error ?? 'Registration failed' });
            return false;
          }

          const data = await res.json() as { token: string; expiresAt: number; username: string };
          localStorage.setItem('voltron_token', data.token);
          set({
            isAuthenticated: true,
            username: data.username,
            loading: false,
            error: null,
            setupRequired: false,
          });
          return true;
        } catch {
          set({ loading: false, error: 'Server unreachable. Please check the connection.' });
          return false;
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        const token = localStorage.getItem('voltron_token');
        if (!token) return { success: false, error: 'Not authenticated' };

        try {
          const res = await fetch(`${apiBase()}/api/auth/change-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ currentPassword, newPassword }),
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: 'Password change failed' }));
            return { success: false, error: body.error ?? 'Password change failed' };
          }

          return { success: true };
        } catch {
          return { success: false, error: 'Server unreachable' };
        }
      },

      logout: () => {
        localStorage.removeItem('voltron_token');
        set({ isAuthenticated: false, username: null, error: null });
      },
    }),
    {
      name: 'voltron-auth',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, username: state.username }),
    },
  ),
);
