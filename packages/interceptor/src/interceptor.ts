import { v4 as uuid } from 'uuid';
import type { AiActionEvent, OperationType, ProtectionZoneConfig } from '@voltron/shared';
import { hashString } from '@voltron/shared';
import { FileWatcher } from './watcher.js';
import { SnapshotManager } from './snapshot.js';
import { HashTracker } from './hasher.js';
import { DiffGenerator } from './differ.js';
import { ZoneGuard } from './protection.js';
import { ServerBridge } from './bridge.js';
import { Reconciler } from './reconciler.js';
import { RateLimiter } from './rate-limiter.js';
import type { InterceptorConfig } from './config.js';

export class Interceptor {
  private watcher: FileWatcher;
  private snapshot: SnapshotManager;
  private hasher: HashTracker;
  private differ: DiffGenerator;
  private zoneGuard: ZoneGuard;
  private bridge: ServerBridge;
  private reconciler: Reconciler;
  private rateLimiter: RateLimiter;
  private sequenceNumber = 0;
  private stopped = false;
  private lastEventHash: string | null = null;

  constructor(private config: InterceptorConfig) {
    this.hasher = new HashTracker(config.projectRoot, config.ignorePatterns);
    this.differ = new DiffGenerator(config.projectRoot, config.maxFileSize);
    this.zoneGuard = new ZoneGuard(config.projectRoot);
    this.rateLimiter = new RateLimiter();
    this.snapshot = new SnapshotManager(config.projectRoot, config.projectId);

    this.bridge = new ServerBridge({
      serverUrl: config.serverUrl,
      projectId: config.projectId,
      authToken: config.authToken,
    });

    this.bridge.onCommand = (type, payload) => this.handleCommand(type, payload);

    this.watcher = new FileWatcher(
      config.projectRoot,
      config.debounceMs,
      config.ignorePatterns,
      (event) => this.handleFileEvent(event.action, event.relPath),
    );

    this.reconciler = new Reconciler(
      config.projectRoot,
      this.hasher,
      config.ignorePatterns,
      (events) => {
        for (const e of events) {
          this.handleFileEvent(e.action, e.relPath);
        }
      },
    );
  }

  async start(): Promise<void> {
    console.log(`[interceptor] Starting for project: ${this.config.projectRoot}`);

    // Initialize git repo if needed
    await this.snapshot.init();

    // Full hash scan
    console.log('[interceptor] Running initial hash scan...');
    await this.hasher.fullScan();
    console.log(`[interceptor] Hashed ${this.hasher.getAllHashes().size} files`);

    // Connect to server
    this.bridge.connect();

    // Start watching
    this.watcher.start();

    // Start reconciler
    this.reconciler.start(this.config.reconcileInterval);

    console.log('[interceptor] Ready');
  }

  async stop(): Promise<void> {
    console.log('[interceptor] Shutting down gracefully...');
    this.stopped = true;

    // Stop reconciler first (prevents new events)
    this.reconciler.stop();

    // Stop watcher (prevents new file events)
    this.watcher.stop();

    // Wait briefly for in-flight events to flush
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Disconnect from server
    this.bridge.disconnect();
    console.log('[interceptor] Shutdown complete');
  }

  private async handleFileEvent(action: OperationType, relPath: string): Promise<void> {
    if (this.stopped) return;

    try {
      const now = Date.now();

      // Rate limiting
      this.rateLimiter.record(now);
      if (this.rateLimiter.isExceeded(this.config.rateLimit)) {
        console.warn('[interceptor] Rate limit exceeded, event throttled');
        return;
      }

      // Zone check
      const zoneResult = this.zoneGuard.check(relPath, action);
      if (zoneResult.blocked) {
        console.warn(`[interceptor] BLOCKED: ${relPath} - ${zoneResult.reason}`);
        this.bridge.send('PROTECTION_VIOLATION', {
          file: relPath,
          action,
          zone: zoneResult.zone,
          reason: zoneResult.reason,
          timestamp: now,
        });
        return;
      }

      // Hash
      const previousHash = this.hasher.getPreviousHash(relPath);
      let hash: string;
      if (action === 'FILE_DELETE' || action === 'DIR_DELETE') {
        hash = previousHash ?? '0'.repeat(64);
        this.hasher.removeHash(relPath);
      } else {
        hash = await this.hasher.getHash(relPath) ?? '0'.repeat(64);
      }

      // Diff
      let diff: string | undefined;
      let isBinary = false;
      let diffTruncated = false;
      let fileSize: number | undefined;

      if (action !== 'FILE_DELETE' && action !== 'DIR_DELETE' && action !== 'DIR_CREATE') {
        const diffResult = await this.differ.generate(relPath);
        diff = diffResult.diff;
        isBinary = diffResult.isBinary;
        diffTruncated = diffResult.diffTruncated;
        fileSize = diffResult.fileSize;
      }

      // Snapshot
      const snapshot = await this.snapshot.createSnapshot(relPath, action, fileSize);

      // Build event
      this.sequenceNumber++;
      const event: AiActionEvent = {
        id: uuid(),
        sequenceNumber: this.sequenceNumber,
        projectId: this.config.projectId,
        action,
        file: relPath,
        risk: 'NONE', // Server will classify
        snapshotId: snapshot.id,
        timestamp: now,
        hash,
        previousHash,
        parentEventHash: this.lastEventHash ?? undefined,
        diff,
        diffTruncated: diffTruncated || undefined,
        protectionZone: zoneResult.level !== 'NONE' ? zoneResult.level : undefined,
        isBinary: isBinary || undefined,
        fileSize,
      };

      // Send snapshot first, then event
      this.bridge.send('SNAPSHOT_CREATED', snapshot);
      this.bridge.send('ACTION_EVENT', event);

      // Update hash chain for next event
      this.lastEventHash = hashString(event.id + event.hash);
    } catch (err) {
      console.error(`[interceptor] Error processing ${action} on ${relPath}:`, err);
    }
  }

  private handleCommand(type: string, _payload: unknown): void {
    switch (type) {
      case 'COMMAND_STOP':
        console.log('[interceptor] STOP received');
        this.stopped = true;
        this.watcher.pause();
        break;
      case 'COMMAND_CONTINUE':
        console.log('[interceptor] CONTINUE received');
        this.stopped = false;
        this.watcher.resume();
        break;
      case 'ZONE_UPDATE': {
        const zones = _payload as ProtectionZoneConfig[];
        this.zoneGuard.setZones(zones);
        console.log(`[interceptor] Zones updated: ${zones.length} zones`);
        break;
      }
    }
  }
}
