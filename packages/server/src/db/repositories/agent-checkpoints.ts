import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface AgentCheckpointRow {
  id: string;
  sessionId: string;
  projectId: string;
  breadcrumbsJson: string;
  planJson: string | null;
  locationJson: string | null;
  tokenUsageJson: string | null;
  createdAt: number;
}

export class AgentCheckpointRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(checkpoint: Omit<AgentCheckpointRow, 'id'>): string {
    const id = randomUUID();
    this.stmt('insert', `
      INSERT INTO agent_checkpoints (id, session_id, project_id, breadcrumbs_json, plan_json, location_json, token_usage_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, checkpoint.sessionId, checkpoint.projectId,
      checkpoint.breadcrumbsJson, checkpoint.planJson,
      checkpoint.locationJson, checkpoint.tokenUsageJson,
      checkpoint.createdAt,
    );
    return id;
  }

  findLatestBySession(sessionId: string): AgentCheckpointRow | null {
    const row = this.stmt('findLatest', `
      SELECT * FROM agent_checkpoints WHERE session_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(sessionId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  private mapRow(r: Record<string, unknown>): AgentCheckpointRow {
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      projectId: r.project_id as string,
      breadcrumbsJson: r.breadcrumbs_json as string,
      planJson: r.plan_json as string | null,
      locationJson: r.location_json as string | null,
      tokenUsageJson: r.token_usage_json as string | null,
      createdAt: r.created_at as number,
    };
  }
}
