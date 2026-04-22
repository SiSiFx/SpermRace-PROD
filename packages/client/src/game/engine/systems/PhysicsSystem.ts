/**
 * Physics System
 * Handles movement, velocity, and boundary collisions
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import type { Collision } from '../components/Collision';
import type { Boost } from '../components/Boost';
import { updateBoost } from '../components/Boost';
import type { KillPower } from '../components/KillPower';
import { getKillPowerSpeedMult, updateKillPower } from '../components/KillPower';
import type { Abilities } from '../components/Abilities';
import { AbilityType } from '../components/Abilities';
import { ComponentNames, createComponentMask } from '../components';
import { SpatialGrid } from '../spatial/SpatialGrid';
import { CAR_PHYSICS } from '../config';

/**
 * Physics configuration
 */
export interface PhysicsConfig {
  /** World width */
  worldWidth: number;

  /** World height */
  worldHeight: number;

  /** Boundary margin */
  boundaryMargin: number;

  /** Whether to clamp position to bounds */
  clampToBounds: boolean;
}

/**
 * Physics system for movement and boundary handling
 */
export class PhysicsSystem extends System {
  public readonly priority = SystemPriority.PHYSICS;

  private readonly _config: PhysicsConfig;
  private readonly _positionMask: number;
  private readonly _velocityMask: number;
  private readonly _LATERAL_DRAG = CAR_PHYSICS.LATERAL_DRAG;
  private readonly _BOOST_SPEED_RATIO = CAR_PHYSICS.BOOST_SPEED / CAR_PHYSICS.BASE_SPEED;

  constructor(config: Partial<PhysicsConfig> = {}) {
    super(SystemPriority.PHYSICS);

    this._config = {
      worldWidth: config.worldWidth ?? 3500,
      worldHeight: config.worldHeight ?? 2500,
      boundaryMargin: config.boundaryMargin ?? 50,
      clampToBounds: config.clampToBounds ?? true,
    };

    // Build component masks
    this._positionMask = createComponentMask(ComponentNames.POSITION);
    this._velocityMask = createComponentMask(ComponentNames.POSITION, ComponentNames.VELOCITY);
  }

