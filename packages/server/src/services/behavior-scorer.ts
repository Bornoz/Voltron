import { RISK_VALUE } from '@voltron/shared';
import { ActionRepository } from '../db/repositories/actions.js';
import { BehaviorScoreRepository } from '../db/repositories/behavior-scores.js';
import { ProjectRepository } from '../db/repositories/projects.js';

const WINDOW_MS = 5 * 60 * 1000; // 5-minute scoring window

export class BehaviorScorer {
  private actionRepo = new ActionRepository();
  private scoreRepo = new BehaviorScoreRepository();
  private projectRepo = new ProjectRepository();
  private interval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Score every 5 minutes
    this.interval = setInterval(() => this.scoreAll(), WINDOW_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async scoreAll(): Promise<void> {
    try {
      const projects = this.projectRepo.findAll();
      for (const project of projects) {
        if (!project.isActive) continue;
        this.scoreProject(project.id);
      }
    } catch (err) {
      console.warn('[BehaviorScorer] Score cycle failed:', err instanceof Error ? err.message : err);
    }
  }

  scoreProject(projectId: string): void {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;
    const stats = this.actionRepo.getStats(projectId);
    const recent = this.actionRepo.getRecentActions(projectId, WINDOW_MS);

    if (recent.length === 0) return; // No activity, skip scoring

    // 1. Risk Score (0-100, lower is better): weighted average of risk levels
    const riskWeights: Record<string, number> = { NONE: 0, LOW: 10, MEDIUM: 30, HIGH: 60, CRITICAL: 100 };
    const totalRiskWeight = recent.reduce((sum, a) => sum + (riskWeights[a.risk] ?? 0), 0);
    const riskScore = Math.max(0, 100 - (totalRiskWeight / Math.max(recent.length, 1)));

    // 2. Velocity Score (0-100): Actions per minute, penalize extremes
    const actionsPerMinute = recent.length / (WINDOW_MS / 60000);
    // Ideal: 1-10 actions/min. Too fast (>30) or too slow (<0.1) gets lower score
    let velocityScore = 100;
    if (actionsPerMinute > 30) velocityScore = Math.max(0, 100 - (actionsPerMinute - 30) * 3);
    else if (actionsPerMinute > 10) velocityScore = Math.max(50, 100 - (actionsPerMinute - 10) * 2.5);

    // 3. Compliance Score (0-100): Ratio of non-blocked, non-zone-violated actions
    const zoneViolations = recent.filter(a => a.protectionZone && a.protectionZone !== 'NONE').length;
    const complianceScore = Math.max(0, 100 - (zoneViolations / Math.max(recent.length, 1)) * 100);

    // 4. Overall Score: weighted average
    const overallScore = Math.round(
      riskScore * 0.4 + velocityScore * 0.3 + complianceScore * 0.3
    );

    // Build detail breakdown
    const details: Record<string, unknown> = {
      actionCount: recent.length,
      actionsPerMinute: Math.round(actionsPerMinute * 10) / 10,
      riskBreakdown: stats,
      zoneViolations,
      topFiles: this.getTopFiles(recent),
    };

    this.scoreRepo.insert({
      projectId,
      windowStart,
      windowEnd: now,
      totalActions: recent.length,
      riskScore: Math.round(riskScore),
      velocityScore: Math.round(velocityScore),
      complianceScore: Math.round(complianceScore),
      overallScore,
      details,
    });
  }

  private getTopFiles(actions: { file: string }[]): Record<string, number> {
    const counts = new Map<string, number>();
    for (const a of actions) {
      counts.set(a.file, (counts.get(a.file) ?? 0) + 1);
    }
    return Object.fromEntries(
      [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    );
  }
}
