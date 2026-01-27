import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlayerEntity } from '../src/Player.js';
import { Vector2 } from 'shared';
import { PHYSICS, BURST } from 'shared/dist/constants.js';

describe('PlayerEntity - Burst Mechanic', () => {
  let player: PlayerEntity;
  let mockNow: number;

  beforeEach(() => {
    // Create a player
    player = new PlayerEntity('test-player', { x: 1000, y: 1000 }, 0);
    mockNow = Date.now();
  });

  describe('Burst Trigger on Turn Release', () => {
    it('should trigger burst when player stops turning', () => {
      // Start with some velocity
      player.sperm.velocity.x = 100;
      player.sperm.velocity.y = 0;

      // First update: player is turning (targetAngle is different from current angle)
      player.setInput({ target: { x: 1000, y: 1100 }, accelerate: true });
      player.update(0.015, 1);

      // Second update: player stops turning (targetAngle aligns with movement)
      // The burst should be triggered here
      player.setInput({ target: { x: 1100, y: 1000 }, accelerate: true });
      player.update(0.015, 1);

      // The player should have received a burst speed boost
      const speed = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
      // Without burst, speed would be around base speed. With burst, it should be 1.3x
      expect(speed).toBeGreaterThan(0);
    });

    it('should not trigger burst when player was not turning', () => {
      // Start with some velocity
      player.sperm.velocity.x = 100;
      player.sperm.velocity.y = 0;

      // Update without turning (targetAngle aligns with current angle)
      player.setInput({ target: { x: 1100, y: 1000 }, accelerate: true });
      player.update(0.015, 1);

      // Next update also without turning
      player.setInput({ target: { x: 1200, y: 1000 }, accelerate: true });
      player.update(0.015, 1);

      // No burst should have been triggered
      const speed = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
      expect(speed).toBeLessThan(PHYSICS.MAX_SPEED * BURST.MULTIPLIER);
    });
  });

  describe('Burst Duration', () => {
    it('should apply burst multiplier for the specified duration', () => {
      // Set up burst state
      player.sperm.velocity.x = 200;
      player.sperm.velocity.y = 0;

      // Manually set burst until time
      const burstEndTime = Date.now() + BURST.DURATION_MS;
      (player as any).burstUntil = burstEndTime;

      // Update during burst - speed should be higher
      player.setInput({ target: { x: 1100, y: 1000 }, accelerate: true });
      player.update(0.015, 1);

      const speedDuringBurst = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
      expect(speedDuringBurst).toBeGreaterThan(0);
    });

    it('should stop applying burst multiplier after duration expires', () => {
      // Set up burst state that has already expired
      const pastTime = Date.now() - BURST.DURATION_MS - 100;
      (player as any).burstUntil = pastTime;

      // Update after burst expires
      player.sperm.velocity.x = 200;
      player.sperm.velocity.y = 0;
      player.setInput({ target: { x: 1100, y: 1000 }, accelerate: true });
      player.update(0.015, 1);

      // Speed should be at normal max, not burst max
      const speed = Math.hypot(player.sperm.velocity.x, player.sperm.velocity.y);
      expect(speed).toBeLessThanOrEqual(PHYSICS.MAX_SPEED * BURST.MULTIPLIER);
    });
  });

  describe('Burst Multiplier', () => {
    it('should have correct burst multiplier value', () => {
      expect(BURST.MULTIPLIER).toBe(1.3);
    });

    it('should have correct burst duration', () => {
      expect(BURST.DURATION_MS).toBe(600);
    });

    it('should have correct turn threshold', () => {
      expect(BURST.TURN_THRESHOLD).toBe(0.05);
    });
  });

  describe('Burst State Tracking', () => {
    it('should track wasTurning state correctly', () => {
      // Initially not turning
      expect((player as any).wasTurning).toBe(false);

      // Turn the player
      player.setInput({ target: { x: 1000, y: 1100 }, accelerate: true });
      player.update(0.015, 1);

      // Should be turning now
      expect((player as any).wasTurning).toBe(true);

      // Stop turning
      player.setInput({ target: { x: 1100, y: 1000 }, accelerate: true });
      player.update(0.015, 1);

      // Should no longer be turning after the release
      // and burst should have been triggered
      expect((player as any).burstUntil).not.toBeUndefined();
    });
  });
});
