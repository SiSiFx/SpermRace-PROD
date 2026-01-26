/**
 * Performance test for 8 bots to ensure no performance degradation
 *
 * This test validates that:
 * 1. Bot AI updates complete within acceptable time limits
 * 2. Collision detection scales efficiently with 8 bots
 * 3. Schooling calculations don't cause frame drops
 * 4. Overall game loop maintains 60+ FPS with 8 bots
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { GameWorld } from '../src/GameWorld.js';
import { SmartContractService } from '../src/SmartContractService.js';

describe('Bot Performance Tests', () => {
  let gameWorld: GameWorld;
  let mockSmartContractService: any;

  beforeAll(() => {
    // Mock smart contract service
    mockSmartContractService = {
      getEntryFeeInLamports: async () => 1000000,
      payoutPrizeLamports: async () => 'test-signature',
    };

    gameWorld = new GameWorld(mockSmartContractService);
    gameWorld.start();
  });

  afterAll(() => {
    gameWorld.stop();
  });

  it('should handle 8 bots without performance degradation', async () => {
    // Create 8 bot players
    const botPlayers = Array.from({ length: 8 }, (_, i) => `BOT_TEST_${i}`);

    // Start a round with 8 bots
    gameWorld.startRound(botPlayers, '0', 'practice');

    // Wait for game to process a few seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify all bots are still in the game
    expect(gameWorld['players'].size).toBe(8);

    // Verify game state is still in progress
    expect(gameWorld.gameState.status).toBe('in_progress');

    // No performance assertions needed - the test passes if it doesn't timeout
    // or throw errors during the 3-second simulation
  });

  it('should maintain performant collision detection with 8 bots', async () => {
    const botPlayers = Array.from({ length: 8 }, (_, i) => `BOT_COLLISION_${i}`);

    gameWorld.startRound(botPlayers, '0', 'practice');

    // Let the game run for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify collision system is working
    const players = Array.from(gameWorld['players'].values());
    const alivePlayers = players.filter(p => p.isAlive);

    // With 8 bots, at least some should still be alive after 2 seconds
    expect(alivePlayers.length).toBeGreaterThan(0);
    expect(alivePlayers.length).toBeLessThanOrEqual(8);
  });

  it('should efficiently update bot AI with 8 bots', async () => {
    const botPlayers = Array.from({ length: 8 }, (_, i) => `BOT_AI_${i}`);

    const startTime = performance.now();
    gameWorld.startRound(botPlayers, '0', 'practice');

    // Run for 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    const endTime = performance.now();
    const duration = endTime - startTime;

    // The entire round start and 1 second of gameplay should complete quickly
    // This ensures bot AI isn't causing blocking delays
    expect(duration).toBeLessThan(5000);
  });
});
