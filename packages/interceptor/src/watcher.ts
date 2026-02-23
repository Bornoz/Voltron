import { watch, type FSWatcher } from 'chokidar';
import { relative } from 'node:path';
import type { OperationType } from '@voltron/shared';

interface FileEvent {
  action: OperationType;
  relPath: string;
  fullPath: string;
  timestamp: number;
}

type EventHandler = (event: FileEvent) => void;

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private renameBuffer = new Map<string, { path: string; timestamp: number }>();
  private paused = false;

  constructor(
    private projectRoot: string,
    private debounceMs: number,
    private ignorePatterns: string[],
    private onEvent: EventHandler,
  ) {}

  start(): void {
    this.watcher = watch(this.projectRoot, {
      ignored: this.ignorePatterns.map(p => {
        if (p.includes('**')) return p;
        return `**/${p}`;
      }),
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });

    this.watcher.on('add', (path) => this.handleEvent('FILE_CREATE', path));
    this.watcher.on('change', (path) => this.handleEvent('FILE_MODIFY', path));
    this.watcher.on('unlink', (path) => this.handleUnlink(path));
    this.watcher.on('addDir', (path) => this.handleEvent('DIR_CREATE', path));
    this.watcher.on('unlinkDir', (path) => this.handleEvent('DIR_DELETE', path));
    this.watcher.on('error', (err) => console.error('[watcher] Error:', err));

    console.log(`[watcher] Watching: ${this.projectRoot}`);
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  private handleEvent(action: OperationType, fullPath: string): void {
    if (this.paused) return;

    const relPath = relative(this.projectRoot, fullPath).replace(/\\/g, '/');
    if (!relPath || relPath.startsWith('..')) return;

    // Debounce same file
    const existing = this.debounceTimers.get(relPath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(relPath, setTimeout(() => {
      this.debounceTimers.delete(relPath);
      this.onEvent({ action, relPath, fullPath, timestamp: Date.now() });
    }, this.debounceMs));
  }

  private handleUnlink(fullPath: string): void {
    if (this.paused) return;

    const relPath = relative(this.projectRoot, fullPath).replace(/\\/g, '/');
    if (!relPath || relPath.startsWith('..')) return;

    // Check for rename (unlink + add within window)
    this.renameBuffer.set(relPath, { path: relPath, timestamp: Date.now() });
    setTimeout(() => {
      if (this.renameBuffer.has(relPath)) {
        this.renameBuffer.delete(relPath);
        this.handleEvent('FILE_DELETE', fullPath);
      }
    }, 150);
  }
}
