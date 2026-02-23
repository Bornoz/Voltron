import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface AgentBreadcrumbRow {
  id: string;
  sessionId: string;
  projectId: string;
  filePath: string;
  activity: string;
  toolName: string | null;
  durationMs: number | null;
  timestamp: number;
}

export class AgentBreadcrumbRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(crumb: Omit<AgentBreadcrumbRow, 'id'>): void {
    const id = randomUUID();
    this.stmt('insert', `
      INSERT INTO agent_breadcrumbs (id, session_id, project_id, file_path, activity, tool_name, duration_ms, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, crumb.sessionId, crumb.projectId, crumb.filePath, crumb.activity, crumb.toolName, crumb.durationMs, crumb.timestamp);
  }

  findBySession(sessionId: string, limit = 500): AgentBreadcrumbRow[] {
    const rows = this.stmt('findBySession', `
      SELECT * FROM agent_breadcrumbs WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?
    `).all(sessionId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  findByProject(projectId: string, limit = 100): AgentBreadcrumbRow[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM agent_breadcrumbs WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?
    `).all(projectId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: Record<string, unknown>): AgentBreadcrumbRow {
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      projectId: r.project_id as string,
      filePath: r.file_path as string,
      activity: r.activity as string,
      toolName: r.tool_name as string | null,
      durationMs: r.duration_ms as number | null,
      timestamp: r.timestamp as number,
    };
  }
}
