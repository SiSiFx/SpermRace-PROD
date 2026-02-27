/**
 * Server Reconciliation
 * Handles server state updates and client correction
 *
 * Interpolates server updates for smooth enemy movement
 * and reconciles local player state with server authority
 */

import type { Position } from '../components';

/**
 * Server snapshot for interpolation
 */
export interface ServerSnapshot {
  /** Snapshot timestamp */
  timestamp: number;

  /** Server tick number */
  tick: number;

  /** Entity states */
  entities: Map<string, ServerEntityState>;
}

/**
 * Entity state from server
 */
export interface ServerEntityState {
  /** Entity ID */
  id: string;

  /** Position X */
  x: number;

  /** Position Y */
  y: number;

  /** Movement angle */
  angle: number;

  /** Speed */
  speed: number;

  /** Is alive */
  isAlive: boolean;

  /** Is boosting */
  isBoosting: boolean;

  /** Input sequence (for local player) */
  sequence?: number;
}

/**
 * Interpolation buffer entry
 */
interface InterpolationEntry {
  snapshot: ServerSnapshot;
  receivedAt: number;
}

/**
 * Reconciliation configuration
 */
export interface ReconciliationConfig {
  /** Interpolation delay (ms) */
  interpolationDelay: number;

  /** Maximum snapshots to buffer */
  maxSnapshots: number;

  /** Extrapolation time (ms) - if no snapshots received */
  extrapolationTime: number;

  /** Enable interpolation */
  enableInterpolation: boolean;
}

/**
 * Server reconciliation system
 * Handles server state updates and client correction
 */
export class ServerReconciliation {
  private readonly _config: ReconciliationConfig;

  /** Snapshot buffer for interpolation */
  private readonly _snapshotBuffer: InterpolationEntry[] = [];

  /** Last applied snapshot */
  private _lastSnapshot: ServerSnapshot | null = null;

  /** Current interpolation time */
  private _interpolationTime: number = 0;

  /** Local player ID */
  private _localPlayerId: string | null = null;

  constructor(config?: Partial<ReconciliationConfig>) {
    this._config = {
      interpolationDelay: config?.interpolationDelay ?? 100,
      maxSnapshots: config?.maxSnapshots ?? 60,
      extrapolationTime: config?.extrapolationTime ?? 500,
      enableInterpolation: config?.enableInterpolation ?? true,
    };
  }

  /**
   * Set local player ID
   */
  setLocalPlayerId(playerId: string): void {
    this._localPlayerId = playerId;
  }

  /**
   * Add server snapshot
   */
  addSnapshot(snapshot: ServerSnapshot): void {
    const entry: InterpolationEntry = {
      snapshot,
      receivedAt: Date.now(),
    };

    this._snapshotBuffer.push(entry);

    // Remove old snapshots
    while (this._snapshotBuffer.length > this._config.maxSnapshots) {
      this._snapshotBuffer.shift();
    }

    // Sort by timestamp
    this._snapshotBuffer.sort((a, b) => a.snapshot.timestamp - b.snapshot.timestamp);
  }

  /**
   * Get interpolated state for an entity
   */
  getInterpolatedState(entityId: string): ServerEntityState | null {
    if (!this._config.enableInterpolation) {
      // Return latest state without interpolation
      const latest = this._snapshotBuffer[this._snapshotBuffer.length - 1];
      if (latest) {
        return latest.snapshot.entities.get(entityId) || null;
      }
      return null;
    }

    const renderTime = Date.now() - this._config.interpolationDelay;

    // Find two snapshots to interpolate between
    let from: ServerSnapshot | null = null;
    let to: ServerSnapshot | null = null;

    for (let i = 0; i < this._snapshotBuffer.length; i++) {
      const entry = this._snapshotBuffer[i];
      const nextEntry = this._snapshotBuffer[i + 1];

      if (entry.snapshot.timestamp <= renderTime) {
        from = entry.snapshot;
        if (nextEntry && nextEntry.snapshot.timestamp > renderTime) {
          to = nextEntry.snapshot;
          break;
        }
      }
    }

    // Interpolate
    if (from && to) {
      return this._interpolate(entityId, from, to, renderTime);
    }

    // Extrapolate from latest snapshot
    if (from) {
      return this._extrapolate(entityId, from, renderTime);
    }

    return null;
  }

