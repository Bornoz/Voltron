import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';

export interface SimulatorConstraintRow {
  id: string;
  sessionId: string;
  projectId: string;
  constraintType: string;
  selector: string | null;
  property: string | null;
  value: string | null;
  imageUrl: string | null;
  description: string;
  appliedAt: number;
}

export class SimulatorConstraintRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(constraint: Omit<SimulatorConstraintRow, 'id'>): SimulatorConstraintRow {
    const id = randomUUID();
    this.stmt('insert', `
      INSERT INTO simulator_constraints (id, session_id, project_id, constraint_type, selector, property, value, image_url, description, applied_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, constraint.sessionId, constraint.projectId, constraint.constraintType, constraint.selector, constraint.property, constraint.value, constraint.imageUrl, constraint.description, constraint.appliedAt);
    return { ...constraint, id };
  }

  findBySession(sessionId: string): SimulatorConstraintRow[] {
    const rows = this.stmt('findBySession', `
      SELECT * FROM simulator_constraints WHERE session_id = ? ORDER BY applied_at DESC
    `).all(sessionId) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  findPendingByProject(projectId: string): SimulatorConstraintRow[] {
    const rows = this.stmt('findPending', `
      SELECT sc.* FROM simulator_constraints sc
      INNER JOIN agent_sessions ags ON sc.session_id = ags.session_id
      WHERE sc.project_id = ? AND ags.status IN ('RUNNING', 'PAUSED')
      ORDER BY sc.applied_at DESC
    `).all(projectId) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: Record<string, unknown>): SimulatorConstraintRow {
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      projectId: r.project_id as string,
      constraintType: r.constraint_type as string,
      selector: r.selector as string | null,
      property: r.property as string | null,
      value: r.value as string | null,
      imageUrl: r.image_url as string | null,
      description: r.description as string,
      appliedAt: r.applied_at as number,
    };
  }
}
