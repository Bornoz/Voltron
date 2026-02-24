import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      username: null,
      login: (username, password) => {
        if (!username.trim() || !password.trim()) {
          return false;
        }
        set({ isAuthenticated: true, username: username.trim() });
        return true;
      },
      logout: () => set({ isAuthenticated: false, username: null }),
    }),
    {
      name: 'voltron-auth',
    },
  ),
);
