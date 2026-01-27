import { Car, InputState, BoostPad } from './types';

const HARD_TURN_THRESHOLD = 30 * (Math.PI / 180); // 30 degrees in radians

// Normalize angle to [-PI, PI]
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Burst: Speed boost when releasing a turn
const BURST = {
  MULTIPLIER: 1.3, // 1.3x speed boost on turn release
  DURATION_MS: 600, // 0.6 second burst duration
  TURN_THRESHOLD: 0.05, // Minimum angle change (radians) to count as turning
};

export class Physics {
  updateCar(car: Car, deltaTime: number, boostPads: BoostPad[]): void {
    if (car.destroyed) return;
    const now = Date.now();

    // Initialize drift charge properties if not set
    if (car.driftCharge === undefined) car.driftCharge = 0;
    if (car.maxDriftCharge === undefined) car.maxDriftCharge = 100;
    if (car.hardTurnTime === undefined) car.hardTurnTime = 0;
    if (car.requiredHardTurnDuration === undefined) car.requiredHardTurnDuration = 1.0;

    // Hotspot buff check
    if (car.hotspotBuffExpiresAt && car.hotspotBuffExpiresAt <= now) {
      car.hotspotBuffExpiresAt = undefined;
    }
    const buffActive = !!(car.hotspotBuffExpiresAt && car.hotspotBuffExpiresAt > now);

    // Boost energy management
    if (car.isBoosting) {
      car.boostEnergy -= car.boostConsumptionRate * deltaTime;
      car.targetSpeed = car.boostSpeed;
      if (buffActive) car.targetSpeed *= 1.08;
      car.driftFactor = Math.min(car.maxDriftFactor, car.driftFactor + deltaTime * 2.0);
      if (car.boostEnergy <= 0) {
        car.boostEnergy = 0;
        car.isBoosting = false;
        car.targetSpeed = car.baseSpeed;
      }
    } else {
      car.boostEnergy += car.boostRegenRate * deltaTime;
      if (car.boostEnergy > car.maxBoostEnergy) car.boostEnergy = car.maxBoostEnergy;
      if (car.killBoostUntil && now < car.killBoostUntil) {
        car.targetSpeed = car.boostSpeed * 0.8;
      } else {
        car.targetSpeed = car.baseSpeed;
        if (buffActive) car.targetSpeed *= 1.05;
      }
      car.driftFactor = Math.max(0, car.driftFactor - deltaTime * 1.5);
    }

    // Boost pad check
    for (const pad of boostPads) {
      const dx = car.x - pad.x, dy = car.y - pad.y;
      const distSq = dx * dx + dy * dy;
      if (distSq <= pad.radius * pad.radius && (now - pad.lastTriggeredAt) >= pad.cooldownMs) {
        pad.lastTriggeredAt = now;
        car.boostEnergy = Math.min(car.maxBoostEnergy, car.boostEnergy + 20);
        car.isBoosting = true;
        car.targetSpeed = car.boostSpeed * 1.05;
      }
    }

    // Speed interpolation
    const speedDiff = car.targetSpeed - car.speed;
    car.speed += speedDiff * (car.accelerationScalar ?? car.speedTransitionRate) * deltaTime;

    // Angle interpolation
    const angleDiff = normalizeAngle(car.targetAngle - car.angle);
    const turnRate = car.turnResponsiveness ?? 7.0;
    car.angle += angleDiff * Math.min(1.0, turnRate * deltaTime);

    // Drift Charge: builds when turning > 30 degrees for 1+ seconds
    const absAngleDiff = Math.abs(angleDiff);
    if (absAngleDiff > HARD_TURN_THRESHOLD) {
      // Car is turning sharply (> 30 degrees)
      car.hardTurnTime = (car.hardTurnTime ?? 0) + deltaTime;
      // Only build charge after the required duration (1 second)
      if (car.hardTurnTime >= car.requiredHardTurnDuration!) {
        // Build drift charge based on how sharply we're turning
        const chargeRate = (absAngleDiff - HARD_TURN_THRESHOLD) * 20; // More charge for sharper turns
        car.driftCharge = Math.min(car.maxDriftCharge!, car.driftCharge! + chargeRate * deltaTime);
      }
    } else {
      // Not turning sharply enough, reset the timer
      car.hardTurnTime = 0;
    }

    // Burst: Detect turn release and apply speed boost
    const now = Date.now();
    const isTurning = Math.abs(angleDiff) > BURST.TURN_THRESHOLD;
    const isBursting = car.burstUntil !== undefined && now < car.burstUntil;

    // Trigger burst when releasing a turn
    if (car.wasTurning && !isTurning && !isBursting) {
      car.burstUntil = now + BURST.DURATION_MS;
    }
    car.wasTurning = isTurning;

    // Velocity calculation with drift
    const forwardX = Math.cos(car.angle);
    const forwardY = Math.sin(car.angle);
    const driftAngle = car.angle + Math.PI / 2;
    // Apply burst multiplier to effective speed
    const burstMultiplier = isBursting ? BURST.MULTIPLIER : 1;
    const effectiveSpeed = car.speed * burstMultiplier;
    const driftIntensity = car.driftFactor * effectiveSpeed * 0.4 * Math.abs(angleDiff);
    car.vx = forwardX * effectiveSpeed + Math.cos(driftAngle) * driftIntensity;
    car.vy = forwardY * effectiveSpeed + Math.sin(driftAngle) * driftIntensity;

    // Position update
    car.x += car.vx * deltaTime;
    car.y += car.vy * deltaTime;

    // Sprite sync
    car.sprite.x = car.x;
    car.sprite.y = car.y;
    car.sprite.rotation = car.angle;
  }

  updateBot(car: Car, deltaTime: number, boostPads: BoostPad[]): void {
    if (car.destroyed) return;

    // Random direction changes
    car.turnTimer -= deltaTime;
    if (car.turnTimer <= 0) {
      car.targetAngle += (Math.random() - 0.5) * Math.PI * 0.5;
      car.turnTimer = 1.0 + Math.random() * 2.0;
    }

    // Random boost
    car.boostAITimer -= deltaTime;
    if (car.boostAITimer <= 0) {
      if (!car.isBoosting && car.boostEnergy >= car.minBoostEnergy && Math.random() < 0.3) {
        car.isBoosting = true;
        car.targetSpeed = car.boostSpeed;
        car.boostAITimer = 2.0 + Math.random() * 3.0;
      } else if (car.isBoosting && (car.boostEnergy < 10 || Math.random() < 0.4)) {
        car.isBoosting = false;
        car.targetSpeed = car.baseSpeed;
        car.boostAITimer = 1.0 + Math.random() * 2.0;
      } else {
        car.boostAITimer = 0.5;
      }
    }

    this.updateCar(car, deltaTime, boostPads);
  }
}
