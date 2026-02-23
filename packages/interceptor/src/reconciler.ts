import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import picomatch from 'picomatch';
import { hashStream, type OperationType } from '@voltron/shared';
import type { HashTracker } from './hasher.js';

interface ReconcileEvent {
  action: OperationType;
  relPath: string;
}

export class Reconciler {
  private ignoreMatch: ReturnType<typeof picomatch>;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private projectRoot: string,
    private hashTracker: HashTracker,
    ignorePatterns: string[],
    private onEvents: (events: ReconcileEvent[]) => void,
  ) {
    this.ignoreMatch = picomatch(ignorePatterns);
  }

  start(intervalMs: number): void {
    this.interval = setInterval(() => this.reconcile(), intervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async reconcile(): Promise<void> {
    const events: ReconcileEvent[] = [];
    const knownHashes = this.hashTracker.getAllHashes();
    const currentFiles = new Set<string>();

    // Scan current files
    await this.scanDir(this.projectRoot, currentFiles, events, knownHashes);

    // Detect deletions
    for (const [relPath] of knownHashes) {
      if (!currentFiles.has(relPath)) {
        events.push({ action: 'FILE_DELETE', relPath });
        this.hashTracker.removeHash(relPath);
      }
    }

    if (events.length > 0) {
      console.log(`[reconciler] Found ${events.length} discrepancies`);
      this.onEvents(events);
    }
  }

  private async scanDir(
    dir: string,
    currentFiles: Set<string>,
    events: ReconcileEvent[],
    knownHashes: Map<string, string>,
  ): Promise<void> {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relPath = fullPath.slice(this.projectRoot.length + 1).replace(/\\/g, '/');

      if (this.ignoreMatch(relPath)) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          await this.scanDir(fullPath, currentFiles, events, knownHashes);
        } else if (stat.isFile()) {
          currentFiles.add(relPath);
          const currentHash = await hashStream(fullPath);
          const knownHash = knownHashes.get(relPath);

          if (!knownHash) {
            events.push({ action: 'FILE_CREATE', relPath });
            this.hashTracker.setHash(relPath, currentHash);
          } else if (knownHash !== currentHash) {
            events.push({ action: 'FILE_MODIFY', relPath });
            this.hashTracker.setHash(relPath, currentHash);
          }
        }
      } catch {
        // Skip unreadable
      }
    }
  }
}
