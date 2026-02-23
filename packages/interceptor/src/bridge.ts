import WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import { DEFAULTS, type WsMessage } from '@voltron/shared';

interface BridgeOptions {
  serverUrl: string;
  projectId: string;
  authToken: string;
}

export class ServerBridge {
  private ws: WebSocket | null = null;
  private clientId = uuid();
  private queue: unknown[] = [];
  private reconnectDelay: number = DEFAULTS.WS_RECONNECT_BASE;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private stopped = false;
  private lastSequenceNumber = 0;

  onCommand: ((type: string, payload: unknown) => void) | null = null;

  constructor(private options: BridgeOptions) {}

  connect(): void {
    if (this.stopped) return;
    this.ws = new WebSocket(this.options.serverUrl);

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectDelay = DEFAULTS.WS_RECONNECT_BASE;

      // Register
      this.ws!.send(JSON.stringify({
        type: 'REGISTER',
        clientType: 'interceptor',
        clientId: this.clientId,
        projectId: this.options.projectId,
        authToken: this.options.authToken,
        lastSequenceNumber: this.lastSequenceNumber,
      }));

      // Flush queue
      for (const msg of this.queue) {
        this.ws!.send(JSON.stringify(msg));
      }
      this.queue = [];

      // Heartbeat
      this.heartbeatTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.send('INTERCEPTOR_HEARTBEAT', {});
        }
      }, DEFAULTS.WS_HEARTBEAT_INTERVAL);

      console.log('[bridge] Connected to server');
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as WsMessage;
        if (msg.type === 'COMMAND_STOP' || msg.type === 'COMMAND_CONTINUE' || msg.type === 'ZONE_UPDATE' || msg.type === 'CONFIG_UPDATE') {
          this.onCommand?.(msg.type, msg.payload);
        }
      } catch {
        // ignore malformed
      }
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.clearHeartbeat();
      if (!this.stopped) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[bridge] WS error:', err.message);
    });
  }

  send(type: string, payload: unknown, correlationId?: string): void {
    const msg = {
      type,
      payload,
      correlationId,
      timestamp: Date.now(),
      clientId: this.clientId,
    };

    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      if (this.queue.length < DEFAULTS.WS_QUEUE_MAX) {
        this.queue.push(msg);
      }
    }
  }

  disconnect(): void {
    this.stopped = true;
    this.clearHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  isConnected(): boolean {
    return this.connected;
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    console.log(`[bridge] Reconnecting in ${this.reconnectDelay}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, DEFAULTS.WS_RECONNECT_MAX) as number;
      this.connect();
    }, this.reconnectDelay);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
