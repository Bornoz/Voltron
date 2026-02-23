import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getDb } from '../connection.js';
import type { AgentPlanStep } from '@voltron/shared';

export interface AgentPlanRow {
  id: string;
  sessionId: string;
  projectId: string;
  summary: string;
  stepsJson: string;
  currentStep: number;
  totalSteps: number;
  confidence: number;
  extractedAt: number;
  supersededAt: number | null;
}

export class AgentPlanRepository {
  private stmtCache = new Map<string, Database.Statement>();

  private stmt(key: string, sql: string): Database.Statement {
    let s = this.stmtCache.get(key);
    if (!s) {
      s = getDb().prepare(sql);
      this.stmtCache.set(key, s);
    }
    return s;
  }

  insert(plan: Omit<AgentPlanRow, 'id' | 'supersededAt'>): AgentPlanRow {
    const id = randomUUID();
    // Supersede any existing active plan for this session
    this.stmt('supersede', `
      UPDATE agent_plans SET superseded_at = ? WHERE session_id = ? AND superseded_at IS NULL
    `).run(Date.now(), plan.sessionId);

    this.stmt('insert', `
      INSERT INTO agent_plans (id, session_id, project_id, summary, steps_json, current_step, total_steps, confidence, extracted_at, superseded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(id, plan.sessionId, plan.projectId, plan.summary, plan.stepsJson, plan.currentStep, plan.totalSteps, plan.confidence, plan.extractedAt);
    return { ...plan, id, supersededAt: null };
  }

  updateProgress(id: string, currentStep: number, stepsJson: string): void {
    this.stmt('updateProgress', `UPDATE agent_plans SET current_step = ?, steps_json = ? WHERE id = ?`).run(currentStep, stepsJson, id);
  }

  findActiveBySession(sessionId: string): AgentPlanRow | null {
    const row = this.stmt('findActive', `
      SELECT * FROM agent_plans WHERE session_id = ? AND superseded_at IS NULL ORDER BY extracted_at DESC LIMIT 1
    `).get(sessionId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByProject(projectId: string, limit = 20): AgentPlanRow[] {
    const rows = this.stmt('findByProject', `
      SELECT * FROM agent_plans WHERE project_id = ? ORDER BY extracted_at DESC LIMIT ?
    `).all(projectId, limit) as Record<string, unknown>[];
    return rows.map((r) => this.mapRow(r));
  }

  getSteps(planId: string): AgentPlanStep[] {
    const row = this.findById(planId);
    if (!row) return [];
    return JSON.parse(row.stepsJson) as AgentPlanStep[];
  }

  private findById(id: string): AgentPlanRow | null {
    const row = this.stmt('findById', `SELECT * FROM agent_plans WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  private mapRow(r: Record<string, unknown>): AgentPlanRow {
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      projectId: r.project_id as string,
      summary: r.summary as string,
      stepsJson: r.steps_json as string,
      currentStep: r.current_step as number,
      totalSteps: r.total_steps as number,
      confidence: r.confidence as number,
      extractedAt: r.extracted_at as number,
      supersededAt: r.superseded_at as number | null,
    };
  }
}
