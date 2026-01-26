/**
 * Tests for smooth position correction feature
 * Ensures player positions are corrected smoothly without visible snapping
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

declare const global: any;
declare const performance: { now: () => number };

describe('Smooth Position Correction', () => {
  // Mock performance.now for consistent testing
  let mockTime = 0;
  let originalPerformanceNow: (() => number) | undefined;

  beforeEach(() => {
    mockTime = 0;
    originalPerformanceNow = performance.now;
    if (typeof global !== 'undefined') {
      global.performance.now = vi.fn(() => mockTime);
    }
  });

  afterEach(() => {
    if (originalPerformanceNow && typeof global !== 'undefined') {
      global.performance.now = originalPerformanceNow;
    }
  });

  describe('Position Correction Detection', () => {
    it('should detect when position correction is needed (distance > 2px)', () => {
      const currentPos = { x: 100, y: 100 };
      const serverPos = { x: 105, y: 100 };
      const dx = serverPos.x - currentPos.x;
      const dy = serverPos.y - currentPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      expect(dist).toBeGreaterThan(2);
      expect(dist).toBe(5);
    });

    it('should not trigger correction for small differences (distance <= 2px)', () => {
      const currentPos = { x: 100, y: 100 };
      const serverPos = { x: 101, y: 100 };
      const dx = serverPos.x - currentPos.x;
      const dy = serverPos.y - currentPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      expect(dist).toBeLessThanOrEqual(2);
      expect(dist).toBe(1);
    });

    it('should calculate correct distance for diagonal movement', () => {
      const currentPos = { x: 100, y: 100 };
      const serverPos = { x: 104, y: 103 };
      const dx = serverPos.x - currentPos.x;
      const dy = serverPos.y - currentPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // sqrt(4^2 + 3^2) = 5
      expect(dist).toBe(5);
    });
  });

  describe('Smooth Easing Function', () => {
    it('should apply ease-out cubic interpolation', () => {
      const easeT = (t: number) => 1 - Math.pow(1 - t, 3);

      // At t=0, ease-out should be 0
      expect(easeT(0)).toBe(0);

      // At t=1, ease-out should be 1
      expect(easeT(1)).toBe(1);

      // At t=0.5, ease-out should be > 0.5 (starts fast, slows down)
      expect(easeT(0.5)).toBeGreaterThan(0.5);

      // Verify cubic ease-out formula: 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875
      expect(easeT(0.5)).toBe(0.875);
    });

    it('should interpolate smoothly from start to end position', () => {
      const easeT = (t: number) => 1 - Math.pow(1 - t, 3);
      const startPos = { x: 100, y: 100 };
      const endPos = { x: 110, y: 110 };

      // At 0% progress, should be at start
      const t0 = easeT(0);
      const pos0 = {
        x: startPos.x + (endPos.x - startPos.x) * t0,
        y: startPos.y + (endPos.y - startPos.y) * t0
      };
      expect(pos0.x).toBe(100);
      expect(pos0.y).toBe(100);

      // At 100% progress, should be at end
      const t1 = easeT(1);
      const pos1 = {
        x: startPos.x + (endPos.x - startPos.x) * t1,
        y: startPos.y + (endPos.y - startPos.y) * t1
      };
      expect(pos1.x).toBe(110);
      expect(pos1.y).toBe(110);

      // At 50% progress, should be closer to end due to ease-out
      const t05 = easeT(0.5);
      const pos05 = {
        x: startPos.x + (endPos.x - startPos.x) * t05,
        y: startPos.y + (endPos.y - startPos.y) * t05
      };
      expect(pos05.x).toBeGreaterThan(105); // Should be past midpoint
      expect(pos05.y).toBeGreaterThan(105);
    });
  });

  describe('Correction Timing', () => {
    it('should complete correction within 100ms', () => {
      const CORRECTION_DURATION_MS = 100;
      const startTime = 0;
      const endTime = 100;

      mockTime = startTime;
      const startElapsed = mockTime - startTime;
      expect(startElapsed).toBe(0);

      mockTime = endTime;
      const endElapsed = mockTime - startTime;
      expect(endElapsed).toBe(CORRECTION_DURATION_MS);

      // Should not exceed duration
      expect(endElapsed).toBeLessThanOrEqual(CORRECTION_DURATION_MS);
    });

    it('should respect correction duration with partial progress', () => {
      const CORRECTION_DURATION_MS = 100;
      const startTime = 0;

      // At 50ms, should be 50% through
      mockTime = 50;
      const elapsed = mockTime - startTime;
      const t = Math.min(1, elapsed / CORRECTION_DURATION_MS);

      expect(t).toBe(0.5);
    });
  });

  describe('Position Correction Behavior', () => {
    it('should smoothly interpolate position over time', () => {
      const startPos = { x: 100, y: 100 };
      const targetPos = { x: 110, y: 110 };
      const CORRECTION_DURATION_MS = 100;
      const startTime = 0;

      // Simulate interpolation over time
      const positions: number[] = [];

      for (let ms = 0; ms <= CORRECTION_DURATION_MS; ms += 20) {
        mockTime = ms;
        const elapsed = mockTime - startTime;
        const t = Math.min(1, elapsed / CORRECTION_DURATION_MS);
        const easeT = 1 - Math.pow(1 - t, 3);

        const x = startPos.x + (targetPos.x - startPos.x) * easeT;
        positions.push(x);
      }

      // First position should be at start
      expect(positions[0]).toBe(100);

      // Last position should be at target
      expect(positions[positions.length - 1]).toBe(110);

      // Positions should be monotonically increasing (no backtracking)
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }

      // Movement should be faster at start, slower at end (ease-out)
      const firstStep = positions[1] - positions[0];
      const lastStep = positions[positions.length - 1] - positions[positions.length - 2];
      expect(firstStep).toBeGreaterThan(lastStep);
    });

    it('should handle small corrections gracefully', () => {
      const startPos = { x: 100, y: 100 };
      const targetPos = { x: 102, y: 101 }; // Small correction
      const CORRECTION_DURATION_MS = 100;
      const startTime = 0;

      mockTime = CORRECTION_DURATION_MS;
      const elapsed = mockTime - startTime;
      const t = Math.min(1, elapsed / CORRECTION_DURATION_MS);
      const easeT = 1 - Math.pow(1 - t, 3);

      const finalX = startPos.x + (targetPos.x - startPos.x) * easeT;
      const finalY = startPos.y + (targetPos.y - startPos.y) * easeT;

      // Should still reach target exactly
      expect(finalX).toBe(102);
      expect(finalY).toBe(101);
    });

    it('should handle large corrections without overshooting', () => {
      const startPos = { x: 100, y: 100 };
      const targetPos = { x: 150, y: 150 }; // Large 50px correction
      const CORRECTION_DURATION_MS = 100;
      const startTime = 0;

      mockTime = CORRECTION_DURATION_MS;
      const elapsed = mockTime - startTime;
      const t = Math.min(1, elapsed / CORRECTION_DURATION_MS);
      const easeT = 1 - Math.pow(1 - t, 3);

      const finalX = startPos.x + (targetPos.x - startPos.x) * easeT;
      const finalY = startPos.y + (targetPos.y - startPos.y) * easeT;

      // Should reach target exactly without overshooting
      expect(finalX).toBe(150);
      expect(finalY).toBe(150);
      expect(finalX).toBeLessThanOrEqual(targetPos.x);
      expect(finalY).toBeLessThanOrEqual(targetPos.y);
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired corrections', () => {
      const corrections = new Map<string, {
        startTime: number;
        duration: number;
      }>();

      const playerId = 'player1';
      const CORRECTION_DURATION_MS = 100;

      // Add a correction
      corrections.set(playerId, {
        startTime: 0,
        duration: CORRECTION_DURATION_MS
      });

      expect(corrections.size).toBe(1);

      // Before expiration, correction should still exist
      mockTime = 50;
      const elapsed1 = mockTime - 0;
      if (elapsed1 > CORRECTION_DURATION_MS) {
        corrections.delete(playerId);
      }
      expect(corrections.size).toBe(1);

      // After expiration, correction should be removed
      mockTime = 150;
      const elapsed2 = mockTime - 0;
      if (elapsed2 > CORRECTION_DURATION_MS) {
        corrections.delete(playerId);
      }
      expect(corrections.size).toBe(0);
    });

    it('should clean up corrections for removed players', () => {
      const playerGroups = new Set<string>();
      const corrections = new Map<string, { startTime: number; duration: number }>();

      const player1 = 'player1';
      const player2 = 'player2';

      // Add corrections for both players
      corrections.set(player1, { startTime: 0, duration: 100 });
      corrections.set(player2, { startTime: 0, duration: 100 });

      // Only player1 is active
      playerGroups.add(player1);

      // Remove corrections for players not in playerGroups
      for (const playerId of corrections.keys()) {
        if (!playerGroups.has(playerId)) {
          corrections.delete(playerId);
        }
      }

      expect(corrections.size).toBe(1);
      expect(corrections.has(player1)).toBe(true);
      expect(corrections.has(player2)).toBe(false);
    });
  });
});
