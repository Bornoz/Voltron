import { v4 as uuid } from 'uuid';
import { getDb } from '../connection.js';
import { hashString } from '@voltron/shared';

export interface PromptVersion {
  id: string;
  projectId: string;
  version: number;
  name: string;
  content: string;
  hash: string;
  parentId: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: number;
}

export class PromptVersionRepository {
  create(input: { projectId: string; name: string; content: string; createdBy?: string }): PromptVersion {
    const id = uuid();
    const now = Date.now();
    const hash = hashString(input.content);

    // Get next version number
    const latest = getDb().prepare(
      'SELECT MAX(version) as maxVer FROM prompt_versions WHERE project_id = ?'
    ).get(input.projectId) as { maxVer: number | null } | undefined;
    const version = (latest?.maxVer ?? 0) + 1;

    // Get current active as parent
    const active = this.getActive(input.projectId);
    const parentId = active?.id ?? null;

    // Deactivate previous active
    if (active) {
      getDb().prepare(
        'UPDATE prompt_versions SET is_active = 0 WHERE id = ?'
      ).run(active.id);
    }

    getDb().prepare(`
      INSERT INTO prompt_versions (id, project_id, version, name, content, hash, parent_id, is_active, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, input.projectId, version, input.name, input.content, hash, parentId, input.createdBy ?? 'operator', now);

    return {
      id, projectId: input.projectId, version, name: input.name,
      content: input.content, hash, parentId, isActive: true,
      createdBy: input.createdBy ?? 'operator', createdAt: now,
    };
  }

  getActive(projectId: string): PromptVersion | null {
    const row = getDb().prepare(
      'SELECT * FROM prompt_versions WHERE project_id = ? AND is_active = 1'
    ).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.toVersion(row) : null;
  }

  findByProject(projectId: string, limit = 50): PromptVersion[] {
    const rows = getDb().prepare(
      'SELECT * FROM prompt_versions WHERE project_id = ? ORDER BY version DESC LIMIT ?'
    ).all(projectId, limit) as Record<string, unknown>[];
    return rows.map(r => this.toVersion(r));
  }

  findById(id: string): PromptVersion | null {
    const row = getDb().prepare(
      'SELECT * FROM prompt_versions WHERE id = ?'
    ).get(id) as Record<string, unknown> | undefined;
    return row ? this.toVersion(row) : null;
  }

  activate(id: string): void {
    const version = this.findById(id);
    if (!version) return;

    const db = getDb();
    db.prepare('UPDATE prompt_versions SET is_active = 0 WHERE project_id = ?').run(version.projectId);
    db.prepare('UPDATE prompt_versions SET is_active = 1 WHERE id = ?').run(id);
  }

  getDiff(fromId: string, toId: string): { from: PromptVersion | null; to: PromptVersion | null } {
    return {
      from: this.findById(fromId),
      to: this.findById(toId),
    };
  }

  private toVersion(row: Record<string, unknown>): PromptVersion {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      version: row.version as number,
      name: row.name as string,
      content: row.content as string,
      hash: row.hash as string,
      parentId: row.parent_id as string | null,
      isActive: (row.is_active as number) === 1,
      createdBy: row.created_by as string,
      createdAt: row.created_at as number,
    };
  }
}
