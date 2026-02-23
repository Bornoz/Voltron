import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface PersistedExecutionState {
  projectId: string;
  stateJson: string;
  lastSnapshotId: string | null;
  lastEventId: string | null;
  stoppedAt: number | null;
  errorMessage: string | null;
  updatedAt: number;
}

export class ExecutionStateRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  upsert(state: PersistedExecutionState): void {
    this.stmt('upsert', `
      INSERT INTO execution_state (project_id, state_json, last_snapshot_id, last_event_id, stopped_at, error_message, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        state_json = excluded.state_json,
        last_snapshot_id = excluded.last_snapshot_id,
        last_event_id = excluded.last_event_id,
        stopped_at = excluded.stopped_at,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at
    `).run(
      state.projectId, state.stateJson, state.lastSnapshotId,
      state.lastEventId, state.stoppedAt, state.errorMessage, state.updatedAt,
    );
  }

  findByProject(projectId: string): PersistedExecutionState | null {
    const row = this.stmt('find', 'SELECT * FROM execution_state WHERE project_id = ?').get(projectId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      projectId: row.project_id as string,
      stateJson: row.state_json as string,
      lastSnapshotId: (row.last_snapshot_id as string) ?? null,
      lastEventId: (row.last_event_id as string) ?? null,
      stoppedAt: (row.stopped_at as number) ?? null,
      errorMessage: (row.error_message as string) ?? null,
      updatedAt: row.updated_at as number,
    };
  }
}
