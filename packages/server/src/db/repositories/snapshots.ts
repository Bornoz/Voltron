import type Database from 'better-sqlite3';
import type { Snapshot } from '@voltron/shared';
import { getDb } from '../connection.js';
import { notifySnapshotWritten } from '../connection.js';

export class SnapshotRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(snapshot: Snapshot): void {
    this.stmt('insert', `
      INSERT INTO snapshots (id, project_id, parent_id, git_commit_hash, label, file_count, total_size, is_critical, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.id, snapshot.projectId, snapshot.parentId,
      snapshot.gitCommitHash, snapshot.label ?? null,
      snapshot.fileCount, snapshot.totalSize,
      snapshot.isCritical ? 1 : 0, snapshot.createdAt,
    );

    // Notify backup system - triggers periodic backup every 100 snapshots
    notifySnapshotWritten();
  }

  findById(id: string): Snapshot | null {
    const row = this.stmt('findById', 'SELECT * FROM snapshots WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.toSnapshot(row) : null;
  }

  findByProject(projectId: string, limit = 50, offset = 0): Snapshot[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(projectId, limit, offset) as Record<string, unknown>[];
    return rows.map(r => this.toSnapshot(r));
  }

  markCritical(id: string): void {
    this.stmt('markCritical', 'UPDATE snapshots SET is_critical = 1 WHERE id = ?').run(id);
  }

  updateLabel(id: string, label: string): void {
    this.stmt('updateLabel', 'UPDATE snapshots SET label = ? WHERE id = ?').run(label, id);
  }

  getLatest(projectId: string): Snapshot | null {
    const row = this.stmt('getLatest', `
      SELECT * FROM snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.toSnapshot(row) : null;
  }

  count(projectId: string): number {
    const row = this.stmt('count', 'SELECT COUNT(*) as cnt FROM snapshots WHERE project_id = ?').get(projectId) as { cnt: number };
    return row.cnt;
  }

  prune(projectId: string, keepCount: number): number {
    const result = this.stmt('prune', `
      DELETE FROM snapshots WHERE project_id = ? AND is_critical = 0 AND id NOT IN (
        SELECT id FROM snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `).run(projectId, projectId, keepCount);
    return result.changes;
  }

  findBetween(projectId: string, fromId: string, toId: string): Snapshot[] {
    const from = this.findById(fromId);
    const to = this.findById(toId);
    if (!from || !to) return [];
    const rows = this.stmt('findBetween', `
      SELECT * FROM snapshots WHERE project_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at ASC
    `).all(projectId, Math.min(from.createdAt, to.createdAt), Math.max(from.createdAt, to.createdAt)) as Record<string, unknown>[];
    return rows.map(r => this.toSnapshot(r));
  }

  private toSnapshot(row: Record<string, unknown>): Snapshot {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      parentId: (row.parent_id as string) ?? null,
      gitCommitHash: row.git_commit_hash as string,
      label: (row.label as string) ?? undefined,
      fileCount: row.file_count as number,
      totalSize: row.total_size as number,
      isCritical: row.is_critical === 1,
      createdAt: row.created_at as number,
    };
  }
}
