import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';
import type { ProtectionZoneConfig, ProtectionLevel, OperationType } from '@voltron/shared';
import { getDb } from '../connection.js';

export interface CreateZoneInput {
  projectId: string;
  path: string;
  level: ProtectionLevel;
  reason?: string;
  allowedOperations?: OperationType[];
  isSystem?: boolean;
  createdBy?: string;
}

export class ProtectionZoneRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  create(input: CreateZoneInput): ProtectionZoneConfig {
    const now = Date.now();
    const zone: ProtectionZoneConfig = {
      id: uuid(),
      projectId: input.projectId,
      path: input.path,
      level: input.level,
      reason: input.reason,
      allowedOperations: input.allowedOperations,
      isSystem: input.isSystem ?? false,
      createdBy: input.createdBy ?? 'operator',
      createdAt: now,
      updatedAt: now,
    };

    this.stmt('insert', `
      INSERT INTO protection_zones (id, project_id, path_pattern, level, reason, allowed_operations, is_system, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      zone.id, zone.projectId, zone.path, zone.level,
      zone.reason ?? null, zone.allowedOperations ? JSON.stringify(zone.allowedOperations) : null,
      zone.isSystem ? 1 : 0, zone.createdBy, zone.createdAt, zone.updatedAt,
    );

    return zone;
  }

  findByProject(projectId: string): ProtectionZoneConfig[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM protection_zones WHERE project_id = ? ORDER BY created_at
    `).all(projectId) as Record<string, unknown>[];
    return rows.map(r => this.toZone(r));
  }

  findById(id: string): ProtectionZoneConfig | null {
    const row = this.stmt('findById', 'SELECT * FROM protection_zones WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.toZone(row) : null;
  }

  update(id: string, updates: Partial<Pick<ProtectionZoneConfig, 'path' | 'level' | 'reason' | 'allowedOperations'>>): ProtectionZoneConfig | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    this.stmt('update', `
      UPDATE protection_zones SET path_pattern=?, level=?, reason=?, allowed_operations=?, updated_at=? WHERE id=?
    `).run(
      updated.path, updated.level, updated.reason ?? null,
      updated.allowedOperations ? JSON.stringify(updated.allowedOperations) : null,
      updated.updatedAt, id,
    );
    return updated;
  }

  delete(id: string): boolean {
    const result = this.stmt('delete', 'DELETE FROM protection_zones WHERE id = ? AND is_system = 0').run(id);
    return result.changes > 0;
  }

  private toZone(row: Record<string, unknown>): ProtectionZoneConfig {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      path: row.path_pattern as string,
      level: row.level as ProtectionLevel,
      reason: (row.reason as string) ?? undefined,
      allowedOperations: row.allowed_operations ? JSON.parse(row.allowed_operations as string) : undefined,
      isSystem: row.is_system === 1,
      createdBy: row.created_by as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  }
}
