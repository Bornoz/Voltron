import type { Operation } from 'fast-json-patch';
import { detectConflicts } from './PatchEngine.js';
import { ConflictResolver, type ResolutionStrategy } from './ConflictResolver.js';
import type { SimulatorWebSocket } from '../lib/ws';

/**
 * AiResync handles bidirectional synchronization between AI agent changes
 * and human operator edits in the UI Simulator.
 *
 * Flow:
 * 1. AI agent changes file → interceptor detects → server broadcasts
 * 2. Simulator receives EVENT_BROADCAST with file change
 * 3. AiResync compares AI state vs current simulator state
 * 4. Detects conflicts with pending human edits
 * 5. Resolves using ConflictResolver (human_wins by default)
 * 6. Applies non-conflicting AI changes to simulator
 */

export interface AiChange {
  filePath: string;
  operation: string;
  diff?: string;
  timestamp: number;
}

export interface ResyncResult {
  applied: Operation[];
  rejected: Operation[];
  conflicts: Array<{
    path: string;
    aiValue: unknown;
    humanValue: unknown;
    resolution: ResolutionStrategy;
  }>;
  requiresFullReload: boolean;
}

export class AiResync {
  private resolver = new ConflictResolver();
  private pendingHumanEdits: Operation[] = [];
  private lastKnownAiState: Record<string, unknown> = {};
  private lastSyncTimestamp = 0;
  private wsUnsub: (() => void) | null = null;
  private onResyncResult: ((result: ResyncResult) => void) | null = null;
  private reloadCallback: (() => void) | null = null;

  /**
   * Track a human edit from the simulator panels.
   * These edits take priority over AI changes.
   */
  trackHumanEdit(patches: Operation[]): void {
    this.pendingHumanEdits.push(...patches);

    // Prune old edits (keep last 100)
    if (this.pendingHumanEdits.length > 100) {
      this.pendingHumanEdits = this.pendingHumanEdits.slice(-100);
    }
  }

  /**
   * Clear tracked human edits (after successful sync or manual reset).
   */
  clearHumanEdits(): void {
    this.pendingHumanEdits = [];
  }

  /**
   * Process an incoming AI change and determine what to apply.
   */
  processAiChange(
    aiChange: AiChange,
    currentSimulatorState: Record<string, unknown>,
  ): ResyncResult {
    const result: ResyncResult = {
      applied: [],
      rejected: [],
      conflicts: [],
      requiresFullReload: false,
    };

    // If the change is a DELETE or RENAME, we need full reload
    if (aiChange.operation === 'DELETE' || aiChange.operation === 'RENAME') {
      result.requiresFullReload = true;
      this.lastSyncTimestamp = aiChange.timestamp;
      return result;
    }

    // For CSS/HTML/JSX files, try to generate patches
    if (this.isUiRelevantFile(aiChange.filePath)) {
      // Generate patches from last known AI state to new state
      const aiPatches = this.extractPatchesFromDiff(aiChange);

      if (aiPatches.length === 0) {
        // No parseable patches - require full reload
        result.requiresFullReload = true;
        this.lastSyncTimestamp = aiChange.timestamp;
        return result;
      }

      // Check for conflicts with human edits
      const conflicts = detectConflicts(this.pendingHumanEdits, aiPatches);

      if (conflicts.length === 0) {
        // No conflicts - apply all AI patches
        result.applied = aiPatches;
      } else {
        // Resolve conflicts using default strategy (human_wins)
        const strategy = this.resolver.getStrategy();

        for (const conflict of conflicts) {
          const resolution: ResolutionStrategy = strategy === 'merged'
            ? (aiChange.timestamp > Date.now() - 5000 ? 'ai_wins' : 'human_wins')
            : strategy;

          result.conflicts.push({
            path: conflict.pathB,
            aiValue: 'value' in conflict.opB ? conflict.opB.value : undefined,
            humanValue: 'value' in conflict.opA ? conflict.opA.value : undefined,
            resolution,
          });

          if (resolution === 'ai_wins') {
            result.applied.push(conflict.opB);
          } else {
            result.rejected.push(conflict.opB);
          }
        }

        // Apply non-conflicting AI patches
        const conflictingPaths = new Set(conflicts.map((c) => c.pathB));
        for (const patch of aiPatches) {
          if (!conflictingPaths.has(patch.path)) {
            result.applied.push(patch);
          }
        }
      }
    } else {
      // Non-UI file changed - no simulator action needed
    }

    this.lastSyncTimestamp = aiChange.timestamp;
    return result;
  }

