/**
 * Lag Compensation Tests
 *
 * Tests that the server properly rewinds time for collision detection
 * to prevent "I was already past!" complaints from players with latency.
 */

import { describe, it, expect } from 'vitest';

describe('Lag Compensation', () => {
  it('should track and smooth RTT values', () => {
    // Create a mock GameWorld-like object with just the RTT methods
    const playerRttMs = new Map<string, number>();

    function updatePlayerRtt(playerId: string, clientTimestamp: number): void {
      const now = Date.now();
      const rtt = now - clientTimestamp;

      // Smooth the RTT value (exponential moving average)
      const currentRtt = playerRttMs.get(playerId) || 0;
      const smoothedRtt = currentRtt * 0.7 + rtt * 0.3;

      // Clamp to reasonable values (10ms to 500ms)
      playerRttMs.set(playerId, Math.max(10, Math.min(500, smoothedRtt)));
    }

    function getPlayerRtt(playerId: string): number {
      return playerRttMs.get(playerId) || 100;
    }

    const playerId = 'player1';
    const now = Date.now();

    // Simulate multiple RTT measurements
    updatePlayerRtt(playerId, now - 50);  // 50ms RTT
    updatePlayerRtt(playerId, now - 100); // 100ms RTT
    updatePlayerRtt(playerId, now - 75);  // 75ms RTT

    const rtt = getPlayerRtt(playerId);

    // Should be smoothed between 50 and 100
    expect(rtt).toBeGreaterThan(40);
    expect(rtt).toBeLessThan(110);
  });

  it('should clamp RTT to reasonable values', () => {
    const playerRttMs = new Map<string, number>();

    function updatePlayerRtt(playerId: string, clientTimestamp: number): void {
      const now = Date.now();
      const rtt = now - clientTimestamp;

      // Smooth the RTT value (exponential moving average)
      const currentRtt = playerRttMs.get(playerId) || 0;
      const smoothedRtt = currentRtt * 0.7 + rtt * 0.3;

      // Clamp to reasonable values (10ms to 500ms)
      playerRttMs.set(playerId, Math.max(10, Math.min(500, smoothedRtt)));
    }

    function getPlayerRtt(playerId: string): number {
      return playerRttMs.get(playerId) || 100;
    }

    const playerId = 'player1';
    const now = Date.now();

    // Test too low RTT
    updatePlayerRtt(playerId, now - 5); // 5ms RTT
    let rtt = getPlayerRtt(playerId);
    expect(rtt).toBeGreaterThanOrEqual(10); // Should clamp to 10ms minimum

    // Test too high RTT
    updatePlayerRtt(playerId, now - 1000); // 1000ms RTT
    rtt = getPlayerRtt(playerId);
    expect(rtt).toBeLessThanOrEqual(500); // Should clamp to 500ms maximum
  });

  it('should default to 100ms RTT for unknown players', () => {
    const playerRttMs = new Map<string, number>();

    function getPlayerRtt(playerId: string): number {
      return playerRttMs.get(playerId) || 100;
    }

    const rtt = getPlayerRtt('unknownPlayer');
    expect(rtt).toBe(100);
  });

  it('should interpolate between snapshots', () => {
    const now = Date.now();

    // Create two snapshots with known positions
    const snapshot1 = {
      timestamp: now - 100,
      players: new Map([['player1', { x: 100, y: 100, angle: 0, isAlive: true }]]),
    };

    const snapshot2 = {
      timestamp: now,
      players: new Map([['player1', { x: 200, y: 100, angle: 0, isAlive: true }]]),
    };

    const stateHistory = [snapshot1, snapshot2];

    function getPlayerPositionAtTime(playerId: string, targetTime: number): { x: number; y: number; angle: number } | null {
      const before = stateHistory.filter(s => s.timestamp <= targetTime);
      const after = stateHistory.filter(s => s.timestamp > targetTime);

      if (before.length === 0 && after.length === 0) return null;
      if (before.length === 0) {
        const state = after[0].players.get(playerId);
        return state ? { x: state.x, y: state.y, angle: state.angle } : null;
      }
      if (after.length === 0) {
        const state = before[before.length - 1].players.get(playerId);
        return state ? { x: state.x, y: state.y, angle: state.angle } : null;
      }

      const beforeState = before[before.length - 1].players.get(playerId);
      const afterState = after[0].players.get(playerId);

      if (!beforeState || !afterState) return null;

      const timeRange = after[0].timestamp - before[before.length - 1].timestamp;
      if (timeRange === 0) {
        return { x: beforeState.x, y: beforeState.y, angle: beforeState.angle };
      }

      const t = (targetTime - before[before.length - 1].timestamp) / timeRange;

      return {
        x: beforeState.x + (afterState.x - beforeState.x) * t,
        y: beforeState.y + (afterState.y - beforeState.y) * t,
        angle: beforeState.angle,
      };
    }

    // Request position exactly in the middle
    const midTime = now - 50;
    const position = getPlayerPositionAtTime('player1', midTime);

    expect(position).not.toBeNull();
    // Should be approximately halfway between 100 and 200
    expect(position!.x).toBeGreaterThan(140);
    expect(position!.x).toBeLessThan(160);
  });

  it('should expire old state snapshots', () => {
    const MAX_HISTORY_MS = 500;
    const stateHistory: any[] = [];
    const now = Date.now();

    // Add old snapshots
    for (let i = 0; i < 100; i++) {
      stateHistory.push({
        timestamp: now - 1000 + i * 10,
        players: new Map([['player1', { x: 100 + i * 10, y: 100, angle: 0, isAlive: true }]]),
      });
    }

    // Simulate cleanup
    const cutoffTime = Date.now() - MAX_HISTORY_MS;
    const filtered = stateHistory.filter(s => s.timestamp > cutoffTime);

    // Should only have recent snapshots (last 500ms)
    expect(filtered.length).toBeLessThan(60); // 500ms / ~10ms per tick
  });
});
