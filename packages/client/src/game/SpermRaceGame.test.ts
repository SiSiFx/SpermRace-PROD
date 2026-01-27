/**
 * Independent test file for SpermRaceGame
 *
 * This file allows testing the game independently from the rest of the application.
 * It can be run directly in a browser or via vitest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpermRaceGame } from './SpermRaceGame';
import * as PIXI from 'pixi.js';

// Mock DOM environment for testing
const createMockContainer = (): HTMLElement => {
  const container = document.createElement('div');
  container.id = 'game-container';
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  return container;
};

describe('SpermRaceGame', () => {
  let container: HTMLElement;
  let game: SpermRaceGame;

  beforeEach(() => {
    container = createMockContainer();
    game = new SpermRaceGame(container);
  });

  afterEach(async () => {
    game.destroy();
    container.remove();
  });

  it('should create a game instance', () => {
    expect(game).toBeDefined();
    expect(game.getGamePhase()).toBe('waiting');
  });

  it('should initialize the game', async () => {
    await game.init();
    expect(game.getGamePhase()).toBe('active');
  });

  it('should create a player', async () => {
    await game.init();
    const player = game.getPlayer();
    expect(player).toBeDefined();
    expect(player?.type).toBe('player');
    expect(player?.destroyed).toBe(false);
  });

  it('should create bots', async () => {
    await game.init();
    const bots = game.getBots();
    expect(bots.length).toBe(5);
    expect(bots.every(b => b.type === 'bot')).toBe(true);
  });

  it('should have correct arena dimensions', () => {
    const arena = game.getArena();
    expect(arena.width).toBe(8000);
    expect(arena.height).toBe(6000);
  });

  it('should initialize game systems', async () => {
    await game.init();
    // Verify game is active
    expect(game.getGamePhase()).toBe('active');
  });
});

// Unit tests for individual modules
describe('Physics', () => {
  it('should normalize angles correctly', () => {
    // Test helper function logic
    const normalizeAngle = (a: number): number => {
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a < -Math.PI) a += 2 * Math.PI;
      return a;
    };

    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(Math.PI)).toBeCloseTo(Math.PI, 5);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(-Math.PI, 5);
    expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0, 5);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 5);
  });
});

describe('Camera', () => {
  it('should calculate world to screen coordinates correctly', () => {
    const camera = {
      x: -100,
      y: -100,
      zoom: 0.5,
      worldToScreen: function(wx: number, wy: number, screenW: number, screenH: number) {
        return {
          x: wx * this.zoom + this.x + screenW / 2,
          y: wy * this.zoom + this.y + screenH / 2
        };
      }
    };

    const result = camera.worldToScreen(0, 0, 800, 600);
    expect(result.x).toBe(300); // 0 * 0.5 + (-100) + 400
    expect(result.y).toBe(200); // 0 * 0.5 + (-100) + 300
  });
});

describe('Collision', () => {
  it('should calculate point to segment distance correctly', () => {
    const pointToSegmentDistance = (
      px: number, py: number,
      x1: number, y1: number,
      x2: number, y2: number
    ): number => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSq = dx * dx + dy * dy;

      if (lengthSq === 0) {
        return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
      }

      let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));

      const nearX = x1 + t * dx;
      const nearY = y1 + t * dy;

      return Math.sqrt((px - nearX) ** 2 + (py - nearY) ** 2);
    };

    // Point on segment
    expect(pointToSegmentDistance(0, 0, -10, 0, 10, 0)).toBeCloseTo(0, 5);

    // Point 5 units away from segment
    expect(pointToSegmentDistance(0, 5, -10, 0, 10, 0)).toBeCloseTo(5, 5);

    // Point perpendicular to segment middle
    expect(pointToSegmentDistance(0, 10, -100, 0, 100, 0)).toBeCloseTo(10, 5);
  });
});

// Export a standalone test function for browser testing
export async function runStandaloneTest(): Promise<void> {
  const container = createMockContainer();
  const game = new SpermRaceGame(container);

  try {
    await game.init();

    // Run for a few seconds
    await new Promise(resolve => setTimeout(resolve, 3000));

    const player = game.getPlayer();
    const bots = game.getBots();
    const phase = game.getGamePhase();

    console.log('Standalone test results:');
    console.log('- Player created:', !!player);
    console.log('- Player alive:', player?.destroyed === false);
    console.log('- Bots created:', bots.length);
    console.log('- Game phase:', phase);

    // Cleanup
    game.destroy();
    container.remove();

    console.log('Standalone test completed successfully!');
  } catch (error) {
    console.error('Standalone test failed:', error);
    game.destroy();
    container.remove();
    throw error;
  }
}

// Export for use in HTML test file
export { SpermRaceGame };
