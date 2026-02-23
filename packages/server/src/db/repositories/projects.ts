import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';
import type { CreateProjectInput, UpdateProjectInput, ProjectConfig } from '@voltron/shared';
import { getDb } from '../connection.js';

export class ProjectRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  create(input: CreateProjectInput): ProjectConfig {
    const now = Date.now();
    const project = {
      id: uuid(),
      name: input.name,
      rootPath: input.rootPath,
      isActive: true,
      watchIgnorePatterns: input.watchIgnorePatterns ?? [],
      maxFileSize: input.maxFileSize ?? 10_485_760,
      debounceMs: input.debounceMs ?? 500,
      autoStopOnCritical: input.autoStopOnCritical ?? true,
      snapshotRetention: input.snapshotRetention ?? 100,
      rateLimit: input.rateLimit ?? 50,
      createdAt: now,
      updatedAt: now,
    };

    this.stmt('insert', `
      INSERT INTO projects (id, name, root_path, is_active, watch_ignore_patterns, max_file_size, debounce_ms, auto_stop_on_critical, snapshot_retention, rate_limit, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project.id, project.name, project.rootPath, project.isActive ? 1 : 0,
      JSON.stringify(project.watchIgnorePatterns), project.maxFileSize, project.debounceMs,
      project.autoStopOnCritical ? 1 : 0, project.snapshotRetention, project.rateLimit,
      project.createdAt, project.updatedAt,
    );

    // Initialize sequence counter
    getDb().prepare('INSERT INTO sequence_counter (project_id, last_value) VALUES (?, 0)').run(project.id);

    return project;
  }

  findById(id: string): ProjectConfig | null {
    const row = this.stmt('findById', 'SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.toProject(row) : null;
  }

  findAll(): ProjectConfig[] {
    const rows = this.stmt('findAll', 'SELECT * FROM projects ORDER BY created_at DESC').all() as Record<string, unknown>[];
    return rows.map(r => this.toProject(r));
  }

  update(id: string, input: UpdateProjectInput): ProjectConfig | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
      updatedAt: Date.now(),
    };

    this.stmt('update', `
      UPDATE projects SET name=?, root_path=?, is_active=?, watch_ignore_patterns=?, max_file_size=?,
        debounce_ms=?, auto_stop_on_critical=?, snapshot_retention=?, rate_limit=?, updated_at=?
      WHERE id=?
    `).run(
      updated.name, updated.rootPath, updated.isActive ? 1 : 0,
      JSON.stringify(updated.watchIgnorePatterns), updated.maxFileSize, updated.debounceMs,
      updated.autoStopOnCritical ? 1 : 0, updated.snapshotRetention, updated.rateLimit,
      updated.updatedAt, id,
    );

    return updated;
  }

  deactivate(id: string): boolean {
    const result = this.stmt('deactivate', 'UPDATE projects SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(Date.now(), id);
    return result.changes > 0;
  }

  getStats(id: string): {
    eventCount: number;
    snapshotCount: number;
    latestEvent: number | null;
    byRisk: Record<string, number>;
    byAction: Record<string, number>;
    activeProtectionZones: number;
    eventRate: number;
    uniqueFiles: number;
    last24hEvents: number;
  } {
    const db = getDb();

    const basic = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM action_log WHERE project_id = ?) as event_count,
        (SELECT COUNT(*) FROM snapshots WHERE project_id = ?) as snapshot_count,
        (SELECT MAX(created_at) FROM action_log WHERE project_id = ?) as latest_event,
        (SELECT COUNT(*) FROM protection_zones WHERE project_id = ?) as active_zones,
        (SELECT COUNT(DISTINCT file_path) FROM action_log WHERE project_id = ?) as unique_files
    `).get(id, id, id, id, id) as Record<string, unknown>;

    const riskRows = db.prepare(`
      SELECT risk_level, COUNT(*) as count FROM action_log WHERE project_id = ? GROUP BY risk_level
    `).all(id) as { risk_level: string; count: number }[];

    const actionRows = db.prepare(`
      SELECT action, COUNT(*) as count FROM action_log WHERE project_id = ? GROUP BY action
    `).all(id) as { action: string; count: number }[];

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const oneDayAgo = now - 86_400_000;

    const recentCount = db.prepare(`
      SELECT COUNT(*) as count FROM action_log WHERE project_id = ? AND created_at > ?
    `).get(id, oneMinuteAgo) as { count: number };

    const last24h = db.prepare(`
      SELECT COUNT(*) as count FROM action_log WHERE project_id = ? AND created_at > ?
    `).get(id, oneDayAgo) as { count: number };

    const byRisk: Record<string, number> = {};
    for (const row of riskRows) byRisk[row.risk_level] = row.count;

    const byAction: Record<string, number> = {};
    for (const row of actionRows) byAction[row.action] = row.count;

    return {
      eventCount: basic.event_count as number,
      snapshotCount: basic.snapshot_count as number,
      latestEvent: (basic.latest_event as number) ?? null,
      byRisk,
      byAction,
      activeProtectionZones: basic.active_zones as number,
      eventRate: recentCount.count, // events per last minute
      uniqueFiles: basic.unique_files as number,
      last24hEvents: last24h.count,
    };
  }

  nextSequence(projectId: string): number {
    const result = getDb().prepare(
      'UPDATE sequence_counter SET last_value = last_value + 1 WHERE project_id = ? RETURNING last_value'
    ).get(projectId) as { last_value: number } | undefined;
    return result?.last_value ?? 1;
  }

  private toProject(row: Record<string, unknown>): ProjectConfig {
    return {
      id: row.id as string,
      name: row.name as string,
      rootPath: row.root_path as string,
      isActive: row.is_active === 1,
      watchIgnorePatterns: JSON.parse(row.watch_ignore_patterns as string),
      maxFileSize: row.max_file_size as number,
      debounceMs: row.debounce_ms as number,
      autoStopOnCritical: row.auto_stop_on_critical === 1,
      snapshotRetention: row.snapshot_retention as number,
      rateLimit: row.rate_limit as number,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }
}
