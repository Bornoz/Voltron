import { useEffect, useState, useCallback, useRef } from 'react';
import { getWsClient, type ConnectionStatus, type VoltronWebSocket } from '../lib/ws';
import type { WsMessageType } from '@voltron/shared';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  send: (type: WsMessageType, payload: unknown) => void;
  client: VoltronWebSocket;
}

export function useWebSocket(projectId: string | null): UseWebSocketReturn {
  const clientRef = useRef(getWsClient());
  const [status, setStatus] = useState<ConnectionStatus>(clientRef.current.status);

  useEffect(() => {
    const client = clientRef.current;
    const unsub = client.onStatusChange(setStatus);

    if (projectId) {
      client.connect(projectId);
    }

    return () => {
      unsub();
      client.disconnect();
    };
  }, [projectId]);

  const send = useCallback((type: WsMessageType, payload: unknown) => {
    clientRef.current.send(type, payload);
  }, []);

  return {
    status,
    send,
    client: clientRef.current,
  };
}
