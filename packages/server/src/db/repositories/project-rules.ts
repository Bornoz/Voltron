import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface ProjectRulesRow {
  id: string;
  projectId: string;
  content: string;
  isActive: boolean;
  updatedAt: number;
  createdAt: number;
}

export class ProjectRulesRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  getByProject(projectId: string): ProjectRulesRow | null {
    const row = this.stmt('getByProject', `
      SELECT * FROM project_rules WHERE project_id = ?
    `).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  upsert(projectId: string, content: string): ProjectRulesRow {
    const now = Date.now();
    const existing = this.getByProject(projectId);
    if (existing) {
      this.stmt('update', `
        UPDATE project_rules SET content = ?, updated_at = ? WHERE project_id = ?
      `).run(content, now, projectId);
      return { ...existing, content, updatedAt: now };
    }
    const id = randomUUID();
    this.stmt('insert', `
      INSERT INTO project_rules (id, project_id, content, is_active, updated_at, created_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(id, projectId, content, now, now);
    return { id, projectId, content, isActive: true, updatedAt: now, createdAt: now };
  }

  setActive(projectId: string, active: boolean): void {
    this.stmt('setActive', `
      UPDATE project_rules SET is_active = ?, updated_at = ? WHERE project_id = ?
    `).run(active ? 1 : 0, Date.now(), projectId);
  }

  private mapRow(r: Record<string, unknown>): ProjectRulesRow {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      content: r.content as string,
      isActive: (r.is_active as number) === 1,
      updatedAt: r.updated_at as number,
      createdAt: r.created_at as number,
    };
  }
}
