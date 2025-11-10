import { Player, SpermState, PlayerInput, Vector2, TrailPoint } from 'shared';
import { PHYSICS as S_PHYSICS, TRAIL as S_TRAIL } from 'shared/dist/constants.js';

// =================================================================================================
// GAME CONSTANTS
// =================================================================================================

const PHYSICS_CONSTANTS = { ...S_PHYSICS } as const;

const TRAIL_CONSTANTS = {
  BASE_LIFETIME: S_TRAIL.BASE_LIFETIME_MS,
  FINAL_CIRCLE_LIFETIME: S_TRAIL.FINAL_CIRCLE_LIFETIME_MS,
  EMIT_INTERVAL: S_TRAIL.EMIT_INTERVAL_MS, // denser trails
  FADE_OUT_DURATION: S_TRAIL.FADE_OUT_DURATION_MS,
};

const BOOST = {
  MULTIPLIER: 1.8,          // Slightly stronger boost
  DURATION_MS: 1400,        // Longer boost duration
  COOLDOWN_MS: 2500,        // Faster cooldown for more dynamic gameplay
  TRAIL_LIFETIME_BONUS_MS: 1500,
  ENERGY_MAX: 100,
  ENERGY_REGEN_PER_S: 28,     // Faster regen when not boosting
  ENERGY_CONSUME_PER_S: 55,   // Slightly higher consumption while boosting
  MIN_START_ENERGY: 20,
};

const CAR_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
];

// =================================================================================================
// PLAYER CLASS
// =================================================================================================

export class PlayerEntity implements Player {
  id: string;
  sperm: SpermState;
  trail: TrailPoint[];
  isAlive: boolean;
  input: PlayerInput;
  status?: { boosting: boolean; boostCooldownMs: number; boostMaxCooldownMs: number };
  spawnAtMs: number;
  lastBounceAt: number;

  private timeSinceLastTrailEmit: number;
  private targetAngle: number;
  private boostUntil: number | null = null;
  private nextBoostAvailableAt: number = 0;
  private boostEnergy: number = BOOST.ENERGY_MAX;
  private wasBoosting: boolean = false;
  // Current arena shrink factor (1..0.5); provided by GameWorld each tick
  private shrinkFactor: number = 1;

  constructor(id: string, spawnPosition: Vector2) {
    this.id = id;
    this.isAlive = true;
    this.trail = [];
    this.input = {
      target: { ...spawnPosition },
      accelerate: true,
    };
    this.sperm = {
      position: spawnPosition,
      velocity: { x: 0, y: 0 },
      angle: Math.random() * Math.PI * 2,
      angularVelocity: 0,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    };
    this.timeSinceLastTrailEmit = 0;
    this.targetAngle = this.sperm.angle;
    this.spawnAtMs = Date.now();
    this.lastBounceAt = 0;
  }

  /**
   * Updates the player's input state.
   * @param input The new input state from the client.
   */
  setInput(input: PlayerInput): void {
    this.input = input;
    // Calculate the target angle based on the mouse position
    const dx = this.input.target.x - this.sperm.position.x;
    const dy = this.input.target.y - this.sperm.position.y;
    this.targetAngle = Math.atan2(dy, dx);
  }

