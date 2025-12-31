import { Player, SpermState, PlayerInput, Vector2, TrailPoint } from 'shared';
import { PHYSICS as S_PHYSICS, TRAIL as S_TRAIL, TICK as S_TICK } from 'shared/dist/constants.js';

// =================================================================================================
// GAME CONSTANTS
// =================================================================================================

const PHYSICS_CONSTANTS = { ...S_PHYSICS } as const;
const TICK_INTERVAL_S = S_TICK.INTERVAL_MS / 1000;

const TRAIL_CONSTANTS = {
  BASE_LIFETIME: S_TRAIL.BASE_LIFETIME_MS,
  FINAL_CIRCLE_LIFETIME: S_TRAIL.FINAL_CIRCLE_LIFETIME_MS,
  EMIT_INTERVAL: S_TRAIL.EMIT_INTERVAL_MS, // denser trails
  FADE_OUT_DURATION: S_TRAIL.FADE_OUT_DURATION_MS,
};

const BOOST = {
  MULTIPLIER: 1.8,          // Slightly stronger boost
  DURATION_MS: 1400,        // Longer boost duration
  COOLDOWN_MS: 1200,        // Lunge rhythm cooldown (1.2s)
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
  lastLungeAt: number;

  private timeSinceLastTrailEmit: number;
  private targetAngle: number;
  private boostUntil: number | null = null;
  private nextBoostAvailableAt: number = 0;
  private boostEnergy: number = BOOST.ENERGY_MAX;
  private wasBoosting: boolean = false;
  // Current arena shrink factor (1..0.5); provided by GameWorld each tick
  private shrinkFactor: number = 1;
  // Temporary speed multiplier from schooling (1..1.2)
  private speedMultiplier: number = 1;
  // Last raw input-derived aim angle for anti-cheat smoothing
  private lastInputAngle: number | null = null;

  constructor(id: string, spawnPosition: Vector2, spawnAngle?: number) {
    this.id = id;
    this.isAlive = true;
    this.trail = [];
    this.input = {
      target: { ...spawnPosition },
      accelerate: true,
    };
    const initialAngle = Number.isFinite(spawnAngle as number) ? (spawnAngle as number) : (Math.random() * Math.PI * 2);
    this.sperm = {
      position: spawnPosition,
      velocity: { x: 0, y: 0 },
      angle: initialAngle,
      angularVelocity: 0,
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    };
    this.timeSinceLastTrailEmit = 0;
    this.targetAngle = this.sperm.angle;
    this.lastInputAngle = this.targetAngle;
    this.spawnAtMs = Date.now();
    this.lastBounceAt = 0;
    this.lastLungeAt = 0;
  }

  /**
   * Updates the player's input state.
   * @param input The new input state from the client.
   */
  setInput(input: PlayerInput): void {
    this.input = input;

    // Sanitize target to avoid NaNs or extreme coordinates
    const tx = Number.isFinite(input.target.x) ? input.target.x : this.sperm.position.x;
    const ty = Number.isFinite(input.target.y) ? input.target.y : this.sperm.position.y;

    // Calculate the desired angle based on the pointer position
    const desiredAngle = Math.atan2(ty - this.sperm.position.y, tx - this.sperm.position.x);

    // Anti-cheat: clamp how fast the *input* can rotate per tick; server already clamps physics below
    if (this.lastInputAngle == null) {
      this.targetAngle = desiredAngle;
    } else {
      let diff = desiredAngle - this.lastInputAngle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const maxInputTurn = PHYSICS_CONSTANTS.MAX_TURN_RATE_RAD_PER_S * TICK_INTERVAL_S;
      const clamped = Math.max(-maxInputTurn, Math.min(maxInputTurn, diff));
      this.targetAngle = this.lastInputAngle + clamped;
    }
    this.lastInputAngle = this.targetAngle;
  }

  /**
   * Updates the spermatozoide's physics for a single frame.
   * @param deltaTime The time elapsed since the last frame in seconds.
   */
  update(deltaTime: number, shrinkFactor: number): void {
    if (!this.isAlive) return;

    // Sync shrink factor from GameWorld for trail lifetime logic
    this.shrinkFactor = shrinkFactor;

    const drifting = !!this.input.drift;

    // --- 1. Smoothly Interpolate Angle (speed-scaled) ---
    let angleDiff = this.targetAngle - this.sperm.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    const speed = Math.hypot(this.sperm.velocity.x, this.sperm.velocity.y);
    const turnScale = 1 / (1 + (speed / (PHYSICS_CONSTANTS.MAX_SPEED)) * PHYSICS_CONSTANTS.SPEED_TURN_SCALE);
    const lowSpeedFactor = 1 + PHYSICS_CONSTANTS.LOW_SPEED_TURN_BONUS * (1 - Math.min(1, speed / PHYSICS_CONSTANTS.MAX_SPEED));
    const turnSpeed = PHYSICS_CONSTANTS.TURN_SPEED * (drifting ? 2.5 : 1);
    const desiredChange = angleDiff * turnSpeed * turnScale * lowSpeedFactor * deltaTime;
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
    const longitudinalDrag = drifting ? 0.92 : PHYSICS_CONSTANTS.LONGITUDINAL_DRAG;
    const lateralDrag = drifting ? 0.92 : PHYSICS_CONSTANTS.LATERAL_DRAG;
    const vForwardAfter = vForward * longitudinalDrag;
    const vSideAfter = vSide * lateralDrag;
    // Recompose
    this.sperm.velocity.x = vForwardAfter * headingX - vSideAfter * headingY;
    this.sperm.velocity.y = vForwardAfter * headingY + vSideAfter * headingX;

    // --- 4. Clamp to Max Speed (recompute after accel/drag) ---
    const speedNow = Math.hypot(this.sperm.velocity.x, this.sperm.velocity.y);
    const maxSpeed = PHYSICS_CONSTANTS.MAX_SPEED * (this.speedMultiplier || 1) * BOOST.MULTIPLIER;
    if (speedNow > maxSpeed) {
      const ratio = maxSpeed / speedNow;
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
    // Matches SPAWN_SELF_COLLISION_GRACE_MS from constants
    if (Date.now() - this.spawnAtMs < 2200) return;
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
    const COST = 30;
    if (this.boostEnergy < COST) return;

    // Spend energy upfront
    this.boostEnergy = Math.max(0, this.boostEnergy - COST);

    // Apply instantaneous lunge impulse in facing direction
    const impulse = 750;
    const vxImpulse = Math.cos(this.sperm.angle) * impulse;
    const vyImpulse = Math.sin(this.sperm.angle) * impulse;
    this.sperm.velocity.x += vxImpulse;
    this.sperm.velocity.y += vyImpulse;

    // Set lunge rhythm cooldown
    this.nextBoostAvailableAt = now + BOOST.COOLDOWN_MS;
    this.lastLungeAt = now;
  }

  /** Returns true if the player is currently in the aggressive lunge phase. */
  isLunging(): boolean {
    return Date.now() - this.lastLungeAt < 350;
  }

  /** Read-only view of remaining boost energy for AI/telemetry. */
  getBoostEnergy(): number {
    return this.boostEnergy;
  }

  /** Returns true if a lunge boost could be activated with the given minimum energy. */
  canLunge(minEnergy: number = 30): boolean {
    const now = Date.now();
    return this.isAlive && this.boostEnergy >= minEnergy && now >= this.nextBoostAvailableAt;
  }

  /** Temporary per-tick schooling buff: 1.0 (none) to 1.2 (max). */
  setSpeedMultiplier(multiplier: number): void {
    // Clamp to sane bounds to avoid exploits
    const clamped = Math.max(0.5, Math.min(1.2, multiplier || 1));
    this.speedMultiplier = clamped;
  }

  /** Apply rewards for absorbing a DNA fragment. */
  absorbDNA(): void {
    // Refill 25% of the boost tank instantly
    const bonusEnergy = BOOST.ENERGY_MAX * 0.25;
    this.boostEnergy = Math.min(BOOST.ENERGY_MAX, this.boostEnergy + bonusEnergy);

    // Reduce remaining boost cooldown slightly to reward aggressive play
    const now = Date.now();
    if (this.nextBoostAvailableAt > now) {
      const REDUCTION_MS = 500;
      this.nextBoostAvailableAt = Math.max(now, this.nextBoostAvailableAt - REDUCTION_MS);
    }
  }
}
