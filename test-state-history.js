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

  if (memoryUsageMB >= 50) {
    throw new Error(`Memory usage ${memoryUsageMB.toFixed(4)} MB exceeds 50MB limit!`);
  }
  if (stats.snapshotCount === 0) {
    throw new Error('Should have snapshots!');
  }
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

  if (stats.snapshotCount >= 25) {
    throw new Error(`Should prune old snapshots, but got ${stats.snapshotCount}`);
  }
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

  if (!snapshot) {
    throw new Error('Should have snapshot');
  }
  if (snapshot.players.length !== 1) {
    throw new Error(`Should only have 1 alive player, got ${snapshot.players.length}`);
  }
  if (snapshot.players[0].id !== 'alive_player') {
    throw new Error('Should be alive_player');
  }
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
  if (history.getStats().snapshotCount === 0) {
    throw new Error('Should have snapshots');
  }

  history.clear();
  if (history.getStats().snapshotCount !== 0) {
    throw new Error('Should have no snapshots after clear');
  }
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
  if (!state) {
    throw new Error('Should find player state');
  }
  if (state.id !== 'player1') {
    throw new Error('Should have correct player ID');
  }
  if (state.x !== 100 || state.y !== 100) {
    throw new Error('Should have correct position');
  }
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
  if (state !== null) {
    throw new Error('Should return null for non-existent player');
  }
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

  if (elapsed >= 100) {
    throw new Error(`Should complete quickly, took ${elapsed}ms`);
  }
  if (memoryUsageMB >= 50) {
    throw new Error(`Memory should stay under 50MB, got ${memoryUsageMB.toFixed(4)} MB`);
  }
  console.log('  ✓ PASS\n');
}

// Test 8: Find snapshot returns null when empty
{
  console.log('Test 8: Find snapshot returns null when empty...');
  const history = new StateHistory(200, 15);
  const snapshot = history.findSnapshot(Date.now());
  if (snapshot !== null) {
    throw new Error('Should return null when no snapshots exist');
  }
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

  if (stats.memoryUsageBytes === 0) {
    throw new Error('Should have non-zero memory usage');
  }
  if (stats.snapshotCount !== 1) {
    throw new Error('Should have 1 snapshot');
  }
  console.log(`  Memory for 10 players: ${stats.memoryUsageBytes} bytes`);
  console.log('  ✓ PASS\n');
}

console.log('✅ All StateHistory tests passed!');
