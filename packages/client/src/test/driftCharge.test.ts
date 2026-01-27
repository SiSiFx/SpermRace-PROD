/**
 * Unit tests for Drift Charge feature
 * Drift Charge: builds when turning > 30 degrees for 1+ seconds
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Physics } from '../game/Physics';
import { Car, BoostPad } from '../game/types';
import * as PIXI from 'pixi.js';

describe('Drift Charge', () => {
  let physics: Physics;
  let mockCar: Car;
  let boostPads: BoostPad[];

  // 30 degrees in radians (the threshold for drift charge)
  const HARD_TURN_THRESHOLD = 30 * (Math.PI / 180);

  beforeEach(() => {
    physics = new Physics();
    boostPads = [];

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
      sprite,
      driftCharge: 0,
      maxDriftCharge: 100,
      hardTurnTime: 0,
      requiredHardTurnDuration: 1.0
    };
  });

  describe('Basic drift charge initialization', () => {
    it('should initialize drift charge properties if undefined', () => {
      const carWithoutCharge = {
        ...mockCar,
        driftCharge: undefined,
        maxDriftCharge: undefined,
        hardTurnTime: undefined,
        requiredHardTurnDuration: undefined
      } as Car;

      physics.updateCar(carWithoutCharge, 1/60, boostPads);

      expect(carWithoutCharge.driftCharge).toBe(0);
      expect(carWithoutCharge.maxDriftCharge).toBe(100);
      expect(carWithoutCharge.hardTurnTime).toBe(0);
      expect(carWithoutCharge.requiredHardTurnDuration).toBe(1.0);
    });
  });

  describe('Hard turn detection (> 30 degrees)', () => {
    it('should detect hard turn when angle difference exceeds 30 degrees', () => {
      // Set current angle to 0 and target to 60 degrees (> 30 degree threshold)
      mockCar.angle = 0;
      mockCar.targetAngle = 60 * (Math.PI / 180); // 60 degrees in radians

      physics.updateCar(mockCar, 0.1, boostPads);

      // hardTurnTime should have increased
      expect(mockCar.hardTurnTime).toBeGreaterThan(0);
    });

    it('should NOT detect hard turn when angle difference is less than 30 degrees', () => {
      // Set angle difference to 20 degrees (< 30 degree threshold)
      mockCar.angle = 0;
      mockCar.targetAngle = 20 * (Math.PI / 180); // 20 degrees in radians

      const initialHardTurnTime = mockCar.hardTurnTime ?? 0;
      physics.updateCar(mockCar, 0.1, boostPads);

      // hardTurnTime should be reset to 0
      expect(mockCar.hardTurnTime).toBe(0);
    });

    it('should NOT detect hard turn when angle difference equals exactly 30 degrees', () => {
      // Set angle difference to exactly 30 degrees (threshold, not greater)
      mockCar.angle = 0;
      mockCar.targetAngle = HARD_TURN_THRESHOLD;

      physics.updateCar(mockCar, 0.1, boostPads);

      // hardTurnTime should be reset to 0 (not > threshold)
      expect(mockCar.hardTurnTime).toBe(0);
    });

    it('should reset hard turn time when angle difference drops below threshold', () => {
      // Start with a hard turn
      mockCar.angle = 0;
      mockCar.targetAngle = Math.PI / 2; // 90 degrees
      physics.updateCar(mockCar, 0.5, boostPads);
      expect(mockCar.hardTurnTime).toBeGreaterThan(0);

      // Now move the car close to the target angle so difference is below threshold
      mockCar.angle = Math.PI / 2 - 0.1; // Close to target, ~5.7 degrees difference
      mockCar.targetAngle = Math.PI / 2;
      physics.updateCar(mockCar, 0.1, boostPads);

      // hardTurnTime should be reset
      expect(mockCar.hardTurnTime).toBe(0);
    });
  });

  describe('Drift charge building after 1 second threshold', () => {
    it('should NOT build drift charge in first second of hard turn', () => {
      mockCar.angle = 0;
      mockCar.targetAngle = Math.PI / 2; // 90 degrees
      mockCar.driftCharge = 0;

      // Update for 0.5 seconds (less than 1 second threshold)
      for (let i = 0; i < 30; i++) {
        physics.updateCar(mockCar, 1/60, boostPads);
      }

      // Should not have built any charge yet
      expect(mockCar.driftCharge).toBe(0);
    });

    it('should start building drift charge after 1 second of hard turn', () => {
      mockCar.angle = 0;
      mockCar.targetAngle = Math.PI / 2; // 90 degrees
      mockCar.driftCharge = 0;

      // First, build up hardTurnTime without moving (simulate a persistent hard turn)
      // We keep the car stationary relative to target by resetting angle each update
      let timeAccumulator = 0;
      const dt = 1/60;
      while (timeAccumulator < 1.1) {
        // Reset angle to maintain large angle difference
        mockCar.angle = 0;
        physics.updateCar(mockCar, dt, boostPads);
        timeAccumulator += dt;
      }

      // Should have built some charge
      expect(mockCar.driftCharge).toBeGreaterThan(0);
    });

    it('should build charge faster with sharper turns', () => {
      // Test with 45 degree turn
      mockCar.angle = 0;
      mockCar.targetAngle = 45 * (Math.PI / 180);
      mockCar.driftCharge = 0;
      mockCar.hardTurnTime = 1.0; // Skip to charged state

      physics.updateCar(mockCar, 0.1, boostPads);
      const chargeAt45 = mockCar.driftCharge ?? 0;

      // Reset for 90 degree turn
      mockCar.angle = 0;
      mockCar.targetAngle = Math.PI / 2; // 90 degrees
      mockCar.driftCharge = 0;
      mockCar.hardTurnTime = 1.0; // Skip to charged state

      physics.updateCar(mockCar, 0.1, boostPads);
      const chargeAt90 = mockCar.driftCharge ?? 0;

      // 90 degree turn should build charge faster than 45 degree
      expect(chargeAt90).toBeGreaterThan(chargeAt45);
    });

    it('should cap drift charge at maxDriftCharge', () => {
      mockCar.angle = 0;
      mockCar.targetAngle = Math.PI; // 180 degrees (very sharp turn)
      mockCar.driftCharge = 99;
      mockCar.hardTurnTime = 1.0;

      physics.updateCar(mockCar, 1.0, boostPads);

      // Should cap at 100
      expect(mockCar.driftCharge).toBe(100);
    });
  });

  describe('Charge behavior when not turning', () => {
    it('should reset hard turn time when moving straight', () => {
      mockCar.angle = 0;
      mockCar.targetAngle = 0; // Moving straight
      mockCar.hardTurnTime = 0.5;

      physics.updateCar(mockCar, 0.1, boostPads);

      expect(mockCar.hardTurnTime).toBe(0);
    });

    it('should not build charge when angle difference is small', () => {
      mockCar.angle = 0;
      mockCar.targetAngle = 10 * (Math.PI / 180); // Small turn
      mockCar.driftCharge = 50;

      physics.updateCar(mockCar, 0.1, boostPads);

      // hardTurnTime should be reset
      expect(mockCar.hardTurnTime).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative angle differences correctly', () => {
      mockCar.angle = Math.PI / 4; // 45 degrees
      mockCar.targetAngle = -Math.PI / 4; // -45 degrees
      mockCar.driftCharge = 0;
      mockCar.hardTurnTime = 1.0;

      physics.updateCar(mockCar, 0.1, boostPads);

      // Should build charge (90 degree difference, even though negative)
      expect(mockCar.driftCharge).toBeGreaterThan(0);
    });

    it('should handle wrapped angles correctly', () => {
      mockCar.angle = Math.PI - 0.1; // Near 180 degrees
      mockCar.targetAngle = -Math.PI + 0.1; // Near -180 degrees (essentially same direction)
      mockCar.driftCharge = 0;

      physics.updateCar(mockCar, 0.1, boostPads);

      // With normalizeAngle, the diff should be small, so no charge
      expect(mockCar.hardTurnTime).toBe(0);
    });

    it('should not update drift charge for destroyed cars', () => {
      mockCar.destroyed = true;
      mockCar.angle = 0;
      mockCar.targetAngle = Math.PI / 2;
      mockCar.driftCharge = 50;
      mockCar.hardTurnTime = 1.0;

      physics.updateCar(mockCar, 0.1, boostPads);

      // Charge should not change
      expect(mockCar.driftCharge).toBe(50);
    });
  });
});