  /**
   * Connect to the Voltron server via WebSocket to receive AI file changes.
   * Processes EVENT_BROADCAST messages and applies patches or triggers reload.
   */
  connectToServer(
    wsClient: SimulatorWebSocket,
    opts?: {
      onResyncResult?: (result: ResyncResult) => void;
      onReload?: () => void;
    },
  ): () => void {
    this.onResyncResult = opts?.onResyncResult ?? null;
    this.reloadCallback = opts?.onReload ?? null;

    // Disconnect previous subscription if any
    this.disconnectServer();

    this.wsUnsub = wsClient.on('EVENT_BROADCAST', (msg) => {
      const event = msg.payload as { file: string; action: string; diff?: string };

      const aiChange: AiChange = {
        filePath: event.file,
        operation: event.action.toUpperCase(),
        diff: event.diff,
        timestamp: msg.timestamp ?? Date.now(),
      };

      const currentState: Record<string, unknown> = {};
      const result = this.processAiChange(aiChange, currentState);

      if (result.requiresFullReload) {
        this.reloadCallback?.();
      }

      this.onResyncResult?.(result);
    });

    return () => this.disconnectServer();
  }

  /**
   * Disconnect from server WebSocket.
   */
  disconnectServer(): void {
    if (this.wsUnsub) {
      this.wsUnsub();
      this.wsUnsub = null;
    }
  }

  /**
   * Force a full resync from server state.
   */
  forceResync(): void {
    this.pendingHumanEdits = [];
    this.lastKnownAiState = {};
    this.lastSyncTimestamp = 0;
  }

  /**
   * Check if a file change is relevant to the UI simulator.
   */
  private isUiRelevantFile(filePath: string): boolean {
    const uiExtensions = ['.css', '.scss', '.less', '.html', '.htm', '.tsx', '.jsx', '.vue', '.svelte'];
    const tailwindPattern = /tailwind\.config/;
    const globalCssPattern = /global|app|index|main/;

    const ext = filePath.substring(filePath.lastIndexOf('.'));

    if (uiExtensions.includes(ext)) return true;
    if (tailwindPattern.test(filePath)) return true;
    if (globalCssPattern.test(filePath) && ext === '.css') return true;

    return false;
  }

  /**
   * Extract JSON patches from a diff string.
   * This is a best-effort parser for CSS/style changes.
   */
  private extractPatchesFromDiff(change: AiChange): Operation[] {
    const patches: Operation[] = [];

    if (!change.diff) return patches;

    // Parse CSS-like changes from diff
    const addedLines = change.diff
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.substring(1).trim());

    const removedLines = change.diff
      .split('\n')
      .filter((line) => line.startsWith('-') && !line.startsWith('---'))
      .map((line) => line.substring(1).trim());

    // Parse CSS property changes
    for (const line of addedLines) {
      const cssMatch = line.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
      if (cssMatch) {
        patches.push({
          op: 'replace',
          path: `/styles/${cssMatch[1]}`,
          value: cssMatch[2],
        });
      }
    }

    // Parse CSS property removals
    for (const line of removedLines) {
      const cssMatch = line.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
      if (cssMatch) {
        // Only add remove if not also in added (which means it was changed, not removed)
        const wasChanged = addedLines.some((l) => l.startsWith(cssMatch[1]));
        if (!wasChanged) {
          patches.push({
            op: 'remove',
            path: `/styles/${cssMatch[1]}`,
          });
        }
      }
    }

    return patches;
  }
}
