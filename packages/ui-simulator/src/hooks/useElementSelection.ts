import { useCallback, useEffect } from 'react';
import { useSimulatorStore, type ElementInfo } from '../stores/simulatorStore';
import type { SandboxBridge, ElementSelectedPayload } from '../sandbox/SandboxBridge';

/**
 * Hook for managing element selection from the iframe.
 * Listens for ELEMENT_SELECTED messages from the SandboxBridge
 * and updates the simulator store with the selected element info.
 */
export function useElementSelection(bridge: SandboxBridge) {
  const setSelectedElement = useSimulatorStore((s) => s.setSelectedElement);
  const setElementPath = useSimulatorStore((s) => s.setElementPath);
  const selectedElement = useSimulatorStore((s) => s.selectedElement);

  const handleElementSelected = useCallback(
    (payload: ElementSelectedPayload) => {
      const elementInfo: ElementInfo = {
        selector: payload.selector,
        tagName: payload.tagName,
        id: payload.id,
        classList: payload.classList,
        computedStyles: payload.computedStyles,
        bounds: payload.bounds,
        textContent: payload.textContent,
        attributes: payload.attributes,
        parentSelector: payload.parentSelector,
        childCount: payload.childCount,
      };

      setSelectedElement(elementInfo);
      setElementPath(payload.elementPath);
    },
    [setSelectedElement, setElementPath],
  );

  useEffect(() => {
    const unsub = bridge.onMessage('ELEMENT_SELECTED', (msg) => {
      handleElementSelected(msg.payload as ElementSelectedPayload);
    });

    return unsub;
  }, [bridge, handleElementSelected]);

  const clearSelection = useCallback(() => {
    useSimulatorStore.getState().clearSelection();
  }, []);

  const refreshSelection = useCallback(() => {
    if (selectedElement) {
      bridge.requestSnapshot();
    }
  }, [bridge, selectedElement]);

  return {
    selectedElement,
    clearSelection,
    refreshSelection,
    handleElementSelected,
  };
}
