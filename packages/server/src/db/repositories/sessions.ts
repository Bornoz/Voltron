import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface OperatorSession {
  id: string;
  clientType: string;
  projectId: string;
  connectedAt: number;
  disconnectedAt: number | null;
  commandsSent: number;
  lastActiveAt: number;
}

export class SessionRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  create(session: Omit<OperatorSession, 'disconnectedAt' | 'commandsSent' | 'lastActiveAt'>): void {
    const now = Date.now();
    this.stmt('upsert', `
      INSERT INTO operator_sessions (id, client_type, project_id, connected_at, disconnected_at, commands_sent, last_active_at)
      VALUES (?, ?, ?, ?, NULL, 0, ?)
      ON CONFLICT(id) DO UPDATE SET
        client_type = excluded.client_type,
        project_id = excluded.project_id,
        connected_at = excluded.connected_at,
        disconnected_at = NULL,
        last_active_at = excluded.last_active_at
    `).run(session.id, session.clientType, session.projectId, session.connectedAt, now);
  }

  disconnect(id: string): void {
    this.stmt('disconnect', `
      UPDATE operator_sessions SET disconnected_at = ? WHERE id = ?
    `).run(Date.now(), id);
  }

  incrementCommands(id: string): void {
    this.stmt('incrementCommands', `
      UPDATE operator_sessions SET commands_sent = commands_sent + 1, last_active_at = ? WHERE id = ?
    `).run(Date.now(), id);
  }

  getActive(): OperatorSession[] {
    const rows = this.stmt('getActive', `
      SELECT * FROM operator_sessions WHERE disconnected_at IS NULL ORDER BY connected_at DESC
    `).all() as Record<string, unknown>[];

    return rows.map(r => ({
      id: r.id as string,
      clientType: r.client_type as string,
      projectId: r.project_id as string,
      connectedAt: r.connected_at as number,
      disconnectedAt: null,
      commandsSent: r.commands_sent as number,
      lastActiveAt: r.last_active_at as number,
    }));
  }
}
