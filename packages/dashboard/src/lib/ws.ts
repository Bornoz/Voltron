import type { WsMessage, WsMessageType } from '@voltron/shared';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export type WsCallback = (message: WsMessage) => void;

const WS_RECONNECT_BASE = 2000;
const WS_RECONNECT_MAX = 30000;
const WS_MAX_QUEUE_SIZE = 500;

export class VoltronWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks = new Map<string, Set<WsCallback>>();
  private globalCallbacks = new Set<WsCallback>();
  private _status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private clientId: string;
  private projectId: string | null = null;
  private url: string;
  private shouldReconnect = true;
  private messageQueue: string[] = [];

  constructor(url?: string) {
    this.clientId = crypto.randomUUID();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = url ?? `${protocol}//${window.location.host}/ws`;
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  get id(): string {
    return this.clientId;
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  onStatusChange(cb: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }

  connect(projectId: string): void {
    this.projectId = projectId;
    this.shouldReconnect = true;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.setStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
      this.register();
      this.flushQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WsMessage;
        this.dispatch(message);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.setStatus('disconnected');
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private register(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.projectId) return;
    this.ws.send(
      JSON.stringify({
        type: 'REGISTER',
        clientType: 'dashboard',
        clientId: this.clientId,
        projectId: this.projectId,
      }),
    );
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift()!;
      this.ws.send(msg);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.setStatus('reconnecting');
    const delay = Math.min(
      WS_RECONNECT_BASE * Math.pow(2, this.reconnectAttempts),
      WS_RECONNECT_MAX,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  private dispatch(message: WsMessage): void {
    // Fire global listeners
    this.globalCallbacks.forEach((cb) => cb(message));
    // Fire type-specific listeners
    const typeCallbacks = this.callbacks.get(message.type);
    if (typeCallbacks) {
      typeCallbacks.forEach((cb) => cb(message));
    }
    // Emit CustomEvent for components that listen via DOM events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('voltron-ws-event', { detail: message }));
    }
  }

  on(type: WsMessageType | '*', callback: WsCallback): () => void {
    if (type === '*') {
      this.globalCallbacks.add(callback);
      return () => {
        this.globalCallbacks.delete(callback);
      };
    }
    let set = this.callbacks.get(type);
    if (!set) {
      set = new Set();
      this.callbacks.set(type, set);
    }
    set.add(callback);
    return () => {
      set!.delete(callback);
    };
  }

  send(type: WsMessageType, payload: unknown): void {
    const message: WsMessage = {
      type,
      payload,
      timestamp: Date.now(),
      clientId: this.clientId,
    };
    const data = JSON.stringify(message);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      if (this.messageQueue.length >= WS_MAX_QUEUE_SIZE) {
        this.messageQueue.shift(); // drop oldest
      }
      this.messageQueue.push(data);
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.messageQueue = [];
    this.setStatus('disconnected');
  }
}

// Singleton
let instance: VoltronWebSocket | null = null;

export function getWsClient(): VoltronWebSocket {
  if (!instance) {
    instance = new VoltronWebSocket();
  }
  return instance;
}
