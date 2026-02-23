import { v4 as uuid } from 'uuid';
import { getDb } from '../connection.js';

export interface BehaviorScore {
  id: string;
  projectId: string;
  windowStart: number;
  windowEnd: number;
  totalActions: number;
  riskScore: number;
  velocityScore: number;
  complianceScore: number;
  overallScore: number;
  details: Record<string, unknown> | null;
  createdAt: number;
}

export class BehaviorScoreRepository {
  insert(score: Omit<BehaviorScore, 'id' | 'createdAt'>): BehaviorScore {
    const id = uuid();
    const now = Date.now();
    getDb().prepare(`
      INSERT INTO ai_behavior_scores (id, project_id, window_start, window_end, total_actions, risk_score, velocity_score, compliance_score, overall_score, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, score.projectId, score.windowStart, score.windowEnd,
      score.totalActions, score.riskScore, score.velocityScore,
      score.complianceScore, score.overallScore,
      score.details ? JSON.stringify(score.details) : null, now,
    );
    return { ...score, id, createdAt: now };
  }

  findByProject(projectId: string, limit = 50): BehaviorScore[] {
    const rows = getDb().prepare(`
      SELECT * FROM ai_behavior_scores WHERE project_id = ? ORDER BY window_start DESC LIMIT ?
    `).all(projectId, limit) as Record<string, unknown>[];
    return rows.map(r => this.toScore(r));
  }

  getLatest(projectId: string): BehaviorScore | null {
    const row = getDb().prepare(`
      SELECT * FROM ai_behavior_scores WHERE project_id = ? ORDER BY window_start DESC LIMIT 1
    `).get(projectId) as Record<string, unknown> | undefined;
    return row ? this.toScore(row) : null;
  }

  private toScore(row: Record<string, unknown>): BehaviorScore {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      windowStart: row.window_start as number,
      windowEnd: row.window_end as number,
      totalActions: row.total_actions as number,
      riskScore: row.risk_score as number,
      velocityScore: row.velocity_score as number,
      complianceScore: row.compliance_score as number,
      overallScore: row.overall_score as number,
      details: row.details ? JSON.parse(row.details as string) : null,
      createdAt: row.created_at as number,
    };
  }
}
