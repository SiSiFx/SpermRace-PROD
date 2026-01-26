/**
 * Latency Compensation System for Fair Collisions
 *
 * This system implements:
 * 1. RTT (Round Trip Time) measurement and tracking
 * 2. Latency-based collision fairness adjustments
 * 3. Position history for rollback validation
 * 4. Ping/pong protocol for accurate latency measurement
 */

import { Vector2 } from 'shared';

// =================================================================================================
// TYPES
// =================================================================================================

export interface PlayerLatencyState {
  playerId: string;
  // Measured RTT in milliseconds
  rttMs: number;
  // Smoothed RTT (exponential moving average) for stability
  smoothedRttMs: number;
  // One-way latency approximation (RTT / 2)
  oneWayLatencyMs: number;
  // Jitter (variance in latency)
  jitterMs: number;
  // Timestamp of last measurement
  lastMeasuredAt: number;
  // Timestamp of last ping sent
  lastPingAt: number;
  // Pending ping measurements (pingId -> timestamp)
  pendingPings: Map<number, number>;
}

export interface PositionSnapshot {
  timestamp: number;
  position: Vector2;
  angle: number;
}

// =================================================================================================
// CONSTANTS
// =================================================================================================

const PING_INTERVAL_MS = 500; // Send pings every 500ms
const PING_TIMEOUT_MS = 5000; // Pings older than 5s are discarded
const RTT_SMOOTHING_FACTOR = 0.3; // EMA smoothing factor (lower = smoother)
const JITTER_SMOOTHING_FACTOR = 0.2; // Jitter changes more slowly
const MAX_REASONABLE_RTT_MS = 1000; // Cap RTT at 1 second for sanity
const MIN_HISTORY_SNAPSHOTS = 60; // Keep 1 second of history at 60fps
const MAX_HISTORY_SNAPSHOTS = 300; // Keep 5 seconds of history max

// Latency-based collision fairness adjustments
const BASE_COLLISION_RADIUS = 15; // Base collision radius (8 sperm + 7 trail)
const LATENCY_TOLERANCE_MS = 50; // Extra tolerance per 100ms of latency
const MAX_EXTRA_RADIUS = 10; // Maximum extra radius to add for high latency

// =================================================================================================
// LATENCY COMPENSATION CLASS
// =================================================================================================

export class LatencyCompensation {
  private playerLatency: Map<string, PlayerLatencyState> = new Map();
  private positionHistory: Map<string, PositionSnapshot[]> = new Map();
  private nextPingId: number = 0;

  /**
   * Initialize latency tracking for a new player
   */
  addPlayer(playerId: string): void {
    this.playerLatency.set(playerId, {
      playerId,
      rttMs: 0,
      smoothedRttMs: 0,
      oneWayLatencyMs: 0,
      jitterMs: 0,
      lastMeasuredAt: Date.now(),
      lastPingAt: 0,
      pendingPings: new Map(),
    });
    this.positionHistory.set(playerId, []);
  }

  /**
   * Remove a player from latency tracking
   */
  removePlayer(playerId: string): void {
    this.playerLatency.delete(playerId);
    this.positionHistory.delete(playerId);
  }

  /**
   * Record a position snapshot for a player (called every tick)
   */
  recordPositionSnapshot(playerId: string, position: Vector2, angle: number): void {
    const history = this.positionHistory.get(playerId);
    if (!history) return;

    const now = Date.now();
    history.push({
      timestamp: now,
      position: { ...position },
      angle,
    });

    // Keep history bounded
    if (history.length > MAX_HISTORY_SNAPSHOTS) {
      history.shift();
    }
  }

  /**
   * Generate a ping message for a player
   */
  generatePing(playerId: string): { pingId: number; timestamp: number } | null {
    const state = this.playerLatency.get(playerId);
    if (!state) return null;

    const now = Date.now();
    if (now - state.lastPingAt < PING_INTERVAL_MS) {
      return null; // Too soon to send another ping
    }

    const pingId = this.nextPingId++;
    state.lastPingAt = now;
    state.pendingPings.set(pingId, now);

    return { pingId, timestamp: now };
  }

