import { Player, SpermState, PlayerInput, Vector2, TrailPoint } from 'shared';
import { PHYSICS as S_PHYSICS, TRAIL as S_TRAIL, TICK as S_TICK } from 'shared/dist/constants.js';

// =================================================================================================
// SLITHER.IO-STYLE PHYSICS CONSTANTS
// =================================================================================================

const TICK_INTERVAL_S = S_TICK.INTERVAL_MS / 1000;

// Slither-like movement - simpler, more predictable
const MOVEMENT = {
  // Base speed when not accelerating
  BASE_SPEED: 80,
  // Max speed during normal acceleration
  MAX_SPEED: S_PHYSICS.MAX_SPEED,
  // Turn rate - higher = more responsive
  TURN_RATE: S_PHYSICS.TURN_SPEED * 1.5,
  // Speed loss per tick (friction)
  FRICTION: 0.98,
  // Acceleration force
  ACCEL_FORCE: S_PHYSICS.ACCELERATION * 0.8,
};

const TRAIL = {
  BASE_LIFETIME: S_TRAIL.BASE_LIFETIME_MS,
  FINAL_LIFETIME: S_TRAIL.FINAL_CIRCLE_LIFETIME_MS,
  EMIT_INTERVAL: S_TRAIL.EMIT_INTERVAL_MS,
  FADE_OUT_DURATION: S_TRAIL.FADE_OUT_DURATION_MS,
};

const BOOST = {
  MULTIPLIER: 1.6,
  DURATION_MS: 1000,
  COOLDOWN_MS: 800,
  TRAIL_BONUS_MS: 1000,
  ENERGY_MAX: 100,
  ENERGY_REGEN_PER_S: 35,
  ENERGY_CONSUME_PER_S: 60,
  MIN_START_ENERGY: 15,
};

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
];

