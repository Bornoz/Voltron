import { generatePatches, applyPatches, type PatchResult } from './PatchEngine';
import type { Operation } from 'fast-json-patch';

/**
 * Tracked UI state representation.
 */
export interface UIState {
  styles: Record<string, Record<string, string>>;
  layout: Record<string, {
    width: string;
    height: string;
    top: string;
    left: string;
    position: string;
  }>;
  props: Record<string, Record<string, string>>;
  timestamp: number;
}

interface StateChange {
  type: 'style' | 'layout' | 'prop';
  selector: string;
  changes: Record<string, string>;
  timestamp: number;
  source: 'human' | 'ai';
}

/**
 * StateTracker records all UI changes and maintains the current state.
 * Supports snapshotting, delta computation, and change history.
 */
export class StateTracker {
  private currentState: UIState;
  private baseState: UIState;
  private changeLog: StateChange[] = [];
  private maxLogSize: number;

  constructor(maxLogSize = 500) {
    this.maxLogSize = maxLogSize;
    const empty: UIState = {
      styles: {},
      layout: {},
      props: {},
      timestamp: Date.now(),
    };
    this.currentState = structuredClone(empty);
    this.baseState = structuredClone(empty);
  }

  /**
   * Record a style change for an element.
   */
  recordStyleChange(
    selector: string,
    property: string,
    value: string,
    source: 'human' | 'ai' = 'human',
  ): void {
    if (!this.currentState.styles[selector]) {
      this.currentState.styles[selector] = {};
    }
    this.currentState.styles[selector][property] = value;
    this.currentState.timestamp = Date.now();

    this.addToLog({
      type: 'style',
      selector,
      changes: { [property]: value },
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * Record a layout change for an element.
   */
  recordLayoutChange(
    selector: string,
    changes: Partial<{ width: string; height: string; top: string; left: string; position: string }>,
    source: 'human' | 'ai' = 'human',
  ): void {
    if (!this.currentState.layout[selector]) {
      this.currentState.layout[selector] = {
        width: '', height: '', top: '', left: '', position: '',
      };
    }

    const layout = this.currentState.layout[selector];
    if (changes.width !== undefined) layout.width = changes.width;
    if (changes.height !== undefined) layout.height = changes.height;
    if (changes.top !== undefined) layout.top = changes.top;
    if (changes.left !== undefined) layout.left = changes.left;
    if (changes.position !== undefined) layout.position = changes.position;

    this.currentState.timestamp = Date.now();

    this.addToLog({
      type: 'layout',
      selector,
      changes: changes as Record<string, string>,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * Record a prop/attribute change for an element.
   */
  recordPropChange(
    selector: string,
    attribute: string,
    value: string,
    source: 'human' | 'ai' = 'human',
  ): void {
    if (!this.currentState.props[selector]) {
      this.currentState.props[selector] = {};
    }
    this.currentState.props[selector][attribute] = value;
    this.currentState.timestamp = Date.now();

    this.addToLog({
      type: 'prop',
      selector,
      changes: { [attribute]: value },
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * Get the full current state snapshot.
   */
  getSnapshot(): UIState {
    return structuredClone(this.currentState);
  }

  /**
   * Get the base state (from last reset/init).
   */
  getBaseState(): UIState {
    return structuredClone(this.baseState);
  }

  /**
   * Compute delta (patches) from base state to current state.
   */
  computeDelta(): PatchResult {
    return generatePatches(this.baseState, this.currentState);
  }

  /**
   * Compute delta from last known state using explicit previous state.
   */
  computeDeltaFrom(previousState: UIState): PatchResult {
    return generatePatches(previousState, this.currentState);
  }

  /**
   * Apply external patches to the current state.
   */
  applyExternalPatches(patches: Operation[]): void {
    this.currentState = applyPatches(this.currentState, patches);
    this.currentState.timestamp = Date.now();
  }

  /**
   * Reset base state to current state (marks current as the new "clean" state).
   */
  resetBase(): void {
    this.baseState = structuredClone(this.currentState);
  }

  /**
   * Get change log entries.
   */
  getChangeLog(): ReadonlyArray<StateChange> {
    return this.changeLog;
  }

  /**
   * Get changes filtered by source.
   */
  getChangesBySource(source: 'human' | 'ai'): StateChange[] {
    return this.changeLog.filter((c) => c.source === source);
  }

  /**
   * Get changes since a given timestamp.
   */
  getChangesSince(timestamp: number): StateChange[] {
    return this.changeLog.filter((c) => c.timestamp > timestamp);
  }

  /**
   * Check if there are any changes from the base state.
   */
  hasChanges(): boolean {
    const delta = this.computeDelta();
    return delta.patches.length > 0;
  }

  /**
   * Clear all state and history.
   */
  clear(): void {
    const empty: UIState = {
      styles: {},
      layout: {},
      props: {},
      timestamp: Date.now(),
    };
    this.currentState = structuredClone(empty);
    this.baseState = structuredClone(empty);
    this.changeLog = [];
  }

  private addToLog(change: StateChange): void {
    this.changeLog.push(change);
    if (this.changeLog.length > this.maxLogSize) {
      this.changeLog = this.changeLog.slice(-Math.floor(this.maxLogSize * 0.8));
    }
  }
}
