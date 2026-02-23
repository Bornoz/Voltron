import type { SimulatorConflict } from '@voltron/shared';

export type ResolutionStrategy = 'human_wins' | 'ai_wins' | 'merged';

interface PropertyChange {
  selector: string;
  property: string;
  value: string;
  source: 'human' | 'ai';
  timestamp: number;
}

interface ConflictDetectionResult {
  hasConflict: boolean;
  conflicts: DetectedConflict[];
}

interface DetectedConflict {
  selector: string;
  property: string;
  humanValue: string;
  aiValue: string;
  humanTimestamp: number;
  aiTimestamp: number;
}

/**
 * ConflictResolver detects and resolves overlapping changes between
 * human-driven and AI-driven modifications to the same UI elements.
 */
export class ConflictResolver {
  private defaultStrategy: ResolutionStrategy;
  private resolvedConflicts: Map<string, SimulatorConflict> = new Map();

  constructor(defaultStrategy: ResolutionStrategy = 'human_wins') {
    this.defaultStrategy = defaultStrategy;
  }

  /**
   * Detect conflicts between human and AI changes.
   * Two changes conflict if they target the same selector + property.
   */
  detectConflicts(
    humanChanges: PropertyChange[],
    aiChanges: PropertyChange[],
  ): ConflictDetectionResult {
    const conflicts: DetectedConflict[] = [];

    // Index human changes by selector+property
    const humanIndex = new Map<string, PropertyChange>();
    for (const change of humanChanges) {
      const key = `${change.selector}::${change.property}`;
      humanIndex.set(key, change);
    }

    // Check AI changes against human index
    for (const aiChange of aiChanges) {
      const key = `${aiChange.selector}::${aiChange.property}`;
      const humanChange = humanIndex.get(key);

      if (humanChange) {
        // Same property modified by both human and AI
        if (humanChange.value !== aiChange.value) {
          conflicts.push({
            selector: aiChange.selector,
            property: aiChange.property,
            humanValue: humanChange.value,
            aiValue: aiChange.value,
            humanTimestamp: humanChange.timestamp,
            aiTimestamp: aiChange.timestamp,
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Resolve a set of conflicts using the configured strategy.
   * Returns the winning values for each conflicted property.
   */
  resolveConflicts(
    conflicts: DetectedConflict[],
    strategy?: ResolutionStrategy,
  ): Array<{ selector: string; property: string; resolvedValue: string; resolution: ResolutionStrategy }> {
    const effectiveStrategy = strategy ?? this.defaultStrategy;
    const resolutions: Array<{
      selector: string;
      property: string;
      resolvedValue: string;
      resolution: ResolutionStrategy;
    }> = [];

    for (const conflict of conflicts) {
      let resolvedValue: string;
      let resolution: ResolutionStrategy;

      switch (effectiveStrategy) {
        case 'human_wins':
          resolvedValue = conflict.humanValue;
          resolution = 'human_wins';
          break;

        case 'ai_wins':
          resolvedValue = conflict.aiValue;
          resolution = 'ai_wins';
          break;

        case 'merged':
          // For merged strategy: human wins if their change is newer, otherwise AI
          if (conflict.humanTimestamp >= conflict.aiTimestamp) {
            resolvedValue = conflict.humanValue;
            resolution = 'human_wins';
          } else {
            resolvedValue = conflict.aiValue;
            resolution = 'ai_wins';
          }
          break;
      }

      resolutions.push({
        selector: conflict.selector,
        property: conflict.property,
        resolvedValue,
        resolution,
      });

      // Track resolved conflict
      const conflictId = `${conflict.selector}::${conflict.property}::${Date.now()}`;
      this.resolvedConflicts.set(conflictId, {
        elementId: conflict.selector,
        humanChange: { property: conflict.property, value: conflict.humanValue },
        aiChange: { property: conflict.property, value: conflict.aiValue },
        timestamp: Date.now(),
        resolved: true,
        resolution,
      });
    }

    return resolutions;
  }

  /**
   * Merge human and AI change sets, resolving any conflicts.
   * Returns the final merged set of property changes.
   */
  mergeChanges(
    humanChanges: PropertyChange[],
    aiChanges: PropertyChange[],
    strategy?: ResolutionStrategy,
  ): PropertyChange[] {
    const { conflicts } = this.detectConflicts(humanChanges, aiChanges);
    const resolutions = this.resolveConflicts(conflicts, strategy);

    // Build resolution lookup
    const resolutionMap = new Map<string, string>();
    for (const r of resolutions) {
      resolutionMap.set(`${r.selector}::${r.property}`, r.resolvedValue);
    }

    // Start with all human changes
    const merged = new Map<string, PropertyChange>();
    for (const change of humanChanges) {
      const key = `${change.selector}::${change.property}`;
      const resolvedValue = resolutionMap.get(key);
      merged.set(key, resolvedValue !== undefined ? { ...change, value: resolvedValue } : change);
    }

    // Add non-conflicting AI changes
    for (const change of aiChanges) {
      const key = `${change.selector}::${change.property}`;
      if (!merged.has(key)) {
        merged.set(key, change);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Get all resolved conflicts history.
   */
  getResolvedConflicts(): SimulatorConflict[] {
    return Array.from(this.resolvedConflicts.values());
  }

  /**
   * Clear resolved conflicts history.
   */
  clearHistory(): void {
    this.resolvedConflicts.clear();
  }

  /**
   * Update the default resolution strategy.
   */
  setStrategy(strategy: ResolutionStrategy): void {
    this.defaultStrategy = strategy;
  }

  /**
   * Get the current default strategy.
   */
  getStrategy(): ResolutionStrategy {
    return this.defaultStrategy;
  }
}
