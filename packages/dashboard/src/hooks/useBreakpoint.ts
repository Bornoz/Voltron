import { useSyncExternalStore } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const MOBILE_MAX = '(max-width: 767px)';
const TABLET = '(min-width: 768px) and (max-width: 1023px)';

function getBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(MOBILE_MAX).matches) return 'mobile';
  if (window.matchMedia(TABLET).matches) return 'tablet';
  return 'desktop';
}

let currentBreakpoint = getBreakpoint();
const listeners = new Set<() => void>();

// Module-level: single listener pair for both media queries
if (typeof window !== 'undefined') {
  const handler = () => {
    const next = getBreakpoint();
    if (next !== currentBreakpoint) {
      currentBreakpoint = next;
      listeners.forEach((l) => l());
    }
  };
  window.matchMedia(MOBILE_MAX).addEventListener('change', handler);
  window.matchMedia(TABLET).addEventListener('change', handler);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): Breakpoint {
  return currentBreakpoint;
}

function getServerSnapshot(): Breakpoint {
  return 'desktop';
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useIsMobile(): boolean {
  return useBreakpoint() === 'mobile';
}
