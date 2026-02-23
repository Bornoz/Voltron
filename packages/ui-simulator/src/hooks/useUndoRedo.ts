import { useEffect, useCallback } from 'react';
import { useHistoryStore, type HistoryEntry } from '../stores/historyStore';
import type { SandboxBridge } from '../sandbox/SandboxBridge';

/**
 * Hook that wraps the undo/redo history store with keyboard shortcuts.
 * Ctrl+Z for undo, Ctrl+Shift+Z (or Ctrl+Y) for redo.
 * Applies the inverse changes to the iframe via the bridge.
 */
export function useUndoRedo(bridge?: SandboxBridge | null) {
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);
  const undoDescription = useHistoryStore((s) => s.getUndoDescription);
  const redoDescription = useHistoryStore((s) => s.getRedoDescription);

  /**
   * Apply a history entry's changes to the iframe.
   */
  const applyChanges = useCallback(
    (entry: HistoryEntry, direction: 'forward' | 'backward') => {
      const record = direction === 'forward' ? entry.forward : entry.backward;

      if (!bridge) return;

      switch (entry.type) {
        case 'style':
          for (const change of record.changes) {
            bridge.injectStyles(record.selector, change.property, change.value);
          }
          break;
        case 'layout':
          for (const change of record.changes) {
            bridge.updateLayout(record.selector, { [change.property]: change.value });
          }
          break;
        case 'prop':
          for (const change of record.changes) {
            bridge.updateProps(record.selector, { [change.property]: change.value });
          }
          break;
        case 'add':
          if (direction === 'backward') {
            // Undo add = delete
            bridge.deleteElement(record.selector);
          } else {
            // Redo add = re-add
            if (record.elementHTML && record.parentSelector) {
              bridge.addElement({
                tagName: 'div',
                parentSelector: record.parentSelector,
                position: 'append',
                innerHTML: record.elementHTML,
              });
            }
          }
          break;
        case 'delete':
          if (direction === 'backward') {
            // Undo delete = re-add the element
            if (record.elementHTML && record.parentSelector) {
              bridge.addElement({
                tagName: 'div',
                parentSelector: record.parentSelector,
                position: 'append',
                innerHTML: record.elementHTML,
              });
            }
          } else {
            // Redo delete = delete again
            bridge.deleteElement(record.selector);
          }
          break;
        case 'move':
          for (const change of record.changes) {
            bridge.updateLayout(record.selector, { [change.property]: change.value });
          }
          break;
        case 'duplicate':
          if (direction === 'backward') {
            // Undo duplicate = delete the clone
            bridge.deleteElement(record.selector);
          } else {
            // Redo duplicate = duplicate again
            bridge.duplicateElement(record.selector);
          }
          break;
      }
    },
    [bridge],
  );

  const handleUndo = useCallback(() => {
    const entry = undo();
    if (entry) {
      applyChanges(entry, 'backward');
    }
  }, [undo, applyChanges]);

  const handleRedo = useCallback(() => {
    const entry = redo();
    if (entry) {
      applyChanges(entry, 'forward');
    }
  }, [redo, applyChanges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      if (isCtrlOrCmd && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  return {
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
  };
}
