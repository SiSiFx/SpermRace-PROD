import { Player, TrailPoint } from 'shared';

/**
 * Lightweight snapshot of player state for lag compensation.
 * Stores minimal data to keep memory usage under 50MB.
 */
export interface PlayerSnapshot {
  id: string;
  x: number;          // Float32 (4 bytes) - using number for JS compatibility
  y: number;          // Float32 (4 bytes)
  angle: number;      // Float32 (4 bytes)
  timestamp: number;  // Timestamp for interpolation (8 bytes)
}

/**
 * Minimal game state snapshot for history buffer.
 * Only stores player positions needed for collision rewinding.
 */
export interface GameSnapshot {
  timestamp: number;
  players: PlayerSnapshot[];
}

/**
 * Memory-efficient circular buffer for game state history.
 * Designed for lag compensation with <50MB memory usage.
 *
 * Memory calculation:
 * - 200ms history @ 66 ticks/sec = ~13 snapshots
 * - 32 players × 13 snapshots × 20 bytes/player ≈ 8.3 KB
 * - Well under 50MB limit
 */
export class StateHistory {
  private buffer: GameSnapshot[] = [];
  private maxLength: number;
  private historyDurationMs: number;
  private tickIntervalMs: number;

  /**
   * @param historyDurationMs How far back to keep history (default: 200ms for lag compensation)
   * @param tickIntervalMs Server tick interval in ms
   */
  constructor(historyDurationMs: number = 200, tickIntervalMs: number = 15) {
    this.historyDurationMs = historyDurationMs;
    this.tickIntervalMs = tickIntervalMs;
    // Calculate buffer size with small safety margin
    this.maxLength = Math.ceil(historyDurationMs / tickIntervalMs) + 5;
  }

  /**
   * Add a new snapshot to the history buffer.
   * Automatically removes old snapshots outside the history window.
   */
  addSnapshot(players: Map<string, any>): void {
    const now = Date.now();

    // Create minimal snapshot with only essential data
    const playerSnapshots: PlayerSnapshot[] = [];
    for (const [id, player] of players.entries()) {
      if (!player.isAlive) continue; // Skip dead players to save memory

      playerSnapshots.push({
        id,
        x: player.sperm.position.x,
        y: player.sperm.position.y,
        angle: player.sperm.angle,
        timestamp: now,
      });
    }

    const snapshot: GameSnapshot = {
      timestamp: now,
      players: playerSnapshots,
    };

    this.buffer.push(snapshot);

    // Remove old snapshots outside history window
    this.cleanup(now);
  }

  /**
   * Find the snapshot closest to a given timestamp.
   * Returns null if no snapshot exists for that time.
   */
  findSnapshot(targetTime: number): GameSnapshot | null {
    if (this.buffer.length === 0) return null;

    // Binary search for closest snapshot
    let left = 0;
    let right = this.buffer.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.buffer[mid].timestamp < targetTime) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Return closest snapshot (either left or left-1)
    const closest = this.buffer[left];
    const prev = this.buffer[left - 1];

    if (!prev) return closest;
    if (!closest) return prev;

    // Return whichever is closer in time
    return Math.abs(closest.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime)
      ? closest
      : prev;
  }

  /**
   * Get two snapshots surrounding a target time for interpolation.
   * Returns [before, after] or null if not enough data.
   */
  getSnapshotsForInterpolation(targetTime: number): [GameSnapshot | null, GameSnapshot | null] {
    if (this.buffer.length === 0) return [null, null];

    let before: GameSnapshot | null = null;
    let after: GameSnapshot | null = null;

    for (const snapshot of this.buffer) {
      if (snapshot.timestamp <= targetTime) {
        before = snapshot;
      } else {
        after = snapshot;
        break;
      }
    }

    return [before, after];
  }

  /**
   * Get player position at a specific point in time.
   * Uses interpolation between snapshots for accuracy.
   */
  getPlayerStateAt(playerId: string, targetTime: number): PlayerSnapshot | null {
    const [before, after] = this.getSnapshotsForInterpolation(targetTime);

    if (!before && !after) return null;
    if (!before) return after?.players.find(p => p.id === playerId) || null;
    if (!after) return before.players.find(p => p.id === playerId) || null;

    // Find player in both snapshots
    const playerBefore = before.players.find(p => p.id === playerId);
    const playerAfter = after.players.find(p => p.id === playerId);

    if (!playerBefore && !playerAfter) return null;
    if (!playerBefore) return playerAfter || null;
    if (!playerAfter) return playerBefore;

    // Interpolate between snapshots
    const timeDiff = after.timestamp - before.timestamp;
    const targetDiff = targetTime - before.timestamp;
    const t = timeDiff > 0 ? targetDiff / timeDiff : 0;

    return {
      id: playerId,
      x: playerBefore.x + (playerAfter.x - playerBefore.x) * t,
      y: playerBefore.y + (playerAfter.y - playerBefore.y) * t,
      angle: this.lerpAngle(playerBefore.angle, playerAfter.angle, t),
      timestamp: targetTime,
    };
  }

  /**
   * Clear all history (e.g., on round end).
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Remove snapshots older than history duration.
   */
  private cleanup(now: number): void {
    const cutoffTime = now - this.historyDurationMs;

    // Remove old snapshots from front of buffer
    while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoffTime) {
      this.buffer.shift();
    }

    // Safety check: prevent unlimited growth
    if (this.buffer.length > this.maxLength) {
      this.buffer.splice(0, this.buffer.length - this.maxLength);
    }
  }

  /**
   * Linear interpolation for angles with proper wrapping.
   */
  private lerpAngle(from: number, to: number, t: number): number {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * t;
  }

  /**
   * Get current memory usage estimate in bytes.
   * Useful for monitoring and debugging.
   */
  getMemoryUsage(): number {
    let total = 0;

    for (const snapshot of this.buffer) {
      // Estimate: 20 bytes per player snapshot + object overhead
      total += snapshot.players.length * 24;
      total += 16; // timestamp + object overhead for snapshot
    }

    return total;
  }

  /**
   * Get buffer statistics for monitoring.
   */
  getStats(): { snapshotCount: number; memoryUsageBytes: number; memoryUsageKB: number } {
    const bytes = this.getMemoryUsage();
    return {
      snapshotCount: this.buffer.length,
      memoryUsageBytes: bytes,
      memoryUsageKB: Math.round(bytes / 1024 * 100) / 100,
    };
  }
}
