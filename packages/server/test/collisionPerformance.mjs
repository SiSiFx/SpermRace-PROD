import { CollisionSystem } from '../src/CollisionSystem.js';
import { PlayerEntity } from '../src/Player.js';

console.log('=== Collision System Performance Test ===\n');

// Test 1: 32 players in under 1ms
console.log('Test 1: 32 players with trails');
{
  const collisionSystem = new CollisionSystem(4000, 4000);
  const players = new Map();

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

  console.log(`  Average collision detection time: ${avgTimeMs.toFixed(3)}ms`);
  console.log(`  Trail points per player: ${Array.from(players.values())[0].trail.length}`);

  if (avgTimeMs < 1.0) {
    console.log(`  ✓ PASS: Under 1ms target\n`);
  } else {
    console.log(`  ✗ FAIL: ${avgTimeMs.toFixed(3)}ms exceeds 1ms target\n`);
    process.exit(1);
  }
}

// Test 2: Scaling with different player counts
console.log('Test 2: Scaling efficiency');
{
  const collisionSystem = new CollisionSystem(4000, 4000);
  const playerCounts = [8, 16, 24, 32];

  for (const count of playerCounts) {
    const players = new Map();

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
    const avgTimeMs = (endTime - startTime) / iterations;
    console.log(`  ${count} players: ${avgTimeMs.toFixed(3)}ms avg`);
  }
  console.log('');
}

// Test 3: Worst-case scenario (clustered players)
console.log('Test 3: Worst-case cluster scenario');
{
  const collisionSystem = new CollisionSystem(4000, 4000);
  const players = new Map();

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

  console.log(`  Total trail points: ${trailPoints}`);
  console.log(`  Average time: ${avgTimeMs.toFixed(3)}ms`);

  if (avgTimeMs < 1.0) {
    console.log(`  ✓ PASS: Worst case still under 1ms\n`);
  } else {
    console.log(`  ✗ FAIL: Worst case ${avgTimeMs.toFixed(3)}ms exceeds 1ms target\n`);
    process.exit(1);
  }
}

console.log('=== All tests passed! ===');
