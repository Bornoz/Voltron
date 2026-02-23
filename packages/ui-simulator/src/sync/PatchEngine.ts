import { compare, applyPatch, type Operation } from 'fast-json-patch';

/**
 * PatchEngine wraps fast-json-patch for generating, applying, and inverting
 * JSON patches. Used for tracking UI state changes and enabling undo/redo.
 */

export interface PatchResult {
  patches: Operation[];
  inversePatches: Operation[];
}

/**
 * Generate JSON patches between two states.
 * Returns both forward and inverse patches for undo support.
 */
export function generatePatches<T extends object>(
  oldState: T,
  newState: T,
): PatchResult {
  const patches = compare(oldState, newState);
  const inversePatches = compare(newState, oldState);
  return { patches, inversePatches };
}

/**
 * Apply JSON patches to a state object.
 * Returns a new object with patches applied (does not mutate input).
 */
export function applyPatches<T extends object>(
  state: T,
  patches: Operation[],
): T {
  if (patches.length === 0) return state;

  // Clone state to avoid mutation
  const cloned = structuredClone(state);
  const result = applyPatch(cloned, patches, true, false);

  return result.newDocument as T;
}

/**
 * Compute inverse patches that would undo the given patches.
 */
export function computeInverse<T extends object>(
  stateBeforePatches: T,
  patches: Operation[],
): Operation[] {
  // Apply patches to get the "after" state
  const afterState = applyPatches(stateBeforePatches, patches);
  // Generate reverse patches
  return compare(afterState, stateBeforePatches);
}

/**
 * Check if two patch sets conflict (touch the same paths).
 */
export function detectConflicts(
  patchesA: Operation[],
  patchesB: Operation[],
): Array<{ pathA: string; pathB: string; opA: Operation; opB: Operation }> {
  const conflicts: Array<{ pathA: string; pathB: string; opA: Operation; opB: Operation }> = [];

  for (const a of patchesA) {
    for (const b of patchesB) {
      // Direct path match
      if (a.path === b.path) {
        conflicts.push({ pathA: a.path, pathB: b.path, opA: a, opB: b });
        continue;
      }
      // One is a prefix of the other (parent/child conflict)
      if (a.path.startsWith(b.path + '/') || b.path.startsWith(a.path + '/')) {
        conflicts.push({ pathA: a.path, pathB: b.path, opA: a, opB: b });
      }
    }
  }

  return conflicts;
}

/**
 * Merge two patch sets, with priorityPatches winning on conflicts.
 */
export function mergePatches(
  priorityPatches: Operation[],
  otherPatches: Operation[],
): Operation[] {
  const conflicts = detectConflicts(priorityPatches, otherPatches);
  const conflictingPaths = new Set(conflicts.map((c) => c.pathB));

  // Include all priority patches and non-conflicting other patches
  const merged: Operation[] = [...priorityPatches];

  for (const patch of otherPatches) {
    if (!conflictingPaths.has(patch.path)) {
      merged.push(patch);
    }
  }

  return merged;
}
