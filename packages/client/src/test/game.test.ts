/**
 * Unit tests for game modules
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Physics } from '../game/Physics';
import { InputHandler } from '../game/InputHandler';
import { Camera } from '../game/Camera';
import { Collision } from '../game/Collision';
import { Car, Trail, TrailPoint, BoostPad, ArenaBounds } from '../game/types';
import * as PIXI from 'pixi.js';

describe('Physics', () => {
  let physics: Physics;
  let mockCar: Car;
  let boostPads: BoostPad[];

  beforeEach(() => {
    physics = new Physics();
    boostPads = [{
      x: 100,
      y: 100,
      radius: 30,
      cooldownMs: 5000,
      lastTriggeredAt: 0,
      graphics: new PIXI.Graphics()
    }];

    // Create a mock car
    const sprite = new PIXI.Container();
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
      name: 'Test',
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
      sprite
    };
  });

  it('should update car position based on speed and angle', () => {
    mockCar.angle = 0; // Facing right
    mockCar.targetAngle = 0;

    physics.updateCar(mockCar, 1/60, boostPads);

    // Car should have moved to the right (positive x)
    expect(mockCar.x).toBeGreaterThan(0);
    expect(mockCar.y).toBe(0);
  });

  it('should update car angle towards target angle', () => {
    mockCar.angle = 0;
    mockCar.targetAngle = Math.PI / 2; // 90 degrees

    physics.updateCar(mockCar, 1/60, boostPads);

    // Angle should have changed towards target
    expect(mockCar.angle).toBeGreaterThan(0);
    expect(mockCar.angle).toBeLessThan(Math.PI / 2);
  });

  it('should consume boost energy when boosting', () => {
    mockCar.isBoosting = true;
    const initialEnergy = mockCar.boostEnergy;

    physics.updateCar(mockCar, 1/60, boostPads);

    expect(mockCar.boostEnergy).toBeLessThan(initialEnergy);
    expect(mockCar.speed).toBeGreaterThan(mockCar.baseSpeed);
  });

  it('should regenerate boost energy when not boosting', () => {
    mockCar.boostEnergy = 50;
    mockCar.isBoosting = false;
    const initialEnergy = mockCar.boostEnergy;

    physics.updateCar(mockCar, 1/60, boostPads);

    expect(mockCar.boostEnergy).toBeGreaterThan(initialEnergy);
  });

  it('should trigger boost pad when car is within radius', () => {
    mockCar.x = 100;
    mockCar.y = 100;
    mockCar.boostEnergy = 50;
    const initialEnergy = mockCar.boostEnergy;

    physics.updateCar(mockCar, 1/60, boostPads);

    // Should gain energy from boost pad
    expect(mockCar.boostEnergy).toBeGreaterThan(initialEnergy);
  });

  it('should not update destroyed cars', () => {
    mockCar.destroyed = true;
    mockCar.x = 0;
    mockCar.y = 0;

    physics.updateCar(mockCar, 1/60, boostPads);

    expect(mockCar.x).toBe(0);
    expect(mockCar.y).toBe(0);
  });
});

describe('InputHandler', () => {
  let inputHandler: InputHandler;
  let mockCanvas: HTMLCanvasElement;

  beforeEach(() => {
    inputHandler = new InputHandler();
    mockCanvas = document.createElement('canvas');
  });

  afterEach(() => {
    inputHandler.destroy();
  });

  it('should setup event listeners', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const canvasSpy = vi.spyOn(mockCanvas, 'addEventListener');

    inputHandler.setup(mockCanvas);

    expect(addEventListenerSpy).toHaveBeenCalled();
    expect(canvasSpy).toHaveBeenCalled();
  });

  it('should return input state with default values', () => {
    inputHandler.setup(mockCanvas);

    // Get input state (will use default mouse position of 0,0)
    const input = inputHandler.getInput(100, 100, 0, 0, 1, 800, 600);

    // With default mouse at 0,0: (0 - 400 - 0) / 1 = -400, (0 - 300 - 0) / 1 = -300
    expect(input.targetX).toBe(-400);
    expect(input.targetY).toBe(-300);
    expect(input.accelerate).toBe(false);
    // boost should be falsy when no keys pressed
    expect(!input.boost).toBe(true);
  });

  it('should detect boost key press', () => {
    inputHandler.setup(mockCanvas);

    // Simulate space key press
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));

    const input = inputHandler.getInput(0, 0, 0, 0, 1, 800, 600);

    expect(input.boost).toBe(true);
  });

  it('should clean up event listeners on destroy', () => {
    inputHandler.setup(mockCanvas);
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    inputHandler.destroy();

    expect(removeEventListenerSpy).toHaveBeenCalled();
  });
});

describe('Camera', () => {
  let camera: Camera;
  let mockContainer: PIXI.Container;

  beforeEach(() => {
    camera = new Camera();
    mockContainer = new PIXI.Container();
  });

  it('should initialize with default values', () => {
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.zoom).toBe(0.55);
  });

  it('should follow target', () => {
    const target = { x: 100, y: 100 };

    camera.update(target, mockContainer, 800, 600);

    // Camera should have moved towards target
    expect(camera.x).not.toBe(0);
    expect(camera.y).not.toBe(0);
  });

  it('should apply shake', () => {
    camera.shake(1);

    expect(camera.shakeX).not.toBe(0);
    expect(camera.shakeY).not.toBe(0);
  });

  it('should convert world to screen coordinates', () => {
    const screenPos = camera.worldToScreen(0, 0, 800, 600);

    expect(screenPos.x).toBe(400); // Center of 800px screen
    expect(screenPos.y).toBe(300); // Center of 600px screen
  });

  it('should adjust zoom based on target speed', () => {
    const fastTarget = { x: 0, y: 0, speed: 500 };
    const slowTarget = { x: 0, y: 0, speed: 100 };

    camera.update(fastTarget, mockContainer, 800, 600);
    const fastZoom = camera.zoom;

    camera.zoom = 0.55; // Reset
    camera.update(slowTarget, mockContainer, 800, 600);
    const slowZoom = camera.zoom;

    expect(fastZoom).toBeLessThan(slowZoom);
  });
});

describe('Collision', () => {
  let collision: Collision;
  let mockCars: Car[];
  let mockTrails: Trail[];
  let mockArena: ArenaBounds;

  beforeEach(() => {
    collision = new Collision();
    mockArena = { width: 8000, height: 6000 };

    // Create mock cars
    const sprite1 = new PIXI.Container();
    const sprite2 = new PIXI.Container();
    const car1: Car = {
      id: 'car1',
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
      name: 'Car1',
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
      sprite: sprite1
    };

    const car2: Car = {
      id: 'car2',
      x: 100,
      y: 100,
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
      color: 0xff00ff,
      type: 'bot',
      name: 'Car2',
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
      sprite: sprite2
    };

    mockCars = [car1, car2];

    // Create mock trail
    const graphics = new PIXI.Graphics();
    const trailPoints: TrailPoint[] = [
      { x: 0, y: 10, time: Date.now(), isBoosting: false },
      { x: 0, y: 20, time: Date.now(), isBoosting: false },
      { x: 0, y: 30, time: Date.now(), isBoosting: false }
    ];

    mockTrails = [{
      carId: 'car2',
      car: car2,
      points: trailPoints,
      graphics
    }];
  });

  it('should detect collision between car and trail', () => {
    // Move car1 into car2's trail
    mockCars[0].x = 0;
    mockCars[0].y = 25;

    const results = collision.checkTrailCollisions(mockCars, mockTrails);

    expect(results.length).toBeGreaterThan(0);
  });

  it('should skip own trail (self-collision protection)', () => {
    // Create trail from car1 and check if car1 collides with it
    const graphics = new PIXI.Graphics();
    const trailPoints: TrailPoint[] = [
      { x: 0, y: 10, time: Date.now(), isBoosting: false },
      { x: 0, y: 20, time: Date.now(), isBoosting: false }
    ];

    const ownTrail: Trail = {
      carId: 'car1',
      car: mockCars[0],
      points: trailPoints,
      graphics
    };

    // Car is at origin, trail starts at y=10
    mockCars[0].x = 0;
    mockCars[0].y = 0;

    const results = collision.checkTrailCollisions(mockCars, [ownTrail]);

    // Should not collide with own trail (first 5 points skipped)
    expect(results).toHaveLength(0);
  });

  it('should check arena bounds', () => {
    mockCars[0].x = 5000; // Outside arena (width is 8000, so bounds are -4000 to 4000)

    const isOutOfBounds = collision.checkArenaBounds(mockCars[0], mockArena);

    expect(isOutOfBounds).toBe(true);
  });

  it('should return false for car inside arena', () => {
    mockCars[0].x = 0;
    mockCars[0].y = 0;

    const isOutOfBounds = collision.checkArenaBounds(mockCars[0], mockArena);

    expect(isOutOfBounds).toBe(false);
  });

  it('should ignore destroyed cars in collision check', () => {
    mockCars[0].destroyed = true;
    mockCars[0].x = 0;
    mockCars[0].y = 25;

    const results = collision.checkTrailCollisions(mockCars, mockTrails);

    // Destroyed car should not be in results
    expect(results.every(r => r.victim.id !== 'car1')).toBe(true);
  });
});
