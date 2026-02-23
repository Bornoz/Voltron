import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface StateHistoryEntry {
  id: string;
  projectId: string;
  fromState: string;
  toState: string;
  triggerEvent: string;
  triggeredBy: string;
  snapshotId: string | null;
  createdAt: number;
}

export class StateHistoryRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(entry: Omit<StateHistoryEntry, 'id' | 'createdAt'>): StateHistoryEntry {
    const full: StateHistoryEntry = {
      ...entry,
      id: uuid(),
      createdAt: Date.now(),
    };

    this.stmt('insert', `
      INSERT INTO execution_state_history (id, project_id, from_state, to_state, trigger_event, triggered_by, snapshot_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(full.id, full.projectId, full.fromState, full.toState, full.triggerEvent, full.triggeredBy, full.snapshotId, full.createdAt);

    return full;
  }

  findByProject(projectId: string, limit = 50): StateHistoryEntry[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM execution_state_history WHERE project_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(projectId, limit) as Record<string, unknown>[];

    return rows.map(r => ({
      id: r.id as string,
      projectId: r.project_id as string,
      fromState: r.from_state as string,
      toState: r.to_state as string,
      triggerEvent: r.trigger_event as string,
      triggeredBy: r.triggered_by as string,
      snapshotId: (r.snapshot_id as string) ?? null,
      createdAt: r.created_at as number,
    }));
  }
}