  /**
   * Process a pong response from a client
   */
  processPong(playerId: string, pingId: number, clientTimestamp: number): void {
    const state = this.playerLatency.get(playerId);
    if (!state) return;

    const pingSentAt = state.pendingPings.get(pingId);
    if (pingSentAt === undefined) {
      // Unknown ping (might have timed out)
      return;
    }

    // Remove from pending
    state.pendingPings.delete(pingId);

    const now = Date.now();
    const rttMs = now - pingSentAt;

    // Sanity check
    if (rttMs < 0 || rttMs > MAX_REASONABLE_RTT_MS) {
      return;
    }

    // Update RTT measurement
    state.rttMs = rttMs;

    // Update smoothed RTT (exponential moving average)
    if (state.smoothedRttMs === 0) {
      state.smoothedRttMs = rttMs;
    } else {
      state.smoothedRttMs = (1 - RTT_SMOOTHING_FACTOR) * state.smoothedRttMs + RTT_SMOOTHING_FACTOR * rttMs;
    }

    // Update one-way latency approximation
    state.oneWayLatencyMs = state.smoothedRttMs / 2;

    // Update jitter (RTT variance)
    const jitter = Math.abs(rttMs - state.smoothedRttMs);
    if (state.jitterMs === 0) {
      state.jitterMs = jitter;
    } else {
      state.jitterMs = (1 - JITTER_SMOOTHING_FACTOR) * state.jitterMs + JITTER_SMOOTHING_FACTOR * jitter;
    }

    state.lastMeasuredAt = now;
  }

  /**
   * Clean up timed-out pings for a player
   */
  cleanupExpiredPings(playerId: string): void {
    const state = this.playerLatency.get(playerId);
    if (!state) return;

    const now = Date.now();
    for (const [pingId, sentAt] of state.pendingPings.entries()) {
      if (now - sentAt > PING_TIMEOUT_MS) {
        state.pendingPings.delete(pingId);
      }
    }
  }

  /**
   * Get the current RTT for a player
   */
  getPlayerRtt(playerId: string): number {
    const state = this.playerLatency.get(playerId);
    return state?.smoothedRttMs || 0;
  }

  /**
   * Get all players that need pings this tick
   */
  getPlayersNeedingPings(): string[] {
    const now = Date.now();
    const needPings: string[] = [];

    for (const [playerId, state] of this.playerLatency.entries()) {
      if (now - state.lastPingAt >= PING_INTERVAL_MS) {
        needPings.push(playerId);
      }
    }

    return needPings;
  }

  /**
   * Calculate latency-compensated collision radius
   * Higher latency players get slightly larger collision radius to compensate
   * for their disadvantage in seeing enemy positions
   */
  getCompensatedCollisionRadius(playerId: string, baseRadius: number = BASE_COLLISION_RADIUS): number {
    const state = this.playerLatency.get(playerId);
    if (!state || state.smoothedRttMs === 0) {
      return baseRadius;
    }

    // Add tolerance based on latency (per 100ms of RTT)
    const latencyFactor = state.smoothedRttMs / 100;
    const extraRadius = Math.min(MAX_EXTRA_RADIUS, latencyFactor * (LATENCY_TOLERANCE_MS / 100));

    return baseRadius + extraRadius;
  }

  /**
   * Get position history for a player (for rollback/validation)
   */
  getPositionHistory(playerId: string): PositionSnapshot[] {
    return this.positionHistory.get(playerId) || [];
  }

  /**
   * Get player position at a specific timestamp in the past
   * Returns null if the timestamp is outside our history window
   */
  getPositionAtTime(playerId: string, timestamp: number): PositionSnapshot | null {
    const history = this.positionHistory.get(playerId);
    if (!history || history.length === 0) {
      return null;
    }

    // Find the snapshot closest to the requested timestamp
    let closest: PositionSnapshot | null = null;
    let minDiff = Infinity;

    for (const snapshot of history) {
      const diff = Math.abs(snapshot.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = snapshot;
      }
    }

    // Only return if we're within 100ms of the requested time
    if (minDiff <= 100 && closest) {
      return closest;
    }

    return null;
  }

  /**
   * Check if we have sufficient history for rollback validation
   */
  hasSufficientHistory(playerId: string, requiredMs: number): boolean {
    const history = this.positionHistory.get(playerId);
    if (!history || history.length < MIN_HISTORY_SNAPSHOTS) {
      return false;
    }

    const now = Date.now();
    const oldestSnapshot = history[0];
    const historyDuration = now - oldestSnapshot.timestamp;

    return historyDuration >= requiredMs;
  }

  /**
   * Get latency statistics for all players (for monitoring/debugging)
   */
  getAllPlayerLatency(): Map<string, { rttMs: number; oneWayLatencyMs: number; jitterMs: number }> {
    const result = new Map();

    for (const [playerId, state] of this.playerLatency.entries()) {
      result.set(playerId, {
        rttMs: Math.round(state.smoothedRttMs),
        oneWayLatencyMs: Math.round(state.oneWayLatencyMs),
        jitterMs: Math.round(state.jitterMs),
      });
    }

    return result;
  }

  /**
   * Clear all latency data (for round reset)
   */
  clear(): void {
    this.playerLatency.clear();
    this.positionHistory.clear();
    this.nextPingId = 0;
  }
}
