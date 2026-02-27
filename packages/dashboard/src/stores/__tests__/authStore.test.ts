import { describe, it, expect, beforeEach, vi } from 'vitest';

// Must define localStorage before authStore module loads (imports are hoisted)
vi.hoisted(() => {
  const store: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { Reflect.deleteProperty(store, key); },
    clear: () => { Object.keys(store).forEach(k => Reflect.deleteProperty(store, k)); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
});

import { useAuthStore } from '../authStore';

function getState() {
  return useAuthStore.getState();
}

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('authStore', () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    mockFetch.mockReset();
    // Reset store
    useAuthStore.setState({
      isAuthenticated: false,
      username: null,
      loading: false,
      error: null,
    });
  });

  describe('login', () => {
    it('should reject empty username', async () => {
      const result = await getState().login('', 'password');
      expect(result).toBe(false);
      expect(getState().error).toBe('Username and password cannot be empty');
    });

    it('should reject empty password', async () => {
      const result = await getState().login('admin', '  ');
      expect(result).toBe(false);
      expect(getState().error).toBe('Username and password cannot be empty');
    });

    it('should login successfully with valid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'test-token-123', expiresAt: Date.now() + 3600000 }),
      });

      const result = await getState().login('admin', 'password');
      expect(result).toBe(true);
      expect(getState().isAuthenticated).toBe(true);
      expect(getState().username).toBe('admin');
      expect(getState().loading).toBe(false);
      expect(getState().error).toBeNull();
      expect(localStorage.getItem('voltron_token')).toBe('test-token-123');
    });

    it('should handle login failure from server', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      const result = await getState().login('admin', 'wrong');
      expect(result).toBe(false);
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().error).toBe('Invalid credentials');
      expect(getState().loading).toBe(false);
    });

    it('should handle server error with fallback error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('parse error'); },
      });

      const result = await getState().login('admin', 'wrong');
      expect(result).toBe(false);
      expect(getState().error).toBe('Login failed');
    });

    it('should pass through on 404 (auth not configured)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      });

      const result = await getState().login('admin', 'password');
      expect(result).toBe(true);
      expect(getState().isAuthenticated).toBe(true);
      expect(localStorage.getItem('voltron_token')).toBe('dev-mode');
    });

    it('should fail on network error (no bypass)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getState().login('admin', 'password');
      expect(result).toBe(false);
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().error).toBe('Server unreachable. Please check the connection.');
    });

    it('should trim username', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ token: 'tok', expiresAt: 0 }),
      });

      await getState().login('  admin  ', 'pass');
      expect(getState().username).toBe('admin');
    });

    it('should set loading during login', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise((r) => { resolvePromise = r; });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const loginPromise = getState().login('admin', 'pass');
      // Loading should be true while waiting
      expect(getState().loading).toBe(true);

      resolvePromise!({
        ok: true,
        status: 200,
        json: async () => ({ token: 'tok', expiresAt: 0 }),
      });

      await loginPromise;
      expect(getState().loading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear auth state on logout', () => {
      useAuthStore.setState({ isAuthenticated: true, username: 'admin' });
      getState().logout();
      expect(getState().isAuthenticated).toBe(false);
      expect(getState().username).toBeNull();
      expect(localStorage.getItem('voltron_token')).toBeNull();
    });

    it('should clear error on logout', () => {
      useAuthStore.setState({ isAuthenticated: true, error: 'some error' });
      getState().logout();
      expect(getState().error).toBeNull();
    });
  });
});
