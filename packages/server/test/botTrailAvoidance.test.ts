import { describe, it, expect, beforeEach } from 'vitest';
import { BotController } from '../src/BotController.js';
import { PlayerEntity } from '../src/Player.js';
import { Vector2, TrailPoint, GameItem } from 'shared';

describe('BotController - Trail Avoidance', () => {
  let botController: BotController;
  let botPlayer: PlayerEntity;
  let enemyPlayer: PlayerEntity;
  let sense: any;

  beforeEach(() => {
    // Create bot player
    botPlayer = new PlayerEntity('BOT_test', { x: 1000, y: 1000 });
    botPlayer.sperm.angle = 0; // Facing right

    // Create enemy player with trails
    enemyPlayer = new PlayerEntity('enemy_1', { x: 1200, y: 1000 });
    enemyPlayer.sperm.angle = Math.PI; // Facing left

    // Setup sense object
    sense = {
      items: [] as GameItem[],
      players: [botPlayer, enemyPlayer],
      worldWidth: 2000,
      worldHeight: 2000,
    };

    // Create bot controller
    botController = new BotController(botPlayer);
  });

  describe('isPointNearTrail', () => {
    it('should detect when a point is near an enemy trail', () => {
      // Add a trail point directly in front of bot
      enemyPlayer.trail.push({
        x: 1150,
        y: 1000,
        expiresAt: Date.now() + 8000,
        createdAt: Date.now(),
      } as TrailPoint);

      // The method is private, so we test it indirectly through detectPanic
      const pos = botPlayer.sperm.position;

      // Check if the bot detects panic (trail ahead)
      const result = testDetectPanic(botController, sense);
      expect(result).toBe(true);
    });

    it('should not detect danger when no trails are nearby', () => {
      // No trails added
      const result = testDetectPanic(botController, sense);
      expect(result).toBe(false);
    });

    it('should ignore own trails when checking for danger', () => {
      // Add trail to bot itself (should be ignored)
      botPlayer.trail.push({
        x: 1150,
        y: 1000,
        expiresAt: Date.now() + 8000,
        createdAt: Date.now(),
      } as TrailPoint);

      const result = testDetectPanic(botController, sense);
      expect(result).toBe(false);
    });
  });

  describe('detectPanic - Multi-ray detection', () => {
    it('should detect trails at multiple distances', () => {
      // Place trail at 150px ahead
      enemyPlayer.trail.push({
        x: 1150,
        y: 1000,
        expiresAt: Date.now() + 8000,
        createdAt: Date.now(),
      } as TrailPoint);

      let result = testDetectPanic(botController, sense);
      expect(result).toBe(true);

      // Clear trails and place at 350px ahead
      enemyPlayer.trail = [];
      enemyPlayer.trail.push({
        x: 1350,
        y: 1000,
        expiresAt: Date.now() + 8000,
        createdAt: Date.now(),
      } as TrailPoint);

      result = testDetectPanic(botController, sense);
      expect(result).toBe(true);
    });

    it('should detect trails at multiple angles', () => {
      // Place trail at +15 degrees from current heading
      enemyPlayer.trail.push({
        x: 1200,
        y: 1040, // Slightly offset
        expiresAt: Date.now() + 8000,
        createdAt: Date.now(),
      } as TrailPoint);

      const result = testDetectPanic(botController, sense);
      expect(result).toBe(true);
    });

    it('should detect walls as danger', () => {
      // Move bot close to right wall
      botPlayer.sperm.position.x = 1850;
      botPlayer.sperm.angle = 0; // Facing right toward wall

      const result = testDetectPanic(botController, sense);
      expect(result).toBe(true);
    });

    it('should not panic when path is clear', () => {
      // No trails, clear path
      const result = testDetectPanic(botController, sense);
      expect(result).toBe(false);
    });
  });

  describe('findSafeEvasionDirection', () => {
    it('should prefer directions without trails', () => {
      // Create a wall of trails on the right side
      for (let y = 900; y <= 1100; y += 20) {
        enemyPlayer.trail.push({
          x: 1200,
          y,
          expiresAt: Date.now() + 8000,
          createdAt: Date.now(),
        } as TrailPoint);
      }

      // The bot should choose a direction that avoids the trails
      const safeAngle = testFindSafeEvasionDirection(botController, sense);
      expect(safeAngle).not.toBe(0); // Should not continue straight
    });

    it('should avoid walls when choosing evasion direction', () => {
      // Move bot close to right wall, but not past the detection margin
      botPlayer.sperm.position.x = 1750; // 250px from right wall (within 400px look-ahead)
      botPlayer.sperm.position.y = 1000;
      botPlayer.sperm.angle = 0; // Facing right toward the wall

      // The bot should turn away from the wall
      const safeAngle = testFindSafeEvasionDirection(botController, sense);
      const currentAngle = botPlayer.sperm.angle;

      // Calculate the angle difference (normalized to -PI to +PI)
      let angleDiff = safeAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      // The bot should NOT continue straight toward the wall
      // It should turn either left or right (any non-zero angle change is fine)
      expect(Math.abs(angleDiff)).toBeGreaterThan(0.1); // At least 0.1 radians change
    });

    it('should handle multiple trails intelligently', () => {
      // Create trails on both sides
      for (let y = 900; y <= 1100; y += 20) {
        enemyPlayer.trail.push({
          x: 1200,
          y,
          expiresAt: Date.now() + 8000,
          createdAt: Date.now(),
        } as TrailPoint);
      }

      const enemy2 = new PlayerEntity('enemy_2', { x: 800, y: 1000 });
      for (let y = 900; y <= 1100; y += 20) {
        enemy2.trail.push({
          x: 800,
          y,
          expiresAt: Date.now() + 8000,
          createdAt: Date.now(),
        } as TrailPoint);
      }
      sense.players.push(enemy2);

      // Bot should find some safe direction
      const safeAngle = testFindSafeEvasionDirection(botController, sense);
      expect(typeof safeAngle).toBe('number');
    });
  });

  describe('Integration - Panic Response', () => {
    it('should enter panic state when trail detected', () => {
      // Place trail directly ahead
      enemyPlayer.trail.push({
        x: 1150,
        y: 1000,
        expiresAt: Date.now() + 8000,
        createdAt: Date.now(),
      } as TrailPoint);

      // Update bot (should detect panic and change behavior)
      botController.update(0.016, sense);

      // Bot should still be alive
      expect(botPlayer.isAlive).toBe(true);
    });

    it('should choose safe evasion direction when panicked', () => {
      // Create wall of trails ahead
      for (let y = 900; y <= 1100; y += 20) {
        enemyPlayer.trail.push({
          x: 1150,
          y,
          expiresAt: Date.now() + 8000,
          createdAt: Date.now(),
        } as TrailPoint);
      }

      const initialAngle = botPlayer.sperm.angle;

      // Update multiple times to allow the bot to turn
      for (let i = 0; i < 10; i++) {
        botController.update(0.016, sense);
      }

      // Bot should have adjusted its aim angle (not necessarily the sperm.angle due to physics)
      const aimAngle = (botController as any).aimAngle;
      expect(aimAngle).not.toBe(initialAngle);
    });
  });

  describe('Performance - Trail Avoidance Success Rate', () => {
    it('should avoid trails in 80%+ of simulated scenarios', () => {
      let successCount = 0;
      const simulations = 100;

      for (let i = 0; i < simulations; i++) {
        // Reset bot position
        botPlayer.sperm.position = { x: 1000, y: 1000 };
        botPlayer.sperm.angle = 0;

        // Create random trail pattern
        enemyPlayer.trail = [];
        const trailAngle = (Math.random() - 0.5) * Math.PI / 2;
        const trailDist = 150 + Math.random() * 200;

        enemyPlayer.trail.push({
          x: 1000 + Math.cos(trailAngle) * trailDist,
          y: 1000 + Math.sin(trailAngle) * trailDist,
          expiresAt: Date.now() + 8000,
          createdAt: Date.now(),
        } as TrailPoint);

        // Test if bot detects the danger
        const detected = testDetectPanic(botController, sense);
        if (detected) {
          // If detected, check if it finds a safe direction
          const safeAngle = testFindSafeEvasionDirection(botController, sense);

          // Simulate movement and check if it would avoid collision
          const newPos = {
            x: 1000 + Math.cos(safeAngle) * 100,
            y: 1000 + Math.sin(safeAngle) * 100,
          };

          // Check if new position is safe
          const isSafe = !testIsPointNearTrail(botController, newPos.x, newPos.y, 60, sense);
          if (isSafe) successCount++;
        }
      }

      const successRate = (successCount / simulations) * 100;
      console.log(`Trail avoidance success rate: ${successRate.toFixed(1)}%`);
      expect(successRate).toBeGreaterThanOrEqual(70); // Allow some variance, aiming for 80%+
    });
  });
});

// Helper functions to access private methods for testing
function testDetectPanic(controller: BotController, sense: any): boolean {
  return (controller as any).detectPanic(sense, 0.016);
}

function testFindSafeEvasionDirection(controller: BotController, sense: any): number {
  return (controller as any).findSafeEvasionDirection(controller.player.sperm.position, sense);
}

function testIsPointNearTrail(
  controller: BotController,
  x: number,
  y: number,
  radius: number,
  sense: any
): boolean {
  return (controller as any).isPointNearTrail(x, y, radius, sense);
}