  /**
   * Fixed timestep update for deterministic physics
   */
  fixedUpdate(fixedDt: number): void {
    const entities = this.entityManager.queryByMask(this._velocityMask);
    const engine = this.getEngine();
    const spatialGrid = engine?.getSpatialGrid ? engine.getSpatialGrid() as SpatialGrid : undefined;
    const now = Date.now();

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
      const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
      const collision = entity.getComponent<any>(ComponentNames.COLLISION);
      const killPower = entity.getComponent<KillPower>(ComponentNames.KILL_POWER);

      if (!position || !velocity) continue;

      // Update kill power state
      if (killPower) {
        updateKillPower(killPower, now);
      }

      const abilities = entity.getComponent<Abilities>(ComponentNames.ABILITIES);

      // Drain / regenerate boost energy each physics tick
      if (boost) updateBoost(boost, fixedDt);

      // Apply boost multiplier
      const boostMult = boost ? (boost.isBoosting ? boost.speedMultiplier : 1) : 1;
      const isBoosting = boost ? boost.isBoosting : false;

      // Overdrive: Tank ability — speed boost without consuming boost energy.
      // Checked directly from abilities.active so it works independently of isBoosting.
      const isOverdriving = abilities ? abilities.active.has(AbilityType.OVERDRIVE) : false;

      // Apply kill power speed burst
      const killPowerMult = killPower ? getKillPowerSpeedMult(killPower, now) : 1.0;
      const speedMult = boostMult * killPowerMult;

      // Update velocity based on target angle
      this._updateVelocity(velocity, fixedDt, isBoosting, speedMult, isOverdriving);

      // Apply velocity to position
      position.x += velocity.vx * fixedDt;
      position.y += velocity.vy * fixedDt;

      // Handle boundary collision
      this._handleBoundary(entity, position, velocity);

      // Update spatial grid with new position
      if (spatialGrid && collision) {
        spatialGrid.updateEntity(entity.id, position.x, position.y, collision.radius);
      }
    }
  }

  /**
   * Variable update for non-critical physics
   */
  update(dt: number): void {
    // Smooth angle interpolation happens here
    const entities = this.entityManager.queryByMask(this._velocityMask);

    for (const entity of entities) {
      const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
      if (!velocity) continue;

      // Angular velocity turn — caps how fast you can change direction per second
      const maxTurnThisFrame = CAR_PHYSICS.TURN_SPEED * dt;
      let diff = velocity.targetAngle - velocity.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      velocity.angle += Math.sign(diff) * Math.min(Math.abs(diff), maxTurnThisFrame);
    }
  }

  /**
   * Update velocity based on current angle and target speed
   */
  private _updateVelocity(
    velocity: Velocity,
    dt: number,
    isBoosting: boolean,
    speedMultiplier: number,
    isOverdriving: boolean = false
  ): void {
    const headingX = Math.cos(velocity.angle);
    const headingY = Math.sin(velocity.angle);

    // 1. Apply forward acceleration (matching server)
    // Overdrive gives 1.8× acceleration — noticeably faster than base, less frantic than boost
    const accelMagnitude = velocity.acceleration * (isBoosting ? 2.45 : isOverdriving ? 1.8 : 1);
    velocity.vx += headingX * accelMagnitude * dt;
    velocity.vy += headingY * accelMagnitude * dt;

    // 2. Apply anisotropic drag (different for forward vs sideways)
    const vForward = velocity.vx * headingX + velocity.vy * headingY;
    const vSide = -velocity.vx * headingY + velocity.vy * headingX;

    // Use different drag for forward vs lateral
    const longitudinalDrag = velocity.drag; // ~0.988 (forward)
    const lateralDrag = this._LATERAL_DRAG; // reduce side-slip for cleaner steering read

    const vForwardAfter = vForward * longitudinalDrag;
    const vSideAfter = vSide * lateralDrag;

    // Reconstruct velocity from components
    velocity.vx = vForwardAfter * headingX - vSideAfter * headingY;
    velocity.vy = vForwardAfter * headingY + vSideAfter * headingX;

    // 3. Clamp to max speed
    // Overdrive raises the cap to 1.6× base — reaches ~672px/s vs 420px/s normal
    const speed = Math.hypot(velocity.vx, velocity.vy);
    const maxSpeed = velocity.maxSpeed * (isBoosting ? this._BOOST_SPEED_RATIO : isOverdriving ? 1.6 : 1);
    let finalSpeed = speed;
    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      velocity.vx *= ratio;
      velocity.vy *= ratio;
      finalSpeed = maxSpeed;
    }

    velocity.speed = finalSpeed;
  }

  /**
   * Handle boundary collision
   */
  private _handleBoundary(
    entity: any,
    position: Position,
    velocity: Velocity
  ): void {
    const margin = this._config.boundaryMargin;
    const maxX = this._config.worldWidth - margin;
    const maxY = this._config.worldHeight - margin;
    const minX = margin;
    const minY = margin;

    let hitBoundary = false;

    // Check X bounds
    if (position.x < minX) {
      position.x = minX;
      velocity.vx *= -0.5; // Bounce with damping
      hitBoundary = true;
    } else if (position.x > maxX) {
      position.x = maxX;
      velocity.vx *= -0.5;
      hitBoundary = true;
    }

    // Check Y bounds
    if (position.y < minY) {
      position.y = minY;
      velocity.vy *= -0.5;
      hitBoundary = true;
    } else if (position.y > maxY) {
      position.y = maxY;
      velocity.vy *= -0.5;
      hitBoundary = true;
    }

    // Update angle if we bounced
    if (hitBoundary) {
      velocity.angle = Math.atan2(velocity.vy, velocity.vx);
    }
  }

  /**
   * Set world bounds
   */
  setWorldBounds(width: number, height: number): void {
    this._config.worldWidth = width;
    this._config.worldHeight = height;
  }

  /**
   * Get current config
   */
  getConfig(): Readonly<PhysicsConfig> {
    return this._config;
  }
}

/**
 * Factory function to create a physics system
 */
export function createPhysicsSystem(config?: Partial<PhysicsConfig>): PhysicsSystem {
  return new PhysicsSystem(config);
}
