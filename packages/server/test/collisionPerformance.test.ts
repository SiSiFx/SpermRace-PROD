import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CollisionSystem } from '../dist/CollisionSystem.js';
import { PlayerEntity } from '../dist/Player.js';

describe('Collision System Performance', () => {
  it('should process 32 players with trails in under 1ms', () => {
    const collisionSystem = new CollisionSystem(4000, 4000);
    const players = new Map<string, PlayerEntity>();

    // Create 32 players
    for (let i = 0; i < 32; i++) {
      const player = new PlayerEntity(`player_${i}`, {
        x: Math.random() * 4000,
        y: Math.random() * 4000
      });
      players.set(player.id, player);
    }

    // Simulate 5 seconds of gameplay to build up trails
    const deltaTime = 0.016; // ~60fps
    const frames = 300; // 5 seconds

    for (let frame = 0; frame < frames; frame++) {
      for (const player of players.values()) {
        // Move players in random directions
        const angle = Math.random() * Math.PI * 2;
        player.input.target.x = player.sperm.position.x + Math.cos(angle) * 100;
        player.input.target.y = player.sperm.position.y + Math.sin(angle) * 100;
        player.update(deltaTime, 1);
      }
    }

    // Warm up the collision system
    for (let i = 0; i < 10; i++) {
      collisionSystem.update(players);
    }

    // Benchmark collision detection
    const iterations = 100;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      collisionSystem.update(players);
    }

    const endTime = performance.now();
    const avgTimeMs = (endTime - startTime) / iterations;

    console.log(`Average collision detection time for 32 players: ${avgTimeMs.toFixed(3)}ms`);
    console.log(`Trail points per player: ${Array.from(players.values())[0].trail.length}`);

    assert.ok(
      avgTimeMs < 1.0,
      `Collision detection took ${avgTimeMs.toFixed(3)}ms, expected < 1ms`
    );
  });

  it('should scale efficiently with different player counts', () => {
    const collisionSystem = new CollisionSystem(4000, 4000);
    const playerCounts = [8, 16, 24, 32];
    const results: Record<number, number> = {};

    for (const count of playerCounts) {
      const players = new Map<string, PlayerEntity>();

      // Create players
      for (let i = 0; i < count; i++) {
        const player = new PlayerEntity(`player_${i}`, {
          x: Math.random() * 4000,
          y: Math.random() * 4000
        });
        players.set(player.id, player);
      }

      // Simulate 5 seconds of gameplay
      const deltaTime = 0.016;
      const frames = 300;

      for (let frame = 0; frame < frames; frame++) {
        for (const player of players.values()) {
          const angle = Math.random() * Math.PI * 2;
          player.input.target.x = player.sperm.position.x + Math.cos(angle) * 100;
          player.input.target.y = player.sperm.position.y + Math.sin(angle) * 100;
          player.update(deltaTime, 1);
        }
      }

      // Warm up
      for (let i = 0; i < 10; i++) {
        collisionSystem.update(players);
      }

      // Benchmark
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        collisionSystem.update(players);
      }

      const endTime = performance.now();
      results[count] = (endTime - startTime) / iterations;

      console.log(`${count} players: ${results[count].toFixed(3)}ms avg`);
    }

    // Verify that 32 players is under 1ms
    assert.ok(
      results[32] < 1.0,
      `32 players took ${results[32].toFixed(3)}ms, expected < 1ms`
    );

    // Verify reasonable scaling (should not be exponential)
    // 32 players should take less than 5x longer than 8 players
    const scalingFactor = results[32] / results[8];
    assert.ok(
      scalingFactor < 5.0,
      `Scaling factor ${scalingFactor.toFixed(2)}x indicates poor performance (expected < 5x)`
    );
  });

  it('should handle worst-case scenario with all players in same area', () => {
    const collisionSystem = new CollisionSystem(4000, 4000);
    const players = new Map<string, PlayerEntity>();

    // Create 32 players all clustered in the center
    const centerX = 2000;
    const centerY = 2000;
    const clusterRadius = 300;

    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const radius = clusterRadius * Math.sqrt(Math.random());
      const player = new PlayerEntity(`player_${i}`, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
      players.set(player.id, player);
    }

    // Simulate 3 seconds of gameplay
    const deltaTime = 0.016;
    const frames = 180;

    for (let frame = 0; frame < frames; frame++) {
      for (const player of players.values()) {
        // Move towards center to increase trail density
        const dx = centerX - player.sperm.position.x;
        const dy = centerY - player.sperm.position.y;
        player.input.target.x = player.sperm.position.x + dx * 0.1;
        player.input.target.y = player.sperm.position.y + dy * 0.1;
        player.update(deltaTime, 1);
      }
    }

    // Warm up
    for (let i = 0; i < 10; i++) {
      collisionSystem.update(players);
    }

    // Benchmark worst-case scenario
    const iterations = 100;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      collisionSystem.update(players);
    }

    const endTime = performance.now();
    const avgTimeMs = (endTime - startTime) / iterations;

    const trailPoints = Array.from(players.values()).reduce(
      (sum, p) => sum + p.trail.length,
      0
    );

    console.log(`Worst-case cluster (${trailPoints} total trail points): ${avgTimeMs.toFixed(3)}ms avg`);

    // Even in worst case, should be under 1ms
    assert.ok(
      avgTimeMs < 1.0,
      `Worst-case scenario took ${avgTimeMs.toFixed(3)}ms, expected < 1ms`
    );
  });
});
