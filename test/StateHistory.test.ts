import assert from 'assert';
import { StateHistory } from '../src/StateHistory.js';

console.log('Running StateHistory tests...\n');

// Test 1: Memory usage under 50MB for 32 players
{
  console.log('Test 1: Memory usage for 32 players over 200ms...');
  const history = new StateHistory(200, 15);
  const playerCount = 32;
  const ticks = Math.ceil(200 / 15);

  for (let tick = 0; tick < ticks; tick++) {
    const players = new Map();
    for (let i = 0; i < playerCount; i++) {
      const playerId = `player_${i}`;
      players.set(playerId, {
        isAlive: true,
        sperm: {
          position: { x: Math.random() * 1000, y: Math.random() * 1000 },
          angle: Math.random() * Math.PI * 2,
        },
      });
    }
    history.addSnapshot(players);
  }

  const stats = history.getStats();
  const memoryUsageMB = stats.memoryUsageBytes / (1024 * 1024);

  console.log(`  Snapshots: ${stats.snapshotCount}`);
  console.log(`  Memory: ${stats.memoryUsageKB} KB (${memoryUsageMB.toFixed(4)} MB)`);
  assert(memoryUsageMB < 50, 'Memory usage should be under 50MB');
  assert(stats.snapshotCount > 0, 'Should have snapshots');
  console.log('  ✓ PASS\n');
}

// Test 2: Automatic pruning of old snapshots
{
  console.log('Test 2: Automatic pruning of old snapshots...');
  const history = new StateHistory(200, 15);
  const players = new Map();
  players.set('player1', {
    isAlive: true,
    sperm: { position: { x: 100, y: 100 }, angle: 0 },
  });

  for (let i = 0; i < 100; i++) {
    history.addSnapshot(players);
  }

  const stats = history.getStats();
  console.log(`  Snapshots after 100 additions: ${stats.snapshotCount}`);
  assert(stats.snapshotCount < 25, 'Should prune old snapshots');
  console.log('  ✓ PASS\n');
}

// Test 3: Skip dead players
{
  console.log('Test 3: Skip dead players...');
  const history = new StateHistory(200, 15);
  const players = new Map();
  players.set('alive_player', {
    isAlive: true,
    sperm: { position: { x: 100, y: 100 }, angle: 0 },
  });
  players.set('dead_player', {
    isAlive: false,
    sperm: { position: { x: 200, y: 200 }, angle: 0 },
  });

  history.addSnapshot(players);
  const snapshot = history.findSnapshot(Date.now());

  assert(snapshot !== null, 'Should have snapshot');
  assert(snapshot?.players.length === 1, 'Should only have alive player');
  assert(snapshot?.players[0].id === 'alive_player', 'Should be alive_player');
  console.log('  ✓ PASS\n');
}

// Test 4: Clear history
{
  console.log('Test 4: Clear history...');
  const history = new StateHistory(200, 15);
  const players = new Map();
  players.set('player1', {
    isAlive: true,
    sperm: { position: { x: 100, y: 100 }, angle: 0 },
  });

  history.addSnapshot(players);
  assert(history.getStats().snapshotCount > 0, 'Should have snapshots');

  history.clear();
  assert(history.getStats().snapshotCount === 0, 'Should have no snapshots after clear');
  console.log('  ✓ PASS\n');
}

// Test 5: Get player state at time
{
  console.log('Test 5: Get player state at specific time...');
  const history = new StateHistory(200, 15);
  const players = new Map();
  players.set('player1', {
    isAlive: true,
    sperm: { position: { x: 100, y: 100 }, angle: 0 },
  });

  history.addSnapshot(players);

  const state = history.getPlayerStateAt('player1', Date.now());
  assert(state !== null, 'Should find player state');
  assert(state?.id === 'player1', 'Should have correct player ID');
  assert(state?.x === 100, 'Should have correct x position');
  assert(state?.y === 100, 'Should have correct y position');
  console.log('  ✓ PASS\n');
}

// Test 6: Return null for non-existent player
{
  console.log('Test 6: Return null for non-existent player...');
  const history = new StateHistory(200, 15);
  const players = new Map();
  players.set('player1', {
    isAlive: true,
    sperm: { position: { x: 100, y: 100 }, angle: 0 },
  });

  history.addSnapshot(players);

  const state = history.getPlayerStateAt('nonexistent', Date.now());
  assert(state === null, 'Should return null for non-existent player');
  console.log('  ✓ PASS\n');
}

// Test 7: Performance test
{
  console.log('Test 7: Performance with rapid snapshot creation...');
  const history = new StateHistory(200, 15);
  const players = new Map();
  const playerCount = 32;

  for (let i = 0; i < playerCount; i++) {
    players.set(`player_${i}`, {
      isAlive: true,
      sperm: { position: { x: i, y: i }, angle: 0 },
    });
  }

  const startTime = Date.now();

  for (let i = 0; i < 100; i++) {
    history.addSnapshot(players);
  }

  const elapsed = Date.now() - startTime;
  const stats = history.getStats();
  const memoryUsageMB = stats.memoryUsageBytes / (1024 * 1024);

  console.log(`  Created 100 snapshots with ${playerCount} players in ${elapsed}ms`);
  console.log(`  Memory usage: ${memoryUsageMB.toFixed(4)} MB`);

  assert(elapsed < 100, 'Should complete quickly');
  assert(memoryUsageMB < 50, 'Memory should stay under 50MB');
  console.log('  ✓ PASS\n');
}

// Test 8: Find snapshot returns null when empty
{
  console.log('Test 8: Find snapshot returns null when empty...');
  const history = new StateHistory(200, 15);
  const snapshot = history.findSnapshot(Date.now());
  assert(snapshot === null, 'Should return null when no snapshots exist');
  console.log('  ✓ PASS\n');
}

// Test 9: Memory usage estimation
{
  console.log('Test 9: Memory usage estimation...');
  const history = new StateHistory(200, 15);
  const players = new Map();

  for (let i = 0; i < 10; i++) {
    players.set(`player_${i}`, {
      isAlive: true,
      sperm: { position: { x: i * 10, y: i * 10 }, angle: i * 0.1 },
    });
  }

  history.addSnapshot(players);
  const stats = history.getStats();

  assert(stats.memoryUsageBytes > 0, 'Should have non-zero memory usage');
  assert(stats.snapshotCount === 1, 'Should have 1 snapshot');
  console.log(`  Memory for 10 players: ${stats.memoryUsageBytes} bytes`);
  console.log('  ✓ PASS\n');
}

console.log('✅ All StateHistory tests passed!');