  /**
   * Interpolate between two snapshots
   */
  private _interpolate(
    entityId: string,
    from: ServerSnapshot,
    to: ServerSnapshot,
    renderTime: number
  ): ServerEntityState | null {
    const fromState = from.entities.get(entityId);
    const toState = to.entities.get(entityId);

    if (!fromState || !toState) {
      return fromState || toState || null;
    }

    const timeRange = to.timestamp - from.timestamp;
    if (timeRange === 0) {
      return fromState;
    }

    const alpha = (renderTime - from.timestamp) / timeRange;
    const clampedAlpha = Math.max(0, Math.min(1, alpha));

    // Interpolate angle
    let angleDiff = toState.angle - fromState.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    return {
      id: entityId,
      x: fromState.x + (toState.x - fromState.x) * clampedAlpha,
      y: fromState.y + (toState.y - fromState.y) * clampedAlpha,
      angle: fromState.angle + angleDiff * clampedAlpha,
      speed: fromState.speed + (toState.speed - fromState.speed) * clampedAlpha,
      isAlive: toState.isAlive,
      isBoosting: toState.isBoosting,
      sequence: toState.sequence,
    };
  }

  /**
   * Extrapolate from snapshot (for lag spikes)
   */
  private _extrapolate(
    entityId: string,
    from: ServerSnapshot,
    renderTime: number
  ): ServerEntityState | null {
    const state = from.entities.get(entityId);
    if (!state) return null;

    const timeSince = renderTime - from.timestamp;
    if (timeSince > this._config.extrapolationTime) {
      return state; // Too old, don't extrapolate
    }

    const dt = timeSince / 1000;

    return {
      ...state,
      x: state.x + Math.cos(state.angle) * state.speed * dt,
      y: state.y + Math.sin(state.angle) * state.speed * dt,
    };
  }

  /**
   * Get all entity states at current render time
   */
  getAllStates(): Map<string, ServerEntityState> {
    const result = new Map<string, ServerEntityState>();

    const latest = this._snapshotBuffer[this._snapshotBuffer.length - 1];
    if (!latest) {
      return result;
    }

    for (const [entityId, state] of latest.snapshot.entities) {
      const interpolated = this.getInterpolatedState(entityId);
      if (interpolated) {
        result.set(entityId, interpolated);
      }
    }

    return result;
  }

  /**
   * Get local player state from server (for reconciliation)
   */
  getLocalPlayerState(): ServerEntityState | null {
    if (!this._localPlayerId) return null;

    const latest = this._snapshotBuffer[this._snapshotBuffer.length - 1];
    if (!latest) return null;

    return latest.snapshot.entities.get(this._localPlayerId) || null;
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this._snapshotBuffer.length = 0;
    this._lastSnapshot = null;
  }

  /**
   * Get buffer status
   */
  getBufferStatus(): {
    snapshotCount: number;
    oldestTimestamp: number;
    newestTimestamp: number;
    interpolationDelay: number;
  } {
    const oldest = this._snapshotBuffer[0];
    const newest = this._snapshotBuffer[this._snapshotBuffer.length - 1];

    return {
      snapshotCount: this._snapshotBuffer.length,
      oldestTimestamp: oldest?.snapshot.timestamp ?? 0,
      newestTimestamp: newest?.snapshot.timestamp ?? 0,
      interpolationDelay: this._config.interpolationDelay,
    };
  }
}

/**
 * Create a server reconciliation instance
 */
export function createServerReconciliation(config?: Partial<ReconciliationConfig>): ServerReconciliation {
  return new ServerReconciliation(config);
}