// =================================================================================================
// PLAYER ENTITY - SLITHER.IO STYLE
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
  private shrinkFactor: number = 1;
  private speedMultiplier: number = 1;
  private lastInputAngle: number | null = null;

  // Slither-style smooth turning
  private currentTurnRate: number = 0;
  private readonly MAX_TURN_DELTA = Math.PI * 0.15; // Max turn per tick (~8.5 degrees)

  constructor(id: string, spawnPosition: Vector2, spawnAngle?: number) {
    this.id = id;
    this.isAlive = true;
    this.trail = [];
    this.input = {
      target: { ...spawnPosition },
      accelerate: true,
    };
    
    const initialAngle = Number.isFinite(spawnAngle as number) 
      ? (spawnAngle as number) 
      : (Math.random() * Math.PI * 2);
    
    this.sperm = {
      position: { ...spawnPosition },
      velocity: { x: Math.cos(initialAngle) * MOVEMENT.BASE_SPEED, y: Math.sin(initialAngle) * MOVEMENT.BASE_SPEED },
      angle: initialAngle,
      angularVelocity: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
    
    this.timeSinceLastTrailEmit = 0;
    this.targetAngle = initialAngle;
    this.lastInputAngle = initialAngle;
    this.spawnAtMs = Date.now();
    this.lastBounceAt = 0;
    this.lastLungeAt = 0;
  }

  setInput(input: PlayerInput): void {
    this.input = input;

    // Calculate desired angle from mouse/target position
    const tx = Number.isFinite(input.target.x) ? input.target.x : this.sperm.position.x;
    const ty = Number.isFinite(input.target.y) ? input.target.y : this.sperm.position.y;

    const desiredAngle = Math.atan2(ty - this.sperm.position.y, tx - this.sperm.position.x);

    // Smooth angle transition with rate limiting (Slither.io style)
    let angleDiff = desiredAngle - (this.lastInputAngle ?? this.sperm.angle);
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Limit turn rate for smooth snake-like movement
    const maxTurn = this.MAX_TURN_DELTA * (this.isBoosting() ? 1.3 : 1.0);
    const clampedDiff = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
    
    this.targetAngle = (this.lastInputAngle ?? this.sperm.angle) + clampedDiff;
    this.lastInputAngle = this.targetAngle;
  }

  /**
   * SLITHER.IO-STYLE UPDATE
   * Simple, predictable physics
   */
  update(deltaTime: number, shrinkFactor: number): void {
    if (!this.isAlive) return;

    this.shrinkFactor = shrinkFactor;
    const nowMs = Date.now();
    const isBoostingNow = this.boostUntil !== null && nowMs < this.boostUntil && this.boostEnergy > 0;

    // --- 1. SMOOTH TURNING ---
    // Gradually rotate toward target angle
    let angleDiff = this.targetAngle - this.sperm.angle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Apply turn with smoothing
    const turnSpeed = MOVEMENT.TURN_RATE * (isBoostingNow ? 1.2 : 1.0) * deltaTime;
    const turnAmount = Math.max(-turnSpeed, Math.min(turnSpeed, angleDiff));
    this.sperm.angle += turnAmount;

    // --- 2. ACCELERATION ---
    if (this.input.accelerate) {
      const accelMagnitude = MOVEMENT.ACCEL_FORCE * (isBoostingNow ? BOOST.MULTIPLIER : 1);
      this.sperm.velocity.x += Math.cos(this.sperm.angle) * accelMagnitude * deltaTime;
      this.sperm.velocity.y += Math.sin(this.sperm.angle) * accelMagnitude * deltaTime;
    }

    // --- 3. SIMPLE FRICTION (Slither style) ---
    // Uniform friction in all directions - simpler than anisotropic
    const friction = isBoostingNow ? 0.99 : MOVEMENT.FRICTION;
    this.sperm.velocity.x *= friction;
    this.sperm.velocity.y *= friction;

    // --- 4. MINIMUM SPEED ---
    // Slither snakes always move, never stop completely
    const currentSpeed = Math.hypot(this.sperm.velocity.x, this.sperm.velocity.y);
    const minSpeed = MOVEMENT.BASE_SPEED * (isBoostingNow ? BOOST.MULTIPLIER : 1);
    const maxSpeed = MOVEMENT.MAX_SPEED * (this.speedMultiplier || 1) * (isBoostingNow ? BOOST.MULTIPLIER : 1);

    // Apply speed limits
    let newSpeed = currentSpeed;
    if (newSpeed < minSpeed && this.input.accelerate) {
      // Maintain minimum speed when accelerating
      const scale = minSpeed / (currentSpeed || 1);
      this.sperm.velocity.x *= scale;
      this.sperm.velocity.y *= scale;
    } else if (newSpeed > maxSpeed) {
      // Cap at max speed
      const scale = maxSpeed / currentSpeed;
      this.sperm.velocity.x *= scale;
      this.sperm.velocity.y *= scale;
    }

    // --- 5. UPDATE POSITION ---
    this.sperm.position.x += this.sperm.velocity.x * deltaTime;
    this.sperm.position.y += this.sperm.velocity.y * deltaTime;

    // --- 6. TRAIL UPDATE ---
    this.timeSinceLastTrailEmit += deltaTime * 1000;
    this.updateTrail();

    // --- 7. BOOST ENERGY MANAGEMENT ---
    if (isBoostingNow) {
      this.boostEnergy = Math.max(0, this.boostEnergy - BOOST.ENERGY_CONSUME_PER_S * deltaTime);
      if (this.boostEnergy <= 0) {
        this.boostUntil = null;
      }
    } else {
      this.boostEnergy = Math.min(BOOST.ENERGY_MAX, this.boostEnergy + BOOST.ENERGY_REGEN_PER_S * deltaTime);
    }

    this.wasBoosting = isBoostingNow;

    // Update status for HUD
    const isBoosting = this.boostUntil !== null && nowMs < this.boostUntil;
    const cooldownMs = Math.max(0, this.nextBoostAvailableAt - nowMs);
    this.status = {
      boosting: isBoosting,
      boostCooldownMs: cooldownMs,
      boostMaxCooldownMs: BOOST.COOLDOWN_MS,
    };
  }

  eliminate(): void {
    if (!this.isAlive) return;
    this.isAlive = false;
    
    const now = Date.now();
    this.trail.forEach(point => {
      point.expiresAt = now + TRAIL.FADE_OUT_DURATION;
    });
  }

  cleanExpiredTrails(): void {
    const now = Date.now();
    const trail = this.trail;
    let writeIdx = 0;

    for (let readIdx = 0; readIdx < trail.length; readIdx++) {
      if (now < trail[readIdx].expiresAt) {
        if (writeIdx !== readIdx) {
          trail[writeIdx] = trail[readIdx];
        }
        writeIdx++;
      }
    }

    trail.length = writeIdx;
  }

  private updateTrail(): void {
    if (!this.isAlive) return;
    
    // Short spawn delay
    if (Date.now() - this.spawnAtMs < 300) return;
    
    if (this.timeSinceLastTrailEmit >= TRAIL.EMIT_INTERVAL) {
      this.timeSinceLastTrailEmit = 0;

      const now = Date.now();
      const boosting = this.boostUntil !== null && now < this.boostUntil;
      
      // Dynamic lifetime based on arena shrink
      const t = Math.min(1, Math.max(0, (1 - this.shrinkFactor) / 0.5));
      const lifetime = Math.floor(TRAIL.BASE_LIFETIME + (TRAIL.FINAL_LIFETIME - TRAIL.BASE_LIFETIME) * t);

      this.trail.push({
        x: this.sperm.position.x,
        y: this.sperm.position.y,
        expiresAt: now + lifetime + (boosting ? BOOST.TRAIL_BONUS_MS : 0),
        createdAt: now,
      });
    }
  }

  // --- BOOST/LUNGE METHODS ---

  tryActivateBoost(): boolean {
    const now = Date.now();
    if (now < this.nextBoostAvailableAt) return false;
    if (this.boostEnergy < BOOST.MIN_START_ENERGY) return false;

    // Spend energy
    this.boostEnergy = Math.max(0, this.boostEnergy - 25);

    // Slither-style speed boost (not lunge)
    this.boostUntil = now + BOOST.DURATION_MS;
    this.nextBoostAvailableAt = now + BOOST.COOLDOWN_MS;
    this.lastLungeAt = now;

    return true;
  }

  isBoosting(): boolean {
    return this.boostUntil !== null && Date.now() < this.boostUntil;
  }

  isLunging(): boolean {
    return Date.now() - this.lastLungeAt < 300;
  }

  getBoostEnergy(): number {
    return this.boostEnergy;
  }

  canLunge(minEnergy: number = 15): boolean {
    const now = Date.now();
    return this.isAlive && this.boostEnergy >= minEnergy && now >= this.nextBoostAvailableAt;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0.5, Math.min(1.2, multiplier || 1));
  }

  absorbDNA(): void {
    // Refill energy and reduce cooldown
    this.boostEnergy = Math.min(BOOST.ENERGY_MAX, this.boostEnergy + BOOST.ENERGY_MAX * 0.3);
    
    const now = Date.now();
    if (this.nextBoostAvailableAt > now) {
      this.nextBoostAvailableAt = Math.max(now, this.nextBoostAvailableAt - 400);
    }
  }
}
