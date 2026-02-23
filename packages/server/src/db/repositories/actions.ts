import type Database from 'better-sqlite3';
import type { AiActionEvent } from '@voltron/shared';
import { getDb } from '../connection.js';

/** Write latency tracking for monitoring */
export interface WriteLatencyStats {
  lastWriteMs: number;
  avgWriteMs: number;
  maxWriteMs: number;
  totalWrites: number;
  lastBatchWriteMs: number;
  avgBatchWriteMs: number;
  totalBatchWrites: number;
}

export class ActionRepository {
  private stmtCache = new Map<string, Database.Statement>();

  // Write latency monitoring state
  private _latency = {
    lastWriteMs: 0,
    sumWriteMs: 0,
    maxWriteMs: 0,
    totalWrites: 0,
    lastBatchWriteMs: 0,
    sumBatchWriteMs: 0,
    totalBatchWrites: 0,
  };

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(event: AiActionEvent): void {
    const start = performance.now();
    this.stmt('insert', `
      INSERT INTO action_log (id, sequence_number, project_id, snapshot_id, action, file_path, risk_level,
        file_hash, previous_hash, diff, diff_truncated, protection_zone, risk_reasons, parent_event_hash,
        is_binary, file_size, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id, event.sequenceNumber, event.projectId, event.snapshotId,
      event.action, event.file, event.risk, event.hash,
      event.previousHash ?? null, event.diff ?? null,
      event.diffTruncated ? 1 : 0, event.protectionZone ?? null,
      event.riskReasons ? JSON.stringify(event.riskReasons) : null,
      event.parentEventHash ?? null, event.isBinary ? 1 : 0,
      event.fileSize ?? null, event.metadata ? JSON.stringify(event.metadata) : null,
      event.timestamp,
    );
    const elapsed = performance.now() - start;
    this.recordWriteLatency(elapsed);
  }

  /**
   * Batch insert multiple events within a single BEGIN/COMMIT transaction.
   * Dramatically improves SQLite write throughput for burst scenarios.
   *
   * better-sqlite3's .transaction() auto-wraps in BEGIN/COMMIT and rolls back on error.
   */
  insertBatch(events: AiActionEvent[]): { inserted: number; durationMs: number } {
    if (events.length === 0) return { inserted: 0, durationMs: 0 };

    const insertStmt = this.stmt('insert', `
      INSERT INTO action_log (id, sequence_number, project_id, snapshot_id, action, file_path, risk_level,
        file_hash, previous_hash, diff, diff_truncated, protection_zone, risk_reasons, parent_event_hash,
        is_binary, file_size, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const start = performance.now();

    const batchInsert = getDb().transaction((evts: AiActionEvent[]) => {
      for (const event of evts) {
        insertStmt.run(
          event.id, event.sequenceNumber, event.projectId, event.snapshotId,
          event.action, event.file, event.risk, event.hash,
          event.previousHash ?? null, event.diff ?? null,
          event.diffTruncated ? 1 : 0, event.protectionZone ?? null,
          event.riskReasons ? JSON.stringify(event.riskReasons) : null,
          event.parentEventHash ?? null, event.isBinary ? 1 : 0,
          event.fileSize ?? null, event.metadata ? JSON.stringify(event.metadata) : null,
          event.timestamp,
        );
      }
      return evts.length;
    });

    const inserted = batchInsert(events);
    const elapsed = performance.now() - start;

    // Track batch latency
    this._latency.lastBatchWriteMs = elapsed;
    this._latency.sumBatchWriteMs += elapsed;
    this._latency.totalBatchWrites++;

    return { inserted, durationMs: Math.round(elapsed * 100) / 100 };
  }

  /** Get write latency statistics for monitoring */
  getWriteLatencyStats(): WriteLatencyStats {
    return {
      lastWriteMs: Math.round(this._latency.lastWriteMs * 100) / 100,
      avgWriteMs: this._latency.totalWrites > 0
        ? Math.round((this._latency.sumWriteMs / this._latency.totalWrites) * 100) / 100
        : 0,
      maxWriteMs: Math.round(this._latency.maxWriteMs * 100) / 100,
      totalWrites: this._latency.totalWrites,
      lastBatchWriteMs: Math.round(this._latency.lastBatchWriteMs * 100) / 100,
      avgBatchWriteMs: this._latency.totalBatchWrites > 0
        ? Math.round((this._latency.sumBatchWriteMs / this._latency.totalBatchWrites) * 100) / 100
        : 0,
      totalBatchWrites: this._latency.totalBatchWrites,
    };
  }

  private recordWriteLatency(ms: number): void {
    this._latency.lastWriteMs = ms;
    this._latency.sumWriteMs += ms;
    this._latency.totalWrites++;
    if (ms > this._latency.maxWriteMs) {
      this._latency.maxWriteMs = ms;
    }
    // Warn on slow individual writes (>50ms is concerning for SQLite)
    if (ms > 50) {
      console.warn(`[ActionRepo] Slow write detected: ${ms.toFixed(2)}ms`);
    }
  }

  findByProject(projectId: string, limit = 100, offset = 0): AiActionEvent[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM action_log WHERE project_id = ? ORDER BY sequence_number DESC LIMIT ? OFFSET ?
    `).all(projectId, limit, offset) as Record<string, unknown>[];
    return rows.map(r => this.toEvent(r));
  }

  findById(id: string): AiActionEvent | null {
    const row = this.stmt('findById', 'SELECT * FROM action_log WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.toEvent(row) : null;
  }

  findByFile(projectId: string, filePath: string, limit = 50): AiActionEvent[] {
    const rows = this.stmt('findByFile', `
      SELECT * FROM action_log WHERE project_id = ? AND file_path = ? ORDER BY sequence_number DESC LIMIT ?
    `).all(projectId, filePath, limit) as Record<string, unknown>[];
    return rows.map(r => this.toEvent(r));
  }

  findByRisk(projectId: string, riskLevel: string, limit = 100): AiActionEvent[] {
    const rows = this.stmt('findByRisk', `
      SELECT * FROM action_log WHERE project_id = ? AND risk_level = ? ORDER BY sequence_number DESC LIMIT ?
    `).all(projectId, riskLevel, limit) as Record<string, unknown>[];
    return rows.map(r => this.toEvent(r));
  }

  getLatestForProject(projectId: string): AiActionEvent | null {
    const row = this.stmt('getLatestForProject',
      'SELECT * FROM action_log WHERE project_id = ? ORDER BY sequence_number DESC LIMIT 1'
    ).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.toEvent(row) : null;
  }

  getAfterSequence(projectId: string, sequenceNumber: number, limit = 1000): AiActionEvent[] {
    const rows = this.stmt('getAfterSequence', `
      SELECT * FROM action_log WHERE project_id = ? AND sequence_number > ? ORDER BY sequence_number ASC LIMIT ?
    `).all(projectId, sequenceNumber, limit) as Record<string, unknown>[];
    return rows.map(r => this.toEvent(r));
  }

  getStats(projectId: string): Record<string, number> {
    const rows = getDb().prepare(`
      SELECT risk_level, COUNT(*) as count FROM action_log WHERE project_id = ? GROUP BY risk_level
    `).all(projectId) as { risk_level: string; count: number }[];

    const stats: Record<string, number> = { total: 0 };
    for (const row of rows) {
      stats[row.risk_level] = row.count;
      stats.total += row.count;
    }
    return stats;
  }

  getTimeline(projectId: string, granularity: 'hourly' | 'daily' = 'hourly', hours = 24): {
    buckets: { timestamp: number; count: number; byRisk: Record<string, number> }[];
    granularity: string;
    from: number;
    to: number;
  } {
    const db = getDb();
    const now = Date.now();
    const from = now - hours * 3_600_000;

    // Bucket size in ms
    const bucketMs = granularity === 'hourly' ? 3_600_000 : 86_400_000;

    // Get all actions in range
    const rows = db.prepare(`
      SELECT created_at, risk_level FROM action_log
      WHERE project_id = ? AND created_at >= ?
      ORDER BY created_at ASC
    `).all(projectId, from) as { created_at: number; risk_level: string }[];

    // Build bucket map
    const bucketMap = new Map<number, { count: number; byRisk: Record<string, number> }>();

    // Pre-fill empty buckets
    const startBucket = Math.floor(from / bucketMs) * bucketMs;
    for (let t = startBucket; t <= now; t += bucketMs) {
      bucketMap.set(t, { count: 0, byRisk: {} });
    }

    for (const row of rows) {
      const bucketKey = Math.floor(row.created_at / bucketMs) * bucketMs;
      let bucket = bucketMap.get(bucketKey);
      if (!bucket) {
        bucket = { count: 0, byRisk: {} };
        bucketMap.set(bucketKey, bucket);
      }
      bucket.count++;
      bucket.byRisk[row.risk_level] = (bucket.byRisk[row.risk_level] ?? 0) + 1;
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, data]) => ({ timestamp, ...data }));

    return { buckets, granularity, from, to: now };
  }

  getDetailedStats(projectId: string): {
    byRisk: Record<string, number>;
    byAction: Record<string, number>;
    recentRate: number;
    totalActions: number;
    uniqueFiles: number;
    last24h: number;
  } {
    const db = getDb();

    const riskRows = db.prepare(`
      SELECT risk_level, COUNT(*) as count FROM action_log WHERE project_id = ? GROUP BY risk_level
    `).all(projectId) as { risk_level: string; count: number }[];

    const actionRows = db.prepare(`
      SELECT action, COUNT(*) as count FROM action_log WHERE project_id = ? GROUP BY action
    `).all(projectId) as { action: string; count: number }[];

    const uniqueFiles = db.prepare(`
      SELECT COUNT(DISTINCT file_path) as count FROM action_log WHERE project_id = ?
    `).get(projectId) as { count: number };

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const oneDayAgo = now - 86_400_000;

    const recentCount = db.prepare(`
      SELECT COUNT(*) as count FROM action_log WHERE project_id = ? AND created_at > ?
    `).get(projectId, oneMinuteAgo) as { count: number };

    const last24h = db.prepare(`
      SELECT COUNT(*) as count FROM action_log WHERE project_id = ? AND created_at > ?
    `).get(projectId, oneDayAgo) as { count: number };

    const byRisk: Record<string, number> = {};
    let total = 0;
    for (const row of riskRows) {
      byRisk[row.risk_level] = row.count;
      total += row.count;
    }

    const byAction: Record<string, number> = {};
    for (const row of actionRows) {
      byAction[row.action] = row.count;
    }

    return {
      byRisk,
      byAction,
      recentRate: recentCount.count,
      totalActions: total,
      uniqueFiles: uniqueFiles.count,
      last24h: last24h.count,
    };
  }

  getRecentActions(projectId: string, windowMs: number): AiActionEvent[] {
    const since = Date.now() - windowMs;
    const rows = getDb().prepare(`
      SELECT * FROM action_log WHERE project_id = ? AND created_at > ? ORDER BY created_at DESC
    `).all(projectId, since) as Record<string, unknown>[];
    return rows.map(r => this.toEvent(r));
  }

  private toEvent(row: Record<string, unknown>): AiActionEvent {
    return {
      id: row.id as string,
      sequenceNumber: row.sequence_number as number,
      projectId: row.project_id as string,
      snapshotId: row.snapshot_id as string,
      action: row.action as AiActionEvent['action'],
      file: row.file_path as string,
      risk: row.risk_level as AiActionEvent['risk'],
      hash: row.file_hash as string,
      timestamp: row.created_at as number,
      previousHash: (row.previous_hash as string) ?? undefined,
      diff: (row.diff as string) ?? undefined,
      diffTruncated: row.diff_truncated === 1 ? true : undefined,
      protectionZone: (row.protection_zone as AiActionEvent['protectionZone']) ?? undefined,
      riskReasons: row.risk_reasons ? JSON.parse(row.risk_reasons as string) : undefined,
      parentEventHash: (row.parent_event_hash as string) ?? undefined,
      isBinary: row.is_binary === 1 ? true : undefined,
      fileSize: (row.file_size as number) ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    };
  }
}
