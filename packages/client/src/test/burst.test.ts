import { describe, it, expect, beforeEach } from 'vitest';
import { Physics } from '../game/Physics';
import type { Car } from '../game/types';
import * as PIXI from 'pixi.js';

// Mock PIXI.Container
vi.mock('pixi.js', () => ({
  Container: class MockContainer {
    x = 0;
    y = 0;
    rotation = 0;
    addChild() {}
  },
  Graphics: class MockGraphics {},
}));

describe('Physics - Burst Mechanic', () => {
  let physics: Physics;
  let car: Car;
  let mockSprite: PIXI.Container;

  beforeEach(() => {
    physics = new Physics();
    mockSprite = new PIXI.Container();

    car = {
      id: 'test-car',
      x: 1000,
      y: 1000,
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
      name: 'TestCar',
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
      sprite: mockSprite,
      burstUntil: undefined,
      wasTurning: false,
    };
  });

  describe('Burst Trigger on Turn Release', () => {
    it('should trigger burst when car stops turning', () => {
      const deltaTime = 0.016; // ~60fps

      // First update: car is turning (targetAngle is different from current angle)
      car.targetAngle = Math.PI / 4; // 45 degrees
      physics.updateCar(car, deltaTime, []);

      // Second update: car stops turning (targetAngle aligns with current angle)
      // The burst should be triggered here
      car.targetAngle = car.angle; // No longer turning
      physics.updateCar(car, deltaTime, []);

      // The car should have a burstUntil set
      expect(car.burstUntil).toBeDefined();
      expect(car.burstUntil!).toBeGreaterThan(Date.now());
    });

    it('should not trigger burst when car was not turning', () => {
      const deltaTime = 0.016;

      // Update without turning (targetAngle equals current angle)
      car.targetAngle = car.angle;
      physics.updateCar(car, deltaTime, []);

      // Next update also without turning
      physics.updateCar(car, deltaTime, []);

      // No burst should have been triggered
      expect(car.burstUntil).toBeUndefined();
    });
  });

  describe('Burst Duration and Multiplier', () => {
    it('should apply burst speed multiplier during burst', () => {
      const deltaTime = 0.016;
      const baseSpeed = 200;
      const burstMultiplier = 1.3;

      car.speed = baseSpeed;
      car.angle = 0;

      // Set burst to active
      car.burstUntil = Date.now() + 600;

      // Update during burst
      physics.updateCar(car, deltaTime, []);

      // Check that velocity is increased by burst multiplier
      const velocityMagnitude = Math.hypot(car.vx, car.vy);
      const expectedMinVelocity = baseSpeed * burstMultiplier * 0.9; // Account for transition
      expect(velocityMagnitude).toBeGreaterThanOrEqual(expectedMinVelocity);
    });

    it('should not apply burst multiplier after burst expires', () => {
      const deltaTime = 0.016;
      const baseSpeed = 200;

      car.speed = baseSpeed;
      car.angle = 0;

      // Set burst to expired
      car.burstUntil = Date.now() - 100;

      // Update after burst expires
      physics.updateCar(car, deltaTime, []);

      // Check that velocity is at base speed (not burst speed)
      const velocityMagnitude = Math.hypot(car.vx, car.vy);
      expect(velocityMagnitude).toBeLessThan(baseSpeed * 1.3 * 0.95);
    });

    it('should use correct burst duration (600ms)', () => {
      // Trigger burst
      car.targetAngle = Math.PI / 4;
      physics.updateCar(car, 0.016, []);
      car.targetAngle = car.angle;
      physics.updateCar(car, 0.016, []);

      const burstEndTime = car.burstUntil!;
      const expectedEndTime = Date.now() + 600;

      // Allow 50ms tolerance for test execution time
      expect(burstEndTime).toBeGreaterThanOrEqual(expectedEndTime - 50);
      expect(burstEndTime).toBeLessThanOrEqual(expectedEndTime + 50);
    });
  });

  describe('Turn Threshold', () => {
    it('should detect turning when angle diff exceeds threshold', () => {
      const deltaTime = 0.016;
      const turnThreshold = 0.05; // radians

      // Set target angle above threshold
      car.targetAngle = car.angle + turnThreshold + 0.01;
      physics.updateCar(car, deltaTime, []);

      expect(car.wasTurning).toBe(true);
    });

    it('should not detect turning when angle diff is below threshold', () => {
      const deltaTime = 0.016;
      const turnThreshold = 0.05; // radians

      // Set target angle below threshold
      car.targetAngle = car.angle + turnThreshold - 0.01;
      physics.updateCar(car, deltaTime, []);

      expect(car.wasTurning).toBe(false);
    });
  });

  describe('Burst State Management', () => {
    it('should correctly set wasTurning state', () => {
      const deltaTime = 0.016;

      // Initially not turning
      expect(car.wasTurning).toBe(false);

      // Start turning
      car.targetAngle = Math.PI / 2;
      physics.updateCar(car, deltaTime, []);

      expect(car.wasTurning).toBe(true);

      // Stop turning
      car.targetAngle = car.angle;
      physics.updateCar(car, deltaTime, []);

      // After stopping turn, wasTurning should be false
      expect(car.wasTurning).toBe(false);
      // And burst should have been triggered
      expect(car.burstUntil).toBeDefined();
    });
  });
});
