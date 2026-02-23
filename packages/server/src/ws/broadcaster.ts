import type { WebSocket } from 'ws';
import type { ClientType } from '@voltron/shared';

interface RegisteredClient {
  ws: WebSocket;
  clientId: string;
  clientType: ClientType;
  projectId: string;
  connectedAt: number;
  /** Pending send queue size estimation */
  pendingSends: number;
  /** Last time we sent a message to this client */
  lastSendAt: number;
}

export interface OperatorInfo {
  clientId: string;
  projectId: string;
  connectedAt: number;
  /** Approximate pending send queue depth */
  pendingSends: number;
}

export interface ConnectionCounts {
  total: number;
  byType: Record<string, number>;
  byProject: Record<string, { interceptors: number; dashboards: number; simulators: number; total: number }>;
}

const SLOW_CLIENT_THRESHOLD = 100; // Max pending sends before disconnect

export class Broadcaster {
  private clients = new Map<string, RegisteredClient>();

  register(client: Omit<RegisteredClient, 'pendingSends' | 'lastSendAt'>): void {
    this.clients.set(client.clientId, {
      ...client,
      pendingSends: 0,
      lastSendAt: 0,
    });
  }

  unregister(clientId: string): void {
    this.clients.delete(clientId);
  }

  getClient(clientId: string): RegisteredClient | undefined {
    return this.clients.get(clientId);
  }

  getClientsByType(clientType: ClientType, projectId?: string): RegisteredClient[] {
    const result: RegisteredClient[] = [];
    for (const client of this.clients.values()) {
      if (client.clientType === clientType && (!projectId || client.projectId === projectId)) {
        result.push(client);
      }
    }
    return result;
  }

  broadcast(clientType: ClientType, projectId: string, message: unknown): void {
    const payload = JSON.stringify(message);
    for (const client of this.getClientsByType(clientType, projectId)) {
      this.safeSend(client, payload);
    }
  }

  broadcastAll(projectId: string, message: unknown): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients.values()) {
      if (client.projectId === projectId) {
        this.safeSend(client, payload);
      }
    }
  }

  send(clientId: string, message: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.safeSend(client, JSON.stringify(message));
    }
  }

  /**
   * Send with slow client detection.
   * Tracks pending sends via ws.bufferedAmount and disconnects slow clients.
   */
  private safeSend(client: RegisteredClient, payload: string): void {
    if (client.ws.readyState !== 1) return; // Not OPEN

    // Estimate pending sends from bufferedAmount
    client.pendingSends = Math.ceil((client.ws.bufferedAmount ?? 0) / 1024);

    // Slow client detection: if send queue exceeds threshold, disconnect
    if (client.pendingSends > SLOW_CLIENT_THRESHOLD) {
      console.warn(`[Broadcaster] Slow client detected: ${client.clientId} (queue: ${client.pendingSends}). Disconnecting.`);
      try {
        client.ws.close(4008, 'Slow client: send queue exceeded threshold');
      } catch { /* already closing */ }
      this.clients.delete(client.clientId);
      return;
    }

    client.lastSendAt = Date.now();
    client.ws.send(payload);
  }

  cleanupDead(): number {
    let cleaned = 0;
    for (const [id, client] of this.clients) {
      if (client.ws.readyState !== 1) {
        this.clients.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }

  // --- Active Operator List ---

  /** Get all connected dashboard operators with their status */
  getActiveOperators(): OperatorInfo[] {
    const operators: OperatorInfo[] = [];
    for (const client of this.clients.values()) {
      if (client.clientType === 'dashboard') {
        operators.push({
          clientId: client.clientId,
          projectId: client.projectId,
          connectedAt: client.connectedAt,
          pendingSends: client.pendingSends,
        });
      }
    }
    return operators;
  }

  // --- Connected Client Counts ---

  /** Get detailed connection counts by type and project */
  getConnectionCounts(): ConnectionCounts {
    const byType: Record<string, number> = {};
    const byProject: Record<string, { interceptors: number; dashboards: number; simulators: number; total: number }> = {};

    for (const client of this.clients.values()) {
      // By type
      byType[client.clientType] = (byType[client.clientType] ?? 0) + 1;

      // By project
      if (!byProject[client.projectId]) {
        byProject[client.projectId] = { interceptors: 0, dashboards: 0, simulators: 0, total: 0 };
      }
      const proj = byProject[client.projectId];
      proj.total++;
      if (client.clientType === 'interceptor') proj.interceptors++;
      else if (client.clientType === 'dashboard') proj.dashboards++;
      else if (client.clientType === 'simulator') proj.simulators++;
    }

    return { total: this.clients.size, byType, byProject };
  }

  getStats(): { total: number; interceptors: number; dashboards: number; simulators: number } {
    let interceptors = 0, dashboards = 0, simulators = 0;
    for (const client of this.clients.values()) {
      if (client.clientType === 'interceptor') interceptors++;
      else if (client.clientType === 'dashboard') dashboards++;
      else if (client.clientType === 'simulator') simulators++;
    }
    return { total: this.clients.size, interceptors, dashboards, simulators };
  }
}
