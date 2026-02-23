import { hashStream } from '@voltron/shared';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import picomatch from 'picomatch';

export class HashTracker {
  private hashes = new Map<string, string>();
  private ignoreMatch: ReturnType<typeof picomatch>;

  constructor(private projectRoot: string, ignorePatterns: string[]) {
    this.ignoreMatch = picomatch(ignorePatterns);
  }

  async fullScan(): Promise<void> {
    this.hashes.clear();
    await this.scanDir(this.projectRoot);
  }

  private async scanDir(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relPath = fullPath.slice(this.projectRoot.length + 1);

      if (this.ignoreMatch(relPath)) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          await this.scanDir(fullPath);
        } else if (stat.isFile()) {
          const hash = await hashStream(fullPath);
          this.hashes.set(relPath, hash);
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  async getHash(relPath: string): Promise<string | null> {
    const fullPath = join(this.projectRoot, relPath);
    if (!existsSync(fullPath)) return null;
    try {
      const hash = await hashStream(fullPath);
      this.hashes.set(relPath, hash);
      return hash;
    } catch {
      return null;
    }
  }

  getPreviousHash(relPath: string): string | undefined {
    return this.hashes.get(relPath);
  }

  setHash(relPath: string, hash: string): void {
    this.hashes.set(relPath, hash);
  }

  removeHash(relPath: string): void {
    this.hashes.delete(relPath);
  }

  getAllHashes(): Map<string, string> {
    return new Map(this.hashes);
  }
}
