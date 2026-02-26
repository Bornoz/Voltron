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
  lineStart: number | null;
  lineEnd: number | null;
  contentSnippet: string | null;
  editDiff: string | null;
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
      INSERT INTO agent_breadcrumbs (id, session_id, project_id, file_path, activity, tool_name, duration_ms, line_start, line_end, content_snippet, edit_diff, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, crumb.sessionId, crumb.projectId, crumb.filePath, crumb.activity,
      crumb.toolName, crumb.durationMs, crumb.lineStart, crumb.lineEnd,
      crumb.contentSnippet, crumb.editDiff, crumb.timestamp,
    );
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

  /** Aggregate visit counts per file for a session */
  getVisitCounts(sessionId: string): Map<string, number> {
    const rows = this.stmt('visitCounts', `
      SELECT file_path, COUNT(*) as visits FROM agent_breadcrumbs
      WHERE session_id = ? GROUP BY file_path
    `).all(sessionId) as Array<{ file_path: string; visits: number }>;
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.file_path, r.visits);
    return map;
  }

  /** Get last activity per file for a session */
  getLastActivities(sessionId: string): Map<string, string> {
    const rows = this.stmt('lastActivities', `
      SELECT file_path, activity FROM agent_breadcrumbs
      WHERE session_id = ? AND timestamp = (
        SELECT MAX(timestamp) FROM agent_breadcrumbs b2
        WHERE b2.session_id = agent_breadcrumbs.session_id AND b2.file_path = agent_breadcrumbs.file_path
      )
      GROUP BY file_path
    `).all(sessionId) as Array<{ file_path: string; activity: string }>;
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.file_path, r.activity);
    return map;
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
      lineStart: r.line_start as number | null,
      lineEnd: r.line_end as number | null,
      contentSnippet: r.content_snippet as string | null,
      editDiff: r.edit_diff as string | null,
      timestamp: r.timestamp as number,
    };
  }
}
