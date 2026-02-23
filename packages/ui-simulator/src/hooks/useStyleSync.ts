import { useCallback, useEffect, useRef } from 'react';
import { useStyleStore, type StyleEntry } from '../stores/styleStore';
import { useHistoryStore, createHistoryEntry } from '../stores/historyStore';
import { useSimulatorStore } from '../stores/simulatorStore';
import type { SandboxBridge, StyleAppliedPayload } from '../sandbox/SandboxBridge';

/**
 * Hook for bidirectional style sync between panels and the iframe.
 * Pushes style changes to the iframe via the bridge and listens
 * for style application confirmations.
 */
export function useStyleSync(bridge: SandboxBridge, onConstraint?: (constraint: { type: string; selector: string; property: string; value: string; description: string }) => void) {
  const selectedElement = useSimulatorStore((s) => s.selectedElement);
  const setStyle = useStyleStore((s) => s.setStyle);
  const applyPending = useStyleStore((s) => s.applyPending);
  const pushHistory = useHistoryStore((s) => s.push);

  // Track pending style confirmations
  const pendingConfirmations = useRef<Map<string, StyleEntry>>(new Map());

  // Listen for style application confirmations from the iframe
  useEffect(() => {
    const unsub = bridge.onMessage('STYLE_APPLIED', (msg) => {
      const payload = msg.payload as StyleAppliedPayload;
      const key = `${payload.selector}::${payload.property}`;

      if (payload.success) {
        pendingConfirmations.current.delete(key);
      } else {
        console.warn(`[useStyleSync] Failed to apply style: ${key}`);
        pendingConfirmations.current.delete(key);
      }
    });

    return unsub;
  }, [bridge]);

  /**
   * Update a single style property.
   * Stages the change in the store and pushes it to the iframe.
   */
  const updateStyle = useCallback(
    (property: string, value: string) => {
      if (!selectedElement) return;

      const selector = selectedElement.selector;
      const previousValue = selectedElement.computedStyles[property] ?? '';

      // Stage in store
      setStyle(selector, property, value, 'human');

      // Push to iframe immediately
      bridge.injectStyles(selector, property, value);

      // Track for confirmation
      const key = `${selector}::${property}`;
      pendingConfirmations.current.set(key, {
        property,
        value,
        previousValue,
        source: 'human',
        timestamp: Date.now(),
      });

      // Record in history for undo
      pushHistory(
        createHistoryEntry(
          'style',
          selector,
          `Change ${property}: ${previousValue} -> ${value}`,
          { selector, changes: [{ property, value }] },
          { selector, changes: [{ property, value: previousValue }] },
        ),
      );

      // Send constraint to server
      onConstraint?.({
        type: 'style_change',
        selector,
        property,
        value,
        description: `Change ${property}: ${previousValue} -> ${value}`,
      });
    },
    [selectedElement, setStyle, bridge, pushHistory, onConstraint],
  );

  /**
   * Apply all pending style changes for the selected element.
   */
  const applyAllPending = useCallback(() => {
    if (!selectedElement) return;

    const applied = applyPending(selectedElement.selector);
    for (const entry of applied) {
      bridge.injectStyles(selectedElement.selector, entry.property, entry.value);
    }
  }, [selectedElement, applyPending, bridge]);

  /**
   * Bulk update multiple style properties at once.
   */
  const updateMultipleStyles = useCallback(
    (styles: Record<string, string>) => {
      if (!selectedElement) return;

      const selector = selectedElement.selector;
      const forwardChanges: Array<{ property: string; value: string }> = [];
      const backwardChanges: Array<{ property: string; value: string }> = [];

      for (const [property, value] of Object.entries(styles)) {
        const previousValue = selectedElement.computedStyles[property] ?? '';
        setStyle(selector, property, value, 'human');
        bridge.injectStyles(selector, property, value);
        forwardChanges.push({ property, value });
        backwardChanges.push({ property, value: previousValue });
      }

      pushHistory(
        createHistoryEntry(
          'style',
          selector,
          `Bulk style update (${forwardChanges.length} properties)`,
          { selector, changes: forwardChanges },
          { selector, changes: backwardChanges },
        ),
      );
    },
    [selectedElement, setStyle, bridge, pushHistory],
  );

  return {
    updateStyle,
    applyAllPending,
    updateMultipleStyles,
  };
}
