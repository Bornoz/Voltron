import { useEffect } from 'react';
import { useControl } from './useControl';

export function useKeyboard(projectId: string | null): void {
  const { stop } = useControl(projectId);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+Shift+S = Emergency STOP
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        stop();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stop]);
}
