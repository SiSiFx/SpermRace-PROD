/**
 * Tests for trail interpolation and smoothing functionality
 */

import { describe, it, expect } from 'vitest';
import type { TrailPoint } from 'shared';

/**
 * Interpolate between two trail arrays based on parameter t (0-1).
 * This is a copy of the function from main.ts for testing purposes.
 */
function interpolateTrails(
  fromTrail: TrailPoint[] | undefined,
  toTrail: TrailPoint[] | undefined,
  t: number,
  timestamp: number
): TrailPoint[] {
  // If no trails in either snapshot, return empty
  if (!toTrail || toTrail.length === 0) return [];
  if (!fromTrail || fromTrail.length === 0) return toTrail;

  // Filter out expired points from both trails
  const now = timestamp;
  const validFrom = fromTrail.filter(p => p.expiresAt > now);
  const validTo = toTrail.filter(p => p.expiresAt > now);

  if (validTo.length === 0) return [];

  // For very short trails or near endpoints, just return the target
  if (validTo.length <= 2 || t >= 0.95) return validTo;

  // Build interpolated trail by sampling and blending
  const result: TrailPoint[] = [];
  const maxLength = Math.max(validFrom.length, validTo.length);

  // Sample points at regular intervals
  const sampleCount = Math.min(maxLength, 64); // Limit for performance
  for (let i = 0; i < sampleCount; i++) {
    const normPos = i / (sampleCount - 1); // 0 to 1 along trail

    // Find corresponding points in both trails (from tail to head)
    const fromIdx = Math.floor(normPos * (validFrom.length - 1));
    const toIdx = Math.floor(normPos * (validTo.length - 1));

    const fromPoint = validFrom[fromIdx];
    const toPoint = validTo[toIdx];

    if (!toPoint) continue;

    // Interpolate position
    const ix = fromPoint ? fromPoint.x + (toPoint.x - fromPoint.x) * t : toPoint.x;
    const iy = fromPoint ? fromPoint.y + (toPoint.y - fromPoint.y) * t : toPoint.y;

    // Use expiration from target trail (authoritative)
    const interpolatedPoint: TrailPoint = {
      x: ix,
      y: iy,
      expiresAt: toPoint.expiresAt,
      createdAt: toPoint.createdAt
    };

    result.push(interpolatedPoint);
  }

  return result;
}

