import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { SmartSetupRun, SmartSetupPhase, ProjectProfile, DiscoveredRepo } from '@voltron/shared';
import { getDb } from '../connection.js';

export class SmartSetupRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  create(projectId: string): SmartSetupRun {
    const id = randomUUID();
    const now = Date.now();
    this.stmt('insert', `
      INSERT INTO smart_setup_runs (id, project_id, status, profile_json, discoveries_json, applied_count, created_at, updated_at)
      VALUES (?, ?, 'analyzing', NULL, '[]', 0, ?, ?)
    `).run(id, projectId, now, now);
    return {
      id,
      projectId,
      status: 'analyzing',
      profile: null,
      discoveries: [],
      appliedCount: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  findById(id: string): SmartSetupRun | null {
    const row = this.stmt('findById', `
      SELECT * FROM smart_setup_runs WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByProject(projectId: string, limit = 20): SmartSetupRun[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM smart_setup_runs
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(projectId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  update(id: string, fields: Partial<{
    status: SmartSetupPhase;
    profile: ProjectProfile | null;
    discoveries: DiscoveredRepo[];
    appliedCount: number;
    error: string | null;
  }>): void {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (fields.status !== undefined) { sets.push('status = ?'); values.push(fields.status); }
    if (fields.profile !== undefined) { sets.push('profile_json = ?'); values.push(fields.profile ? JSON.stringify(fields.profile) : null); }
    if (fields.discoveries !== undefined) { sets.push('discoveries_json = ?'); values.push(JSON.stringify(fields.discoveries)); }
    if (fields.appliedCount !== undefined) { sets.push('applied_count = ?'); values.push(fields.appliedCount); }
    if (fields.error !== undefined) { sets.push('error = ?'); values.push(fields.error); }

    if (sets.length === 0) return;

    sets.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    getDb().prepare(`UPDATE smart_setup_runs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  }

  private mapRow(r: Record<string, unknown>): SmartSetupRun {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      status: r.status as SmartSetupPhase,
      profile: r.profile_json ? JSON.parse(r.profile_json as string) : null,
      discoveries: r.discoveries_json ? JSON.parse(r.discoveries_json as string) : [],
      appliedCount: r.applied_count as number,
      error: (r.error as string) ?? null,
      createdAt: r.created_at as number,
      updatedAt: r.updated_at as number,
    };
  }
}
