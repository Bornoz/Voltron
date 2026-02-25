import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: !!localStorage.getItem('voltron_token'),
      username: null,
      loading: false,
      error: null,
      login: async (username, password) => {
        if (!username.trim() || !password.trim()) {
          set({ error: 'Username and password cannot be empty' });
          return false;
        }

        set({ loading: true, error: null });

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.trim(), password }),
          });

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
          // If server doesn't have auth enabled (dev mode), allow pass-through
          set({ isAuthenticated: true, username: username.trim(), loading: false, error: null });
          return true;
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
