import { simpleGit, type SimpleGit } from 'simple-git';
import { v4 as uuid } from 'uuid';
import { statSync, readdirSync } from 'fs';
import { join } from 'path';
import type { Snapshot } from '@voltron/shared';

export class SnapshotManager {
  private git: SimpleGit;
  private lastSnapshotId: string | null = null;

  constructor(private projectRoot: string, private projectId: string) {
    this.git = simpleGit(projectRoot);
  }

  async init(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      await this.git.init();
      await this.git.add('.');
      await this.git.commit('voltron: initial snapshot');
    }
  }

  async createSnapshot(file: string, action: string, fileSize?: number): Promise<Snapshot> {
    const id = uuid();
    const parentId = this.lastSnapshotId;

    try {
      await this.git.add(file);
    } catch {
      await this.git.add('.');
    }

    const commitMsg = `voltron: ${action} ${file} [snap:${id}]`;
    let commitHash: string;

    try {
      const result = await this.git.commit(commitMsg, undefined, { '--allow-empty': null });
      commitHash = result.commit || '';

      if (!commitHash) {
        const log = await this.git.log({ maxCount: 1 });
        commitHash = log.latest?.hash ?? '0'.repeat(40);
      }
    } catch {
      const log = await this.git.log({ maxCount: 1 });
      commitHash = log.latest?.hash ?? '0'.repeat(40);
    }

    // Pad or truncate to exactly 40 chars
    commitHash = commitHash.padEnd(40, '0').slice(0, 40);

    // Compute real file count and total size
    let fileCount = 0;
    let totalSize = fileSize ?? 0;
    try {
      fileCount = this.countTrackedFiles();
      if (!fileSize) {
        const fullPath = join(this.projectRoot, file);
        try {
          totalSize = statSync(fullPath).size;
        } catch {
          totalSize = 0;
        }
      }
    } catch {
      // fallback
    }

    // Critical if action involves deletion or config
    const isCritical = action === 'FILE_DELETE' || action === 'DIR_DELETE' || action === 'CONFIG_CHANGE';

    this.lastSnapshotId = id;

    return {
      id,
      projectId: this.projectId,
      parentId: parentId,
      gitCommitHash: commitHash,
      fileCount,
      totalSize,
      isCritical,
      createdAt: Date.now(),
    };
  }

  private countTrackedFiles(): number {
    try {
      // Quick estimate from working tree
      return this.countFilesRecursive(this.projectRoot, 0, 3);
    } catch {
      return 0;
    }
  }

  private countFilesRecursive(dir: string, depth: number, maxDepth: number): number {
    if (depth > maxDepth) return 0;
    let count = 0;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        if (entry.isFile()) count++;
        else if (entry.isDirectory()) count += this.countFilesRecursive(join(dir, entry.name), depth + 1, maxDepth);
      }
    } catch { /* permission errors */ }
    return count;
  }

  getLastSnapshotId(): string | null {
    return this.lastSnapshotId;
  }
}
