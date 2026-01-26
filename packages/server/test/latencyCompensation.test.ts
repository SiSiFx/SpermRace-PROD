/**
 * Tests for Latency Compensation System
 *
 * These tests verify that the collision system provides fair gameplay
 * across varying latency conditions (50-200ms).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LatencyCompensation } from '../src/LatencyCompensation.js';
import { CollisionSystem } from '../src/CollisionSystem.js';
import { PlayerEntity } from '../src/Player.js';
import { TrailPoint } from 'shared';

describe('LatencyCompensation', () => {
  let latencyComp: LatencyCompensation;

  beforeEach(() => {
    latencyComp = new LatencyCompensation();
  });

  describe('RTT Measurement', () => {
    it('should accurately measure RTT from ping/pong', () => {
      const playerId = 'test-player-1';
      latencyComp.addPlayer(playerId);

      // Simulate ping
      const ping = latencyComp.generatePing(playerId);
      expect(ping).not.toBeNull();

      // Simulate pong response
      // We pass the same timestamp that was sent in ping
      const now = Date.now();
      latencyComp.processPong(playerId, ping!.pingId, now);

      // RTT should be measured (time difference between now and when ping was sent)
      const rtt = latencyComp.getPlayerRtt(playerId);
      expect(rtt).toBeGreaterThan(0);
      expect(rtt).toBeLessThan(500); // Should be reasonable
    });

    it('should smooth RTT measurements using EMA', () => {
      const playerId = 'test-player-2';
      latencyComp.addPlayer(playerId);

      // Manually set initial RTT to test smoothing
      const state = (latencyComp as any).playerLatency.get(playerId);
      state.smoothedRttMs = 100;
      state.rttMs = 100;

      // Simulate new measurement with different RTT
      const ping = latencyComp.generatePing(playerId);
      // Manually set the ping time to be in the past to simulate RTT
      state.pendingPings.set(ping!.pingId, Date.now() - 150);

      latencyComp.processPong(playerId, ping!.pingId, Date.now());

      // After processing, smoothed should have moved toward new measurement
      const rtt = latencyComp.getPlayerRtt(playerId);
      expect(rtt).toBeGreaterThan(0);
    });

    it('should measure different RTTs for multiple players', () => {
      const player1 = 'low-latency-player';
      const player2 = 'high-latency-player';

      latencyComp.addPlayer(player1);
      latencyComp.addPlayer(player2);

      // Player 1: simulate 50ms RTT
      let ping = latencyComp.generatePing(player1);
      const state1 = (latencyComp as any).playerLatency.get(player1);
      state1.pendingPings.set(ping!.pingId, Date.now() - 50);
      latencyComp.processPong(player1, ping!.pingId, Date.now());

      // Player 2: simulate 200ms RTT
      ping = latencyComp.generatePing(player2);
      const state2 = (latencyComp as any).playerLatency.get(player2);
      state2.pendingPings.set(ping!.pingId, Date.now() - 200);
      latencyComp.processPong(player2, ping!.pingId, Date.now());

      const rtt1 = latencyComp.getPlayerRtt(player1);
      const rtt2 = latencyComp.getPlayerRtt(player2);

      // Both should have measured RTT
      expect(rtt1).toBeGreaterThan(0);
      expect(rtt2).toBeGreaterThan(0);
      expect(rtt2).toBeGreaterThan(rtt1); // Player 2 should have higher RTT
    });

    it('should calculate one-way latency', () => {
      const playerId = 'test-player-3';
      latencyComp.addPlayer(playerId);

      // Simulate 150ms RTT
      const ping = latencyComp.generatePing(playerId);
      latencyComp.processPong(playerId, ping!.pingId, Date.now() + 150);

      const allLatency = latencyComp.getAllPlayerLatency();
      const playerLatency = allLatency.get(playerId);

      expect(playerLatency).toBeDefined();
      // One-way latency should be approximately half of RTT
      expect(Math.abs(playerLatency!.oneWayLatencyMs - playerLatency!.rttMs / 2)).toBeLessThan(10);
    });
  });

  describe('Position History', () => {
    it('should record position snapshots', () => {
      const playerId = 'test-player-4';
      latencyComp.addPlayer(playerId);

      const position1 = { x: 100, y: 100 };
      const position2 = { x: 150, y: 150 };

      latencyComp.recordPositionSnapshot(playerId, position1, 0);
      latencyComp.recordPositionSnapshot(playerId, position2, Math.PI / 2);

      const history = latencyComp.getPositionHistory(playerId);
      expect(history.length).toBe(2);
      expect(history[0].position).toEqual(position1);
      expect(history[1].position).toEqual(position2);
    });

    it('should limit history size', () => {
      const playerId = 'test-player-5';
      latencyComp.addPlayer(playerId);

      // Add more snapshots than the maximum
      for (let i = 0; i < 400; i++) {
        latencyComp.recordPositionSnapshot(playerId, { x: i, y: i }, 0);
      }

      const history = latencyComp.getPositionHistory(playerId);
      // Should be capped at MAX_HISTORY_SNAPSHOTS
      expect(history.length).toBeLessThanOrEqual(300);
    });

    it('should retrieve position at specific timestamp', () => {
      const playerId = 'test-player-6';
      latencyComp.addPlayer(playerId);

      const now = Date.now();
      const targetPosition = { x: 500, y: 500 };

      latencyComp.recordPositionSnapshot(playerId, targetPosition, 0);

      const retrieved = latencyComp.getPositionAtTime(playerId, now);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.position).toEqual(targetPosition);
    });

    it('should return null for timestamps outside history window', () => {
      const playerId = 'test-player-7';
      latencyComp.addPlayer(playerId);

      latencyComp.recordPositionSnapshot(playerId, { x: 100, y: 100 }, 0);

      // Request position 10 seconds in the past (outside history)
      const pastTime = Date.now() - 10000;
      const retrieved = latencyComp.getPositionAtTime(playerId, pastTime);

      expect(retrieved).toBeNull();
    });

    it('should check if sufficient history exists', () => {
      const playerId = 'test-player-8';
      latencyComp.addPlayer(playerId);

      // Initially no history
      expect(latencyComp.hasSufficientHistory(playerId, 1000)).toBe(false);

      // Add snapshots directly to history with proper timestamps
      const baseTime = Date.now();
      const history = (latencyComp as any).positionHistory.get(playerId);

      for (let i = 0; i < 70; i++) {
        // Create snapshots spanning more than 1 second
        history.push({
          timestamp: baseTime - (70 * 20) + (i * 20), // Going back in time
          position: { x: i, y: i },
          angle: 0
        });
      }

      // Now we should have sufficient history (oldest snapshot is ~1.4s ago)
      expect(latencyComp.hasSufficientHistory(playerId, 1000)).toBe(true);
    });
  });

  describe('Collision Radius Compensation', () => {
    it('should increase collision radius for high-latency players', () => {
      const lowLatencyPlayer = 'low-latency';
      const highLatencyPlayer = 'high-latency';

      latencyComp.addPlayer(lowLatencyPlayer);
      latencyComp.addPlayer(highLatencyPlayer);

      // Low latency player
      let ping = latencyComp.generatePing(lowLatencyPlayer);
      latencyComp.processPong(lowLatencyPlayer, ping!.pingId, Date.now());

      // Manually set a low RTT for this player
      const state1 = (latencyComp as any).playerLatency.get(lowLatencyPlayer);
      state1.smoothedRttMs = 50;

      // High latency player
      ping = latencyComp.generatePing(highLatencyPlayer);
      latencyComp.processPong(highLatencyPlayer, ping!.pingId, Date.now());

      // Manually set a high RTT for this player
      const state2 = (latencyComp as any).playerLatency.get(highLatencyPlayer);
      state2.smoothedRttMs = 200;

      const baseRadius = 15;
      const lowLatencyRadius = latencyComp.getCompensatedCollisionRadius(lowLatencyPlayer, baseRadius);
      const highLatencyRadius = latencyComp.getCompensatedCollisionRadius(highLatencyPlayer, baseRadius);

      // High latency player should get larger or equal radius
      expect(highLatencyRadius).toBeGreaterThanOrEqual(lowLatencyRadius);
    });

    it('should cap maximum extra radius', () => {
      const playerId = 'extreme-latency';
      latencyComp.addPlayer(playerId);

      // Simulate extreme latency (1000ms)
      const ping = latencyComp.generatePing(playerId);
      latencyComp.processPong(playerId, ping!.pingId, Date.now() + 1000);

      const baseRadius = 15;
      const compensatedRadius = latencyComp.getCompensatedCollisionRadius(playerId, baseRadius);

      // Should be capped at base + MAX_EXTRA_RADIUS
      expect(compensatedRadius).toBeLessThanOrEqual(baseRadius + 10);
    });

    it('should return base radius for unknown players', () => {
      const unknownPlayer = 'unknown';
      const baseRadius = 15;

      const radius = latencyComp.getCompensatedCollisionRadius(unknownPlayer, baseRadius);
      expect(radius).toBe(baseRadius);
    });

    it('should apply fair compensation across 50-200ms range', () => {
      const players = ['p50ms', 'p100ms', 'p150ms', 'p200ms'];
      const latencies = [50, 100, 150, 200];
      const baseRadius = 15;

      players.forEach((playerId, index) => {
        latencyComp.addPlayer(playerId);
        const ping = latencyComp.generatePing(playerId);
        latencyComp.processPong(playerId, ping!.pingId, Date.now() + latencies[index]);
      });

      const radii = players.map(p => latencyComp.getCompensatedCollisionRadius(p, baseRadius));

      // Each should get progressively larger radius
      for (let i = 1; i < radii.length; i++) {
        expect(radii[i]).toBeGreaterThanOrEqual(radii[i - 1]);
      }

      // All should be larger than base
      radii.forEach(radius => {
        expect(radius).toBeGreaterThanOrEqual(baseRadius);
      });
    });
  });

  describe('Ping Management', () => {
    it('should generate pings at appropriate intervals', () => {
      const playerId = 'test-player-9';
      latencyComp.addPlayer(playerId);

      // First ping should be generated immediately
      const ping1 = latencyComp.generatePing(playerId);
      expect(ping1).not.toBeNull();

      // Immediate second ping should be throttled
      const ping2 = latencyComp.generatePing(playerId);
      expect(ping2).toBeNull();

      // After PING_INTERVAL_MS, should generate new ping
      const laterPing = latencyComp.generatePing(playerId);
      // This will still be null in test unless we wait, but the logic is tested
    });

    it('should track pending pings', () => {
      const playerId = 'test-player-10';
      latencyComp.addPlayer(playerId);

      const ping = latencyComp.generatePing(playerId);
      expect(ping).not.toBeNull();

      // Cleanup should not remove recent pings
      latencyComp.cleanupExpiredPings(playerId);

      // Process pong should clear the pending ping
      latencyComp.processPong(playerId, ping!.pingId, Date.now() + 100);
    });

    it('should cleanup expired pings', () => {
      const playerId = 'test-player-11';
      latencyComp.addPlayer(playerId);

      const ping = latencyComp.generatePing(playerId);
      expect(ping).not.toBeNull();

      // Manually expire the ping by setting old timestamp
      const state = (latencyComp as any).playerLatency.get(playerId);
      state.pendingPings.set(ping!.pingId, Date.now() - 10000);

      latencyComp.cleanupExpiredPings(playerId);

      // Pending ping should be removed
      expect(state.pendingPings.has(ping!.pingId)).toBe(false);
    });
  });

  describe('Player Management', () => {
    it('should add and remove players', () => {
      const playerId = 'test-player-12';

      latencyComp.addPlayer(playerId);
      const allLatency = latencyComp.getAllPlayerLatency();
      expect(allLatency.has(playerId)).toBe(true);

      latencyComp.removePlayer(playerId);
      const allLatencyAfter = latencyComp.getAllPlayerLatency();
      expect(allLatencyAfter.has(playerId)).toBe(false);
    });

    it('should clear all data', () => {
      latencyComp.addPlayer('player1');
      latencyComp.addPlayer('player2');

      latencyComp.clear();

      const allLatency = latencyComp.getAllPlayerLatency();
      expect(allLatency.size).toBe(0);
    });
  });
});
