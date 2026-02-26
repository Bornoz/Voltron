import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface ProjectMemoryRow {
  id: string;
  projectId: string;
  category: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export class ProjectMemoryRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  findByProject(projectId: string, limit = 100): ProjectMemoryRow[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM project_memory
      WHERE project_id = ?
      ORDER BY pinned DESC, updated_at DESC
      LIMIT ?
    `).all(projectId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  findPinned(projectId: string): ProjectMemoryRow[] {
    const rows = this.stmt('findPinned', `
      SELECT * FROM project_memory
      WHERE project_id = ? AND pinned = 1
      ORDER BY updated_at DESC
    `).all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  findById(id: string): ProjectMemoryRow | null {
    const row = this.stmt('findById', `
      SELECT * FROM project_memory WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  create(entry: { projectId: string; category: string; title: string; content: string }): ProjectMemoryRow {
    const id = randomUUID();
    const now = Date.now();
    this.stmt('insert', `
      INSERT INTO project_memory (id, project_id, category, title, content, pinned, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, entry.projectId, entry.category, entry.title, entry.content, now, now);
    return {
      id,
      projectId: entry.projectId,
      category: entry.category,
      title: entry.title,
      content: entry.content,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  update(id: string, data: Partial<{ title: string; content: string; category: string; pinned: boolean }>): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) { sets.push('title = ?'); values.push(data.title); }
    if (data.content !== undefined) { sets.push('content = ?'); values.push(data.content); }
    if (data.category !== undefined) { sets.push('category = ?'); values.push(data.category); }
    if (data.pinned !== undefined) { sets.push('pinned = ?'); values.push(data.pinned ? 1 : 0); }

    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    getDb().prepare(`UPDATE project_memory SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  delete(id: string): void {
    this.stmt('delete', `DELETE FROM project_memory WHERE id = ?`).run(id);
  }

  togglePin(id: string): boolean {
    const row = this.findById(id);
    if (!row) return false;
    const newPinned = !row.pinned;
    this.stmt('togglePin', `
      UPDATE project_memory SET pinned = ?, updated_at = ? WHERE id = ?
    `).run(newPinned ? 1 : 0, Date.now(), id);
    return newPinned;
  }

  private mapRow(r: Record<string, unknown>): ProjectMemoryRow {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      category: r.category as string,
      title: r.title as string,
      content: r.content as string,
      pinned: (r.pinned as number) === 1,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }
}
