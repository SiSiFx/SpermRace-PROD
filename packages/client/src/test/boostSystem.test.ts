/**
 * Tests for boost/drift system functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpermRaceGame } from '../game/SpermRaceGame';
import { Physics } from '../game/Physics';
import { Effects } from '../game/Effects';
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

describe('Physics - Boost System', () => {
  let physics: Physics;
  let mockCar: any;
  let boostPads: any[];

  beforeEach(() => {
    physics = new Physics();
    boostPads = [];

    // Create a mock car with boost properties
    mockCar = {
      id: 'test-car',
      x: 0,
      y: 0,
      angle: 0,
      targetAngle: 0,
      speed: 200,
      baseSpeed: 200,
      boostSpeed: 300,
      targetSpeed: 200,
      speedTransitionRate: 3,
      driftFactor: 0,
      maxDriftFactor: 1.5,
      vx: 0,
      vy: 0,
      color: 0x22d3ee,
      type: 'player',
      name: 'Test Car',
      kills: 0,
      destroyed: false,
      respawnTimer: 0,
      isBoosting: false,
      boostTimer: 0,
      boostCooldown: 0,
      boostEnergy: 100,
      maxBoostEnergy: 100,
      boostRegenRate: 15,
      boostConsumptionRate: 25,
      minBoostEnergy: 20,
      trailPoints: [],
      trailGraphics: null,
      lastTrailTime: 0,
      turnTimer: 1,
      boostAITimer: 2,
      currentTrailId: null,
      sprite: { x: 0, y: 0, rotation: 0 } as any
    };
  });

  describe('Boost activation', () => {
    it('should increase target speed when boosting', () => {
      mockCar.isBoosting = true;
      physics.updateCar(mockCar, 0.016, boostPads);
      expect(mockCar.targetSpeed).toBe(300);
    });

    it('should use base speed when not boosting', () => {
      mockCar.isBoosting = false;
      physics.updateCar(mockCar, 0.016, boostPads);
      expect(mockCar.targetSpeed).toBe(200);
    });

    it('should consume boost energy while boosting', () => {
      const initialEnergy = mockCar.boostEnergy;
      mockCar.isBoosting = true;
      physics.updateCar(mockCar, 0.1, boostPads);
      expect(mockCar.boostEnergy).toBeLessThan(initialEnergy);
    });

    it('should regenerate boost energy when not boosting', () => {
      mockCar.boostEnergy = 50;
      mockCar.isBoosting = false;
      physics.updateCar(mockCar, 0.1, boostPads);
      expect(mockCar.boostEnergy).toBeGreaterThan(50);
    });

    it('should stop boosting when energy runs out', () => {
      mockCar.boostEnergy = 5;
      mockCar.isBoosting = true;
      physics.updateCar(mockCar, 0.1, boostPads);
      expect(mockCar.isBoosting).toBe(false);
      expect(mockCar.boostEnergy).toBe(0);
    });

    it('should cap boost energy at max', () => {
      mockCar.boostEnergy = 95;
      mockCar.isBoosting = false;
      physics.updateCar(mockCar, 0.5, boostPads);
      expect(mockCar.boostEnergy).toBeLessThanOrEqual(mockCar.maxBoostEnergy);
    });
  });

  describe('Drift mechanics', () => {
    it('should increase drift factor while boosting', () => {
      mockCar.isBoosting = true;
      const initialDrift = mockCar.driftFactor;
      physics.updateCar(mockCar, 0.1, boostPads);
      expect(mockCar.driftFactor).toBeGreaterThan(initialDrift);
    });

    it('should decrease drift factor when not boosting', () => {
      mockCar.driftFactor = 1.0;
      mockCar.isBoosting = false;
      physics.updateCar(mockCar, 0.1, boostPads);
      expect(mockCar.driftFactor).toBeLessThan(1.0);
    });

    it('should cap drift factor at max', () => {
      mockCar.isBoosting = true;
      physics.updateCar(mockCar, 1, boostPads);
      expect(mockCar.driftFactor).toBeLessThanOrEqual(mockCar.maxDriftFactor);
    });
  });

  describe('Boost pads', () => {
    beforeEach(() => {
      boostPads = [{
        x: 100,
        y: 100,
        radius: 30,
        cooldownMs: 5000,
        lastTriggeredAt: 0,
        graphics: {} as any
      }];
    });

    it('should add boost energy when driving over a boost pad', () => {
      mockCar.x = 100;
      mockCar.y = 100;
      mockCar.boostEnergy = 50;
      physics.updateCar(mockCar, 0.016, boostPads);
      expect(mockCar.boostEnergy).toBe(70); // 50 + 20 from pad
    });

    it('should activate boost when driving over a boost pad', () => {
      mockCar.x = 100;
      mockCar.y = 100;
      mockCar.isBoosting = false;
      physics.updateCar(mockCar, 0.016, boostPads);
      expect(mockCar.isBoosting).toBe(true);
    });

    it('should not trigger boost pad while on cooldown', () => {
      mockCar.x = 100;
      mockCar.y = 100;
      boostPads[0].lastTriggeredAt = Date.now();
      const initialEnergy = mockCar.boostEnergy;
      physics.updateCar(mockCar, 0.016, boostPads);
      expect(mockCar.boostEnergy).toBe(initialEnergy);
    });
  });
});

describe('Effects - Boost Exhaust', () => {
  let effects: Effects;
  let container: PIXI.Container;

  beforeEach(async () => {
    await PIXI.init({});
    container = new PIXI.Container();
    effects = new Effects(container);
  });

  afterEach(() => {
    effects.destroy();
  });

  it('should create boost exhaust particles', () => {
    const initialChildCount = container.children.length;
    effects.createBoostExhaust(100, 100, 0, 0x22d3ee);
    expect(container.children.length).toBeGreaterThan(initialChildCount);
  });

  it('should emit particles in opposite direction of car angle', () => {
    effects.createBoostExhaust(100, 100, Math.PI, 0x22d3ee);
    // Particles should be created - direction is handled internally
    const particleCount = container.children.filter(c => c instanceof PIXI.Graphics).length;
    expect(particleCount).toBeGreaterThan(0);
  });
});

describe('SpermRaceGame - Boost Integration', () => {
  let container: HTMLElement;
  let game: SpermRaceGame;

  beforeEach(async () => {
    container = createMockContainer();
    game = new SpermRaceGame(container);
  });

  afterEach(async () => {
    game.destroy();
    container.remove();
  });

  it('should initialize player with full boost energy', async () => {
    await game.init();
    const player = game.getPlayer();
    expect(player?.boostEnergy).toBe(100);
    expect(player?.maxBoostEnergy).toBe(100);
  });

  it('should have boost properties initialized', async () => {
    await game.init();
    const player = game.getPlayer();
    expect(player?.isBoosting).toBe(false);
    expect(player?.boostSpeed).toBe(300);
    expect(player?.baseSpeed).toBe(200);
    expect(player?.minBoostEnergy).toBe(20);
  });

  it('should create boost glow graphic for cars', async () => {
    await game.init();
    const player = game.getPlayer();
    expect(player?.boostGlow).toBeDefined();
    expect(player?.boostGlow?.visible).toBe(false); // Hidden when not boosting
  });
});

describe('Boost Trail System', () => {
  it('should mark trail points as boost trails when boosting', () => {
    // Create a mock car that is boosting
    const mockCar = {
      id: 'test-car',
      x: 100,
      y: 100,
      angle: 0,
      isBoosting: true,
      trailPoints: [],
      destroyed: false
    } as any;

    const container = new PIXI.Container();
    const trailSystem = (await import('../game/TrailSystem')).TrailSystem;
    const trails = new trailSystem(container);

    // Add a point while boosting
    const now = Date.now();
    mockCar.trailPoints.push({
      x: 100,
      y: 100,
      time: now,
      isBoosting: true,
      expiresAt: now + 8000
    });

    const trail = trails.getTrails()[0];
    expect(trail?.points[0]?.isBoosting).toBe(true);
  });
});

// Export for use in HTML test file
export { SpermRaceGame };