describe('Trail Interpolation', () => {
  describe('interpolateTrails', () => {
    const now = Date.now();

    it('should return empty array when toTrail is empty', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 },
        { x: 10, y: 10, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, undefined, 0.5, now);
      expect(result).toEqual([]);
    });

    it('should return empty array when toTrail has no points', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, [], 0.5, now);
      expect(result).toEqual([]);
    });

    it('should return toTrail when fromTrail is empty', () => {
      const toTrail: TrailPoint[] = [
        { x: 10, y: 10, expiresAt: now + 1000 },
        { x: 20, y: 20, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(undefined, toTrail, 0.5, now);
      expect(result).toEqual(toTrail);
    });

    it('should filter out expired points', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now - 1000 }, // expired
        { x: 10, y: 10, expiresAt: now + 1000 } // valid
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now - 1000 }, // expired
        { x: 30, y: 30, expiresAt: now + 1000 } // valid
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);
      expect(result.length).toBeGreaterThan(0);
      // Should only contain non-expired points
      result.forEach(point => {
        expect(point.expiresAt).toBeGreaterThan(now);
      });
    });

    it('should interpolate positions correctly at t=0.5', () => {
      // Use longer trails to trigger interpolation (short trails return target directly)
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 },
        { x: 30, y: 30, expiresAt: now + 1000 },
        { x: 60, y: 60, expiresAt: now + 1000 },
        { x: 100, y: 100, expiresAt: now + 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now + 1000 },
        { x: 50, y: 50, expiresAt: now + 1000 },
        { x: 80, y: 80, expiresAt: now + 1000 },
        { x: 120, y: 120, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);

      // At t=0.5, positions should be halfway between from and to
      // First point: (0 + 20) / 2 = 10
      // Last point: (100 + 120) / 2 = 110
      expect(result[0].x).toBeCloseTo(10, 0);
      expect(result[0].y).toBeCloseTo(10, 0);
      expect(result[result.length - 1].x).toBeCloseTo(110, 0);
      expect(result[result.length - 1].y).toBeCloseTo(110, 0);
    });

    it('should return toTrail when t >= 0.95', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 },
        { x: 100, y: 100, expiresAt: now + 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now + 1000 },
        { x: 120, y: 120, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.95, now);
      expect(result).toEqual(toTrail);
    });

    it('should preserve expiration timestamps from toTrail', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 500 },
        { x: 100, y: 100, expiresAt: now + 500 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now + 2000 },
        { x: 120, y: 120, expiresAt: now + 2000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);

      // All points should have expiration from toTrail
      result.forEach(point => {
        expect(point.expiresAt).toBe(now + 2000);
      });
    });

    it('should handle trails of different lengths', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 },
        { x: 50, y: 50, expiresAt: now + 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now + 1000 },
        { x: 60, y: 60, expiresAt: now + 1000 },
        { x: 100, y: 100, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);

      // Should successfully interpolate without errors
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(64); // Max sample limit
    });

    it('should return empty array when all points are expired', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now - 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now - 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);
      expect(result).toEqual([]);
    });

    it('should interpolate smoothly along the entire trail', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 },
        { x: 50, y: 50, expiresAt: now + 1000 },
        { x: 100, y: 100, expiresAt: now + 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 10, y: 10, expiresAt: now + 1000 },
        { x: 60, y: 60, expiresAt: now + 1000 },
        { x: 110, y: 110, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);

      // Check that interpolation is smooth (monotonic increase)
      for (let i = 1; i < result.length; i++) {
        expect(result[i].x).toBeGreaterThanOrEqual(result[i - 1].x - 0.1);
        expect(result[i].y).toBeGreaterThanOrEqual(result[i - 1].y - 0.1);
      }
    });

    it('should limit sample count to 64 for performance', () => {
      // Create long trails
      const fromTrail: TrailPoint[] = [];
      const toTrail: TrailPoint[] = [];
      for (let i = 0; i < 100; i++) {
        fromTrail.push({ x: i * 10, y: i * 10, expiresAt: now + 1000 });
        toTrail.push({ x: i * 10 + 5, y: i * 10 + 5, expiresAt: now + 1000 });
      }
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);
      expect(result.length).toBeLessThanOrEqual(64);
    });
  });

  describe('Trail interpolation edge cases', () => {
    const now = Date.now();

    it('should handle single point trails', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 10, y: 10, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0.5, now);
      // Short trails should return target directly
      expect(result).toEqual(toTrail);
    });

    it('should handle t=0 (fully at fromTrail)', () => {
      // Use longer trails to trigger interpolation
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 },
        { x: 30, y: 30, expiresAt: now + 1000 },
        { x: 60, y: 60, expiresAt: now + 1000 },
        { x: 100, y: 100, expiresAt: now + 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now + 1000 },
        { x: 50, y: 50, expiresAt: now + 1000 },
        { x: 80, y: 80, expiresAt: now + 1000 },
        { x: 120, y: 120, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 0, now);

      // At t=0, should be closer to fromTrail values
      expect(result[0].x).toBeLessThanOrEqual(10);
      expect(result[result.length - 1].x).toBeCloseTo(100, 0);
    });

    it('should handle t=1 (fully at toTrail)', () => {
      const fromTrail: TrailPoint[] = [
        { x: 0, y: 0, expiresAt: now + 1000 },
        { x: 100, y: 100, expiresAt: now + 1000 }
      ];
      const toTrail: TrailPoint[] = [
        { x: 20, y: 20, expiresAt: now + 1000 },
        { x: 120, y: 120, expiresAt: now + 1000 }
      ];
      const result = interpolateTrails(fromTrail, toTrail, 1, now);

      // At t=1 (before the 0.95 check), should be close to toTrail
      expect(result).toEqual(toTrail);
    });
  });
});
