import { useEffect, useRef, useCallback } from 'react';
import { SimulatorWebSocket } from '../lib/ws';
import { useSimulatorStore } from '../stores/simulatorStore';
import type { AgentStatus, AgentLocation } from '@voltron/shared';
import type { DesignSnapshotPayload } from '../sandbox/SandboxBridge';

/**
 * Connects the UI Simulator to the Voltron server via WebSocket.
 * - Listens for EVENT_BROADCAST -> feeds file changes
 * - Listens for AGENT_STATUS_CHANGE -> updates simulator store
 * - Sends SIMULATOR_CONSTRAINT on human edits
 * - Sends SIMULATOR_REFERENCE_IMAGE on image upload
 * - Sends SIMULATOR_DESIGN_SNAPSHOT for design changes
 */
export function useServerSync(projectId: string | null) {
  const wsRef = useRef<SimulatorWebSocket | null>(null);
  const setConnected = useSimulatorStore((s) => s.setConnected);
  const setAgentStatus = useSimulatorStore((s) => s.setAgentStatus);
  const setAgentCurrentFile = useSimulatorStore((s) => s.setAgentCurrentFile);
  const addPendingConstraint = useSimulatorStore((s) => s.addPendingConstraint);

  useEffect(() => {
    if (!projectId) return;

    const ws = new SimulatorWebSocket();
    wsRef.current = ws;

    ws.onStatusChange((status) => {
      setConnected(status === 'connected');
    });

    // Listen for agent status changes
    ws.on('AGENT_STATUS_CHANGE', (msg) => {
      const payload = msg.payload as { status: AgentStatus; projectId: string };
      setAgentStatus(payload.status);
    });

    // Listen for agent location updates
    ws.on('AGENT_LOCATION_UPDATE', (msg) => {
      const payload = msg.payload as { location: AgentLocation };
      setAgentCurrentFile(payload.location.filePath);
    });

    // Listen for event broadcasts (file changes from interceptor)
    ws.on('EVENT_BROADCAST', (msg) => {
      const event = msg.payload as { file: string; action: string; diff?: string };
      // The AiResync module will handle applying these changes
      // This is wired separately in App.tsx
    });

    ws.connect(projectId);

    return () => {
      ws.disconnect();
      wsRef.current = null;
    };
  }, [projectId, setConnected, setAgentStatus, setAgentCurrentFile]);

  /**
   * Send a style/layout constraint to the server.
   */
  const sendConstraint = useCallback((constraint: {
    type: string;
    selector?: string;
    property?: string;
    value?: string;
    description: string;
  }) => {
    wsRef.current?.send('SIMULATOR_CONSTRAINT', constraint);
  }, []);

  /**
   * Send a reference image to the server.
   */
  const sendReferenceImage = useCallback((imageUrl: string, description: string) => {
    wsRef.current?.send('SIMULATOR_REFERENCE_IMAGE', { imageUrl, description });
  }, []);

  /**
   * Send a design snapshot (all human-made changes) to the server.
   */
  const sendDesignSnapshot = useCallback((snapshot: DesignSnapshotPayload) => {
    wsRef.current?.send('SIMULATOR_DESIGN_SNAPSHOT', snapshot);
  }, []);

  return {
    wsClient: wsRef.current,
    sendConstraint,
    sendReferenceImage,
    sendDesignSnapshot,
  };
}
