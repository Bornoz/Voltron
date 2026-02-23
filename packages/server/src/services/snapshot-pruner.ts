import { SnapshotRepository } from '../db/repositories/snapshots.js';
import { ProjectRepository } from '../db/repositories/projects.js';

/**
 * Periodically prunes old snapshots to keep disk usage under control.
 * Respects each project's snapshotRetention setting.
 * Never prunes critical snapshots.
 */
export class SnapshotPruner {
  private interval: ReturnType<typeof setInterval> | null = null;
  private snapshotRepo: SnapshotRepository;
  private projectRepo: ProjectRepository;

  constructor(
    private pruneIntervalMs = 3600_000, // 1 hour
  ) {
    this.snapshotRepo = new SnapshotRepository();
    this.projectRepo = new ProjectRepository();
  }

  start(): void {
    // Run once on startup after a short delay
    setTimeout(() => this.pruneAll(), 10_000);

    // Schedule periodic runs
    this.interval = setInterval(() => this.pruneAll(), this.pruneIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private pruneAll(): void {
    try {
      const projects = this.projectRepo.findAll();

      for (const project of projects) {
        const retention = project.snapshotRetention ?? 100;
        const count = this.snapshotRepo.count(project.id);

        if (count > retention) {
          const deleted = this.snapshotRepo.prune(project.id, retention);
          if (deleted > 0) {
            console.log(`[SnapshotPruner] Pruned ${deleted} snapshots from project ${project.name} (kept ${retention})`);
          }
        }
      }
    } catch (err) {
      console.error('[SnapshotPruner] Error during prune:', err);
    }
  }
}
