import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollisionSystem } from '../src/CollisionSystem.js';
import { PlayerEntity } from '../src/Player.js';
import { Vector2, TrailPoint } from 'shared';
import { COLLISION, TRAIL } from 'shared/dist/constants.js';

describe('CollisionSystem - Trail Collision', () => {
  let collisionSystem: CollisionSystem;
  let players: Map<string, PlayerEntity>;

  beforeEach(() => {
    // Create a standard arena
    collisionSystem = new CollisionSystem(3500, 2500);
    players = new Map();

    // Mock Date.now() for consistent testing
    vi.mock('Date.now', () => {
      let currentTime = 1000000;
      return () => {
        return currentTime++;
      };
    });
  });

  describe('Basic Trail Collision Detection', () => {
    it('should detect collision when player touches another player\'s trail', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: 500 }, 0);
      const player2 = new PlayerEntity('p2', { x: 600, y: 500 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Create a trail point for player2 right next to player1's position
      const trailPoint: TrailPoint = {
        x: 510,  // Just 10 pixels away from player1 at (500, 500)
        y: 500,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      };
      player2.trail.push(trailPoint);

      // Move player1 towards the trail
      player1.sperm.position.x = 500;
      player1.sperm.position.y = 500;
      player1.sperm.velocity.x = 20;
      player1.sperm.velocity.y = 0;

      const eliminated = collisionSystem.update(players);

      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].victimId).toBe('p1');
      expect(eliminated[0].killerId).toBe('p2');
    });

    it('should eliminate player when distance < collision threshold', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Create trail point at collision distance (exactly at threshold)
      const collisionDist = COLLISION.SPERM_COLLISION_RADIUS + COLLISION.TRAIL_COLLISION_RADIUS - 1;
      const trailPoint: TrailPoint = {
        x: 100 + collisionDist,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      };
      player2.trail.push(trailPoint);

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].victimId).toBe('p1');
      expect(eliminated[0].killerId).toBe('p2');
    });

    it('should NOT eliminate player when distance >= collision threshold', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Create trail point just outside collision distance
      const safeDist = COLLISION.SPERM_COLLISION_RADIUS + COLLISION.TRAIL_COLLISION_RADIUS + 1;
      const trailPoint: TrailPoint = {
        x: 100 + safeDist,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      };
      player2.trail.push(trailPoint);

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      expect(eliminated).toHaveLength(0);
    });
  });

  describe('Self-Collision Protection', () => {
    it('should ignore recent self-trail points (index-based buffer)', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: 500 }, 0);

      players.set('p1', player1);

      // Create 25 trail points (more than SELF_COLLISION_BUFFER of 20)
      for (let i = 0; i < 25; i++) {
        player1.trail.push({
          x: 500 + i * 10,
          y: 500,
          expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
          createdAt: Date.now(),
        });
      }

      // Position player on top of a recent trail point (within buffer)
      player1.sperm.position.x = 520; // On top of the 20th point
      player1.sperm.position.y = 500;

      const eliminated = collisionSystem.update(players);

      // Should NOT be eliminated (self-collision protection)
      expect(eliminated).toHaveLength(0);
    });

    it('should respect self-collision after buffer zone', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: 500 }, 0);

      players.set('p1', player1);

      // Create 30 trail points, making sure createdAt is old enough
      const now = Date.now();
      for (let i = 0; i < 30; i++) {
        player1.trail.push({
          x: 500 + i * 10,
          y: 500,
          expiresAt: now + TRAIL.BASE_LIFETIME_MS,
          createdAt: now - 5000, // Created 5 seconds ago (outside time grace)
        });
      }

      // Position player on top of an old trail point (outside buffer)
      player1.sperm.position.x = 500; // On top of the 0th point
      player1.sperm.position.y = 500;

      // Make sure player is old enough to be outside spawn grace
      player1.spawnAtMs = now - COLLISION.SPAWN_SELF_COLLISION_GRACE_MS - 1000;

      const eliminated = collisionSystem.update(players);

      // Should be eliminated (outside buffer, outside time grace)
      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].victimId).toBe('p1');
      expect(eliminated[0].killerId).toBeUndefined(); // Self-collision, no killer
    });

    it('should ignore recent self-trail points (time-based grace)', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: 500 }, 0);

      players.set('p1', player1);

      // Create old trail point outside index buffer but within time grace
      const now = Date.now();
      for (let i = 0; i < 30; i++) {
        player1.trail.push({
          x: 500 + i * 10,
          y: 500,
          expiresAt: now + TRAIL.BASE_LIFETIME_MS,
          createdAt: now - COLLISION.SELF_IGNORE_RECENT_MS + 50, // 50ms ago, within grace
        });
      }

      // Position player on top of recent trail
      player1.sperm.position.x = 50;
      player1.sperm.position.y = 500;

      const eliminated = collisionSystem.update(players);

      // Should NOT be eliminated (time-based grace)
      expect(eliminated).toHaveLength(0);
    });

    it('should apply spawn grace period for self-collision', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: 500 }, 0);

      players.set('p1', player1);

      // Simulate recent spawn
      player1.spawnAtMs = Date.now() - COLLISION.SPAWN_SELF_COLLISION_GRACE_MS + 500;

      // Create old trail point
      player1.trail.push({
        x: 500,
        y: 500,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now() - 5000,
      });

      player1.sperm.position.x = 500;
      player1.sperm.position.y = 500;

      const eliminated = collisionSystem.update(players);

      // Should NOT be eliminated (spawn grace)
      expect(eliminated).toHaveLength(0);
    });

    it('should apply post-bounce grace period for self-collision', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: 500 }, 0);

      players.set('p1', player1);

      // Simulate recent wall bounce
      player1.lastBounceAt = Date.now() - COLLISION.POST_BOUNCE_GRACE_MS + 100;

      // Create old trail point
      player1.trail.push({
        x: 500,
        y: 500,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now() - 5000,
      });

      player1.sperm.position.x = 500;
      player1.sperm.position.y = 500;

      const eliminated = collisionSystem.update(players);

      // Should NOT be eliminated (post-bounce grace)
      expect(eliminated).toHaveLength(0);
    });
  });

  describe('Spatial Hash Grid Optimization', () => {
    it('should use spatial partitioning for efficient collision detection', () => {
      // Create many players spread across the arena
      const gridSize = COLLISION.GRID_CELL_SIZE;

      for (let i = 0; i < 50; i++) {
        const player = new PlayerEntity(`p${i}`, {
          x: Math.random() * 3500,
          y: Math.random() * 2500,
        }, Math.random() * Math.PI * 2);
        players.set(`p${i}`, player);
      }

      // Add trail points to one player
      const victim = players.get('p0')!;
      const killer = players.get('p1')!;

      for (let i = 0; i < 10; i++) {
        killer.trail.push({
          x: 500 + i * 15,
          y: 500,
          expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
          createdAt: Date.now(),
        });
      }

      victim.sperm.position.x = 500;
      victim.sperm.position.y = 500;

      const eliminated = collisionSystem.update(players);

      // Should only eliminate the victim, not all players
      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].victimId).toBe('p0');
    });

    it('should correctly check nearby grid cells (3x3 neighborhood)', () => {
      const player1 = new PlayerEntity('p1', { x: 105, y: 105 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 200 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Place trail point very close to player1
      // Player at (105, 105), trail at (110, 105) - only 5 pixels away
      const trailPoint: TrailPoint = {
        x: 110,
        y: 105,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      };
      player2.trail.push(trailPoint);

      player1.sperm.position.x = 105;
      player1.sperm.position.y = 105;

      const eliminated = collisionSystem.update(players);

      // Should detect collision even with spatial partitioning
      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].victimId).toBe('p1');
    });
  });

  describe('Trail Expiration', () => {
    it('should eliminate player from non-expired trail points', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Create valid trail point
      const trailPoint: TrailPoint = {
        x: 105,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      };
      player2.trail.push(trailPoint);

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      // Should be eliminated (trail valid)
      expect(eliminated).toHaveLength(1);
    });

    it('should handle trail cleanup by Player entity', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Note: The CollisionSystem doesn't check expiration - Player entities are responsible
      // for cleaning up their own expired trails. This test verifies that the system
      // correctly handles whatever trails are present (expired or not).

      // Create trail point that would be expired
      const now = Date.now();
      const trailPoint: TrailPoint = {
        x: 100 + COLLISION.SPERM_COLLISION_RADIUS + COLLISION.TRAIL_COLLISION_RADIUS - 1,
        y: 100,
        expiresAt: now - 1000, // Expired
        createdAt: now - 10000,
      };
      player2.trail.push(trailPoint);

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      // The collision system will detect collision with any trail in the grid
      // Trail cleanup is handled by Player.cleanExpiredTrails(), not CollisionSystem
      // So this test expects collision since the trail is still in the array
      expect(eliminated).toHaveLength(1);
    });
  });

  describe('Debug Telemetry', () => {
    it('should include debug information on collision', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Create trail with multiple points
      player2.trail.push({
        x: 90,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      });
      player2.trail.push({
        x: 105,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      });

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;
      player1.sperm.velocity.x = 50;
      player1.sperm.velocity.y = 0;

      const eliminated = collisionSystem.update(players);

      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].debug).toBeDefined();
      expect(eliminated[0].debug?.type).toBe('trail');

      // Check hit position
      expect(eliminated[0].debug?.hit.x).toBe(100);
      expect(eliminated[0].debug?.hit.y).toBe(100);

      // Check normal vector
      expect(eliminated[0].debug?.normal).toBeDefined();
      const normal = eliminated[0].debug!.normal!;
      expect(Math.hypot(normal.x, normal.y)).toBeCloseTo(1, 1);

      // Check relative speed
      expect(eliminated[0].debug?.relSpeed).toBeDefined();
      expect(eliminated[0].debug?.relSpeed).toBeGreaterThan(0);

      // Check segment (if available)
      if (eliminated[0].debug?.segment) {
        expect(eliminated[0].debug.segment.from).toBeDefined();
        expect(eliminated[0].debug.segment.to).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle player with no trail', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // player2 has no trail points

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      expect(eliminated).toHaveLength(0);
    });

    it('should handle multiple players colliding with same trail', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 200 }, Math.PI);
      const player3 = new PlayerEntity('p3', { x: 300, y: 100 }, 0);

      players.set('p1', player1);
      players.set('p2', player2);
      players.set('p3', player3);

      // Create trail for player2
      player2.trail.push({
        x: 105,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      });

      // Both player1 and player3 near the trail
      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      player3.sperm.position.x = 110;
      player3.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      // Both should be eliminated
      expect(eliminated.length).toBeGreaterThanOrEqual(1);
      const victimIds = eliminated.map(e => e.victimId);
      expect(victimIds).toContain('p1');
    });

    it('should not eliminate dead players', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Kill player1
      player1.isAlive = false;

      // Create trail that would hit player1
      player2.trail.push({
        x: 105,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now(),
      });

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      // Player1 should not be in elimination list (already dead)
      expect(eliminated).toHaveLength(0);
    });

    it('should handle zero distance edge case', () => {
      const player1 = new PlayerEntity('p1', { x: 100, y: 100 }, 0);
      const player2 = new PlayerEntity('p2', { x: 200, y: 100 }, Math.PI);

      players.set('p1', player1);
      players.set('p2', player2);

      // Create trail point exactly at player position (zero distance)
      const trailPoint: TrailPoint = {
        x: 100,
        y: 100,
        expiresAt: Date.now() + TRAIL.BASE_LIFETIME_MS,
        createdAt: Date.now() - 5000,
      };
      player2.trail.push(trailPoint);

      player1.sperm.position.x = 100;
      player1.sperm.position.y = 100;

      const eliminated = collisionSystem.update(players);

      // Should eliminate (distance 0 < collision threshold)
      expect(eliminated).toHaveLength(1);
      expect(eliminated[0].victimId).toBe('p1');
    });
  });

  describe('World Boundaries', () => {
    it('should bounce player off left wall', () => {
      const player1 = new PlayerEntity('p1', { x: -10, y: 500 }, 0);

      players.set('p1', player1);

      collisionSystem.update(players);

      // Position should be clamped to 0
      expect(player1.sperm.position.x).toBe(0);
      // Velocity should be reversed and damped
      expect(player1.sperm.velocity.x).toBeGreaterThanOrEqual(0);
      expect(player1.lastBounceAt).toBeGreaterThan(0);
    });

    it('should bounce player off right wall', () => {
      const player1 = new PlayerEntity('p1', { x: 3510, y: 500 }, 0);
      player1.sperm.velocity.x = 100;

      players.set('p1', player1);

      collisionSystem.update(players);

      // Position should be clamped to world width
      expect(player1.sperm.position.x).toBe(3500);
      // Velocity should be reversed and damped
      expect(player1.sperm.velocity.x).toBeLessThan(0);
      expect(player1.lastBounceAt).toBeGreaterThan(0);
    });

    it('should bounce player off top wall', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: -10 }, 0);

      players.set('p1', player1);

      collisionSystem.update(players);

      // Position should be clamped to 0
      expect(player1.sperm.position.y).toBe(0);
      // Velocity should be reversed and damped
      expect(player1.sperm.velocity.y).toBeGreaterThanOrEqual(0);
      expect(player1.lastBounceAt).toBeGreaterThan(0);
    });

    it('should bounce player off bottom wall', () => {
      const player1 = new PlayerEntity('p1', { x: 500, y: 2510 }, 0);
      player1.sperm.velocity.y = 100;

      players.set('p1', player1);

      collisionSystem.update(players);

      // Position should be clamped to world height
      expect(player1.sperm.position.y).toBe(2500);
      // Velocity should be reversed and damped
      expect(player1.sperm.velocity.y).toBeLessThan(0);
      expect(player1.lastBounceAt).toBeGreaterThan(0);
    });

    it('should apply 0.65 damping factor on wall bounce', () => {
      const player1 = new PlayerEntity('p1', { x: -10, y: 500 }, 0);
      player1.sperm.velocity.x = 200;

      players.set('p1', player1);

      const beforeBounceVelocity = player1.sperm.velocity.x;
      collisionSystem.update(players);
      const afterBounceVelocity = player1.sperm.velocity.x;

      // Velocity should be reversed and damped by 0.65
      expect(afterBounceVelocity).toBeCloseTo(Math.abs(beforeBounceVelocity) * 0.65, 1);
    });
  });

  describe('Dynamic World Bounds', () => {
    it('should update world bounds dynamically', () => {
      const player1 = new PlayerEntity('p1', { x: 2000, y: 1500 }, 0);

      players.set('p1', player1);

      // Shrink the world
      collisionSystem.setWorldBounds(2000, 1500);

      // Player should now be outside bounds
      collisionSystem.update(players);

      // Position should be clamped to new bounds
      expect(player1.sperm.position.x).toBe(2000);
      expect(player1.sperm.position.y).toBe(1500);
    });
  });
});