  /**
   * Updates the spermatozoide's physics for a single frame.
   * @param deltaTime The time elapsed since the last frame in seconds.
   */
  update(deltaTime: number, shrinkFactor: number): void {
    if (!this.isAlive) return;

    // Sync shrink factor from GameWorld for trail lifetime logic
    this.shrinkFactor = shrinkFactor;

    // --- 1. Smoothly Interpolate Angle (speed-scaled) ---
    let angleDiff = this.targetAngle - this.sperm.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const speed = Math.hypot(this.sperm.velocity.x, this.sperm.velocity.y);
    const turnScale = 1 / (1 + (speed / (PHYSICS_CONSTANTS.MAX_SPEED)) * PHYSICS_CONSTANTS.SPEED_TURN_SCALE);
    const lowSpeedFactor = 1 + PHYSICS_CONSTANTS.LOW_SPEED_TURN_BONUS * (1 - Math.min(1, speed / PHYSICS_CONSTANTS.MAX_SPEED));
    const desiredChange = angleDiff * PHYSICS_CONSTANTS.TURN_SPEED * turnScale * lowSpeedFactor * deltaTime;
    const maxChange = PHYSICS_CONSTANTS.MAX_TURN_RATE_RAD_PER_S * deltaTime;
    const appliedChange = Math.max(-maxChange, Math.min(maxChange, desiredChange));
    this.sperm.angle += appliedChange;

    // --- 2. Apply Acceleration (forward thrust only) ---
    const nowMs = Date.now();
    const isBoostingNow = this.boostUntil !== null && nowMs < this.boostUntil && this.boostEnergy > 0;
    if (this.input.accelerate) {
      const accelerationVector: Vector2 = {
        x: Math.cos(this.sperm.angle) * PHYSICS_CONSTANTS.ACCELERATION * (isBoostingNow ? BOOST.MULTIPLIER : 1),
        y: Math.sin(this.sperm.angle) * PHYSICS_CONSTANTS.ACCELERATION * (isBoostingNow ? BOOST.MULTIPLIER : 1),
      };
      this.sperm.velocity.x += accelerationVector.x * deltaTime;
      this.sperm.velocity.y += accelerationVector.y * deltaTime;
    }
    
    // --- 3. Apply Anisotropic Drag (swimming feel) ---
    const headingX = Math.cos(this.sperm.angle);
    const headingY = Math.sin(this.sperm.angle);
    // Decompose velocity into forward (longitudinal) and sideways (lateral)
    const vForward = this.sperm.velocity.x * headingX + this.sperm.velocity.y * headingY;
    const vSide = -this.sperm.velocity.x * headingY + this.sperm.velocity.y * headingX;
    const vForwardAfter = vForward * PHYSICS_CONSTANTS.LONGITUDINAL_DRAG;
    const vSideAfter = vSide * PHYSICS_CONSTANTS.LATERAL_DRAG;
    // Recompose
    this.sperm.velocity.x = vForwardAfter * headingX - vSideAfter * headingY;
    this.sperm.velocity.y = vForwardAfter * headingY + vSideAfter * headingX;

    // --- 4. Clamp to Max Speed (recompute after accel/drag) ---
    const speedNow = Math.hypot(this.sperm.velocity.x, this.sperm.velocity.y);
    if (speedNow > PHYSICS_CONSTANTS.MAX_SPEED) {
      const ratio = PHYSICS_CONSTANTS.MAX_SPEED / speedNow;
      this.sperm.velocity.x *= ratio;
      this.sperm.velocity.y *= ratio;
    }

    // --- 5. Update Position ---
    this.sperm.position.x += this.sperm.velocity.x * deltaTime;
    this.sperm.position.y += this.sperm.velocity.y * deltaTime;
    
    // World bounds are handled in collision system
    
    // --- 6. Update Trail ---
    this.timeSinceLastTrailEmit += deltaTime * 1000; // Convert to ms
    this.updateTrail();

    // --- 7. Boost energy management ---
    if (isBoostingNow) {
      this.boostEnergy = Math.max(0, this.boostEnergy - BOOST.ENERGY_CONSUME_PER_S * deltaTime);
      if (this.boostEnergy <= 0) {
        this.boostUntil = null;
      }
    } else {
      // regen when not boosting
      this.boostEnergy = Math.min(BOOST.ENERGY_MAX, this.boostEnergy + BOOST.ENERGY_REGEN_PER_S * deltaTime);
    }

    // Post-boost slowdown (single-tick damp when boost ends)
    if (this.wasBoosting && !isBoostingNow) {
      this.sperm.velocity.x *= 0.9;
      this.sperm.velocity.y *= 0.9;
    }
    this.wasBoosting = isBoostingNow;

    // Update status for HUD
    const now = Date.now();
    const isBoosting = this.boostUntil !== null && now < this.boostUntil;
    const cooldownMs = Math.max(0, this.nextBoostAvailableAt - now);
    this.status = {
      boosting: isBoosting,
      boostCooldownMs: cooldownMs,
      boostMaxCooldownMs: BOOST.COOLDOWN_MS,
    };
  }

  /**
   * Marks the player as eliminated.
   */
  eliminate(): void {
    if (!this.isAlive) return;

    this.isAlive = false;
    
    // Set all current trail points to expire after a short delay
    const now = Date.now();
    this.trail.forEach(point => {
      point.expiresAt = now + TRAIL_CONSTANTS.FADE_OUT_DURATION;
    });
  }

  /**
   * Cleans up expired trail points. Should be called periodically.
   */
  cleanExpiredTrails(): void {
    const now = Date.now();
    this.trail = this.trail.filter(point => now < point.expiresAt);
  }

  private updateTrail(): void {
    if (!this.isAlive) return;
    // Do not emit trails immediately after spawn to prevent spawn-collisions
    if (Date.now() - this.spawnAtMs < 800) return;
    if (this.timeSinceLastTrailEmit >= TRAIL_CONSTANTS.EMIT_INTERVAL) {
      this.timeSinceLastTrailEmit = 0;

      const now = Date.now();
      const boosting = this.boostUntil !== null && now < this.boostUntil;
      // Dynamic lifetime: longer early, shorter late (final circle)
      const worldFactor = this.shrinkFactor;
      const baseLifetime = TRAIL_CONSTANTS.BASE_LIFETIME;
      const finalLifetime = TRAIL_CONSTANTS.FINAL_CIRCLE_LIFETIME;
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      // Map shrinkFactor 1..0.5 to t 0..1
      const t = Math.min(1, Math.max(0, (1 - worldFactor) / 0.5));
      const lifetime = Math.floor(lerp(baseLifetime, finalLifetime, t));

      const newPoint: TrailPoint = {
        ...this.sperm.position,
        expiresAt: now + lifetime + (boosting ? BOOST.TRAIL_LIFETIME_BONUS_MS : 0),
        createdAt: now,
      };
      this.trail.push(newPoint);
    }
  }

  tryActivateBoost(): void {
    const now = Date.now();
    if (now < this.nextBoostAvailableAt) return;
    if (this.boostEnergy < BOOST.MIN_START_ENERGY) return;
    // Cap boost duration by available energy
    const possibleMs = Math.floor((this.boostEnergy / BOOST.ENERGY_CONSUME_PER_S) * 1000);
    const durationMs = Math.max(0, Math.min(BOOST.DURATION_MS, possibleMs));
    if (durationMs <= 0) return;
    this.boostUntil = now + durationMs;
    this.nextBoostAvailableAt = now + BOOST.COOLDOWN_MS;
  }
}
