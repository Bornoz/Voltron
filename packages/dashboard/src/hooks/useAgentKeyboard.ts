import { useEffect, useCallback } from 'react';

type KeyAction =
  | 'gps-fullscreen'
  | 'editor-fullscreen'
  | 'prompt-focus'
  | 'toggle-pause'
  | 'toggle-breakpoint'
  | 'escape-fullscreen'
  | 'toggle-output'
  | 'cycle-panel'
  | 'toggle-panel-menu';

interface UseAgentKeyboardOptions {
  onAction: (action: KeyAction) => void;
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts for agent workspace.
 *
 * Ctrl+Shift+G — GPS fullscreen
 * Ctrl+Shift+E — Editor fullscreen
 * Ctrl+Shift+P — Prompt injector focus
 * Space        — Pause/Resume (only when no input focused)
 * Ctrl+Shift+B — Toggle breakpoint
 * Escape       — Exit fullscreen
 * Ctrl+Shift+O — Toggle output drawer
 * Ctrl+Tab     — Cycle panels
 * Ctrl+Shift+L — Toggle panel menu
 */
export function useAgentKeyboard({ onAction, enabled = true }: UseAgentKeyboardOptions): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Don't capture when typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      // Ctrl+Tab — Cycle panels
      if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        onAction('cycle-panel');
        return;
      }

      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toUpperCase()) {
          case 'G':
            e.preventDefault();
            onAction('gps-fullscreen');
            return;
          case 'E':
            e.preventDefault();
            onAction('editor-fullscreen');
            return;
          case 'P':
            e.preventDefault();
            onAction('prompt-focus');
            return;
          case 'B':
            e.preventDefault();
            onAction('toggle-breakpoint');
            return;
          case 'O':
            e.preventDefault();
            onAction('toggle-output');
            return;
          case 'L':
            e.preventDefault();
            onAction('toggle-panel-menu');
            return;
        }
      }

      // Space for pause/resume — only when not in an input
      if (e.key === ' ' && !isInput && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        onAction('toggle-pause');
        return;
      }

      // Escape to exit fullscreen
      if (e.key === 'Escape') {
        onAction('escape-fullscreen');
        return;
      }
    },
    [onAction, enabled],
  );

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
