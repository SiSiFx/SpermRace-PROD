/**
 * Collision System
 * Handles all collision detection using spatial grid optimization
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import type { Collision } from '../components/Collision';
import { shouldCollide, circleCollisionTest } from '../components/Collision';
import type { Health } from '../components/Health';
import { killEntity, hasSpawnProtection } from '../components/Health';
import type { Boost } from '../components/Boost';
import { SpatialGrid } from '../spatial/SpatialGrid';
import { ComponentNames, createComponentMask } from '../components';
import { BODY_COLLISION_CONFIG } from '../config';
import type { ZoneSystem } from './ZoneSystem';
import { distanceToSegmentSquared } from '../view/math';
import type { TrailSystem } from './TrailSystem';
import type { AbilitySystem } from './AbilitySystem';

/**
 * Collision result
 */
export interface CollisionResult {
  /** Entity that was hit */
  victimId: string;

  /** Entity that caused the hit (null for zone) */
  killerId: string | null;

  /** Collision point */
  x: number;

  /** Collision point */
  y: number;

  /** Type of collision */
  type: 'trail' | 'body' | 'car' | 'powerup' | 'zone' | 'trap';

  /** Timestamp */
  timestamp: number;
}

/**
 * Near-miss event for dopamine feedback
 */
export interface NearMissEvent {
  /** Entity that narrowly escaped */
  entityId: string;

  /** Distance to the threat (pixels) */
  distance: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Collision system config
 */
export interface CollisionSystemConfig {
  /** Spatial grid for lookups */
  spatialGrid: SpatialGrid;

  /** Collision frame counter */
  currentFrame: number;
}

/**
 * Collision system
 * Handles all collision detection with spatial optimization
 */
export class CollisionSystem extends System {
  public readonly priority = SystemPriority.COLLISION;

  private readonly _config: CollisionSystemConfig;

  // Collision results this frame
  private readonly _collisions: CollisionResult[] = [];

  // Near-miss events this frame (for dopamine feedback)
  private _nearMisses: NearMissEvent[] = [];

  // Component masks
  private readonly _carMask: number;

  constructor(spatialGrid: SpatialGrid) {
    super(SystemPriority.COLLISION);

    this._config = {
      spatialGrid,
      currentFrame: 0,
    };

    this._carMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.VELOCITY,
      ComponentNames.COLLISION,
      ComponentNames.HEALTH,
      ComponentNames.PLAYER
    );

  }

  /**
   * Update collisions
   */
  update(_dt: number): void {
    // Clear previous frame results
    this._collisions.length = 0;
    this._nearMisses = [];

    // Increment frame counter
    this._config.currentFrame++;

    // Cache current timestamp for this frame
    const now = Date.now();

    // Check car-trail/body collisions (slither.io-style)
    this._checkTrailCollisions(now);

    // Check car-trap collisions (ability-placed hazards)
    this._checkTrapCollisions(now);

    // Check car-car collisions
    this._checkCarCollisions();

    // Check car-powerup collisions
    this._checkPowerupCollisions(now);

    // Check zone collisions
    this._checkZoneCollisions(now);
  }

  /**
   * Check car-trail/body collisions (slither.io-style)
   * Trail points ARE the body - recent points = body, older points = lethal trail
   * Touching ANY part of enemy body = instant death
   * Self-collision with older body segments = death
   */
  private _checkTrailCollisions(now: number): void {
    const cars = this.entityManager.queryByMask(this._carMask);
    const trailSystem = this.getEngine()?.getSystemManager()?.getSystem<TrailSystem>('trails');
    if (!trailSystem) return;

    for (const car of cars) {
      const position = car.getComponent<Position>(ComponentNames.POSITION);
      const collision = car.getComponent<Collision>(ComponentNames.COLLISION);
      const health = car.getComponent<Health>(ComponentNames.HEALTH);

      if (!position || !collision || !health) continue;
      if (!health.isAlive) continue;
      if (!collision.enabled) continue;

      // Skip spawn protection
      if (hasSpawnProtection(health)) continue;

      let hitDetected = false;
      let nearestNearMissDistance = Number.POSITIVE_INFINITY;

      trailSystem.forEachNearbySegment(position.x, position.y, collision.radius + 50, (segment) => {
        const isSelfTrail = segment.ownerId === car.id;

        if (isSelfTrail) {
          if (segment.segmentIndexFromHead < BODY_COLLISION_CONFIG.SELF_COLLISION_GRACE_SEGMENTS) {
            return;
          }
          if (segment.isBodySegment) {
            return;
          }
        }

        const radiusMult = segment.isBodySegment ? BODY_COLLISION_CONFIG.SEGMENT_RADIUS_MULT : 1.0;
        const combinedRadius = collision.radius + segment.width * radiusMult;
        const combinedRadiusSq = combinedRadius * combinedRadius;
        const distSq = distanceToSegmentSquared(
          position.x,
          position.y,
          segment.x1,
          segment.y1,
          segment.x2,
          segment.y2
        );

        if (!isSelfTrail) {
          const dist = Math.sqrt(distSq);
          const surfaceDistance = dist - combinedRadius;
          if (
            surfaceDistance > 0 &&
            surfaceDistance < BODY_COLLISION_CONFIG.NEAR_MISS_THRESHOLD_PX
          ) {
            nearestNearMissDistance = Math.min(nearestNearMissDistance, surfaceDistance);
          }
        }

        if (distSq >= combinedRadiusSq) {
          return;
        }

        // Shield absorbs this hit
        if (health.shielded || (health.shieldUntil && health.shieldUntil > now)) {
          return false;
        }

        this._collisions.push({
          victimId: car.id,
          killerId: isSelfTrail ? car.id : segment.ownerId,
          x: segment.hitX,
          y: segment.hitY,
          type: segment.isBodySegment ? 'body' : 'trail',
          timestamp: now,
        });

        killEntity(health, isSelfTrail ? car.id : segment.ownerId, true);
        hitDetected = true;
        return false;
      });

      if (!hitDetected && Number.isFinite(nearestNearMissDistance)) {
        this._nearMisses.push({
          entityId: car.id,
          distance: nearestNearMissDistance,
          timestamp: now,
        });
      }
    }
  }

  /**
   * Check car-trap collisions (ability-placed hazards)
   */
  private _checkTrapCollisions(now: number): void {
    const abilitySystem = this.getEngine()?.getSystemManager()?.getSystem<AbilitySystem>('abilities');
    if (!abilitySystem) return;

    const traps = abilitySystem.getTraps();
    if (traps.size === 0) return;

    const cars = this.entityManager.queryByMask(this._carMask);
    const TRAP_POINT_RADIUS = 10;

    for (const car of cars) {
      const position = car.getComponent<Position>(ComponentNames.POSITION);
      const collision = car.getComponent<Collision>(ComponentNames.COLLISION);
      const health = car.getComponent<Health>(ComponentNames.HEALTH);

      if (!position || !collision || !health) continue;
      if (!health.isAlive) continue;
      if (hasSpawnProtection(health)) continue;
      if (health.shielded || (health.shieldUntil && health.shieldUntil > now)) continue;

      const combinedRadius = collision.radius + TRAP_POINT_RADIUS;
      const combinedRadiusSq = combinedRadius * combinedRadius;

      for (const [trapId, trap] of traps) {
        for (const pt of trap.trailPoints) {
          const dx = position.x - pt.x;
          const dy = position.y - pt.y;
          if (dx * dx + dy * dy < combinedRadiusSq) {
            this._collisions.push({
              victimId: car.id,
              killerId: trapId,
              x: pt.x,
              y: pt.y,
              type: 'trap' as any,
              timestamp: now,
            });
            killEntity(health, trapId, true);
            break;
          }
        }
        if (!health.isAlive) break;
      }
    }
  }

  /**
   * Check car-car collisions
   */
  private _checkCarCollisions(): void {
    const cars = this.entityManager.queryByMask(this._carMask);

    // Track checked pairs to avoid duplicate processing
    const checkedPairs = new Set<string>();

    for (let i = 0; i < cars.length; i++) {
      const car1 = cars[i];
      const pos1 = car1.getComponent<Position>(ComponentNames.POSITION);
      const col1 = car1.getComponent<Collision>(ComponentNames.COLLISION);

      if (!pos1 || !col1) continue;

      // Get nearby entities
      const nearby = this._config.spatialGrid.getNearbyEntities(
        pos1.x,
        pos1.y,
        col1.radius + 50
      );

      for (const [nearbyId] of nearby) {
        // Skip self
        if (nearbyId === car1.id) continue;

        // Create pair key (sort IDs to ensure consistent key)
        const pairKey = car1.id < nearbyId
          ? `${car1.id}_${nearbyId}`
          : `${nearbyId}_${car1.id}`;

        // Skip if already checked this pair
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const car2 = this.entityManager.getEntity(nearbyId);
        if (!car2) continue;

        const pos2 = car2.getComponent<Position>(ComponentNames.POSITION);
        const col2 = car2.getComponent<Collision>(ComponentNames.COLLISION);

        if (!pos2 || !col2) continue;

        // Check if they should collide
        if (!shouldCollide(col1, col2)) continue;

        // Circle collision test
        if (circleCollisionTest(pos1.x, pos1.y, col1.radius, pos2.x, pos2.y, col2.radius)) {
          // Push cars apart
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const overlap = (col1.radius + col2.radius) - dist;

          if (overlap > 0) {
            const nx = dx / dist;
            const ny = dy / dist;

            // Update positions (elastic collision)
            pos1.x -= nx * overlap * 0.5;
            pos1.y -= ny * overlap * 0.5;
            pos2.x += nx * overlap * 0.5;
            pos2.y += ny * overlap * 0.5;

            // Update velocities (bounce)
            const vel1 = car1.getComponent<Velocity>(ComponentNames.VELOCITY);
            const vel2 = car2.getComponent<Velocity>(ComponentNames.VELOCITY);

            if (vel1 && vel2) {
              // Simple elastic collision response
              const dvx = vel1.vx - vel2.vx;
              const dvy = vel1.vy - vel2.vy;
              const dot = dvx * nx + dvy * ny;

              vel1.vx -= dot * nx * 0.8;
              vel1.vy -= dot * ny * 0.8;
              vel2.vx += dot * nx * 0.8;
              vel2.vy += dot * ny * 0.8;

              vel1.speed = Math.sqrt(vel1.vx * vel1.vx + vel1.vy * vel1.vy);
              vel2.speed = Math.sqrt(vel2.vx * vel2.vx + vel2.vy * vel2.vy);
              vel1.angle = Math.atan2(vel1.vy, vel1.vx);
              vel2.angle = Math.atan2(vel2.vy, vel2.vx);
            }
          }
        }
      }
    }
  }

  /**
   * Check car-powerup collisions
   */
  private _checkPowerupCollisions(now: number): void {
    const cars = this.entityManager.queryByMask(this._carMask);

    for (const car of cars) {
      const position = car.getComponent<Position>(ComponentNames.POSITION);
      const collision = car.getComponent<Collision>(ComponentNames.COLLISION);
      const health = car.getComponent<Health>(ComponentNames.HEALTH);
      const boost = car.getComponent<Boost>(ComponentNames.BOOST);

      if (!position || !collision || !health || !boost) continue;
      if (!health.isAlive) continue;

      // Get nearby entities (including powerups)
      const nearby = this._config.spatialGrid.getNearbyEntities(
        position.x,
        position.y,
        collision.radius + 30
      );

      for (const [nearbyId, nearbyData] of nearby) {
        const powerupEntity = this.entityManager.getEntity(nearbyId);
        if (!powerupEntity) continue;

        // Powerup detection: entities with Position+Collision but without Velocity/Health/Player
        // This negative logic identifies powerups as non-car entities in the spatial grid
        const hasVel = powerupEntity.hasComponent('Velocity');
        const hasHealth = powerupEntity.hasComponent('Health');
        const hasPlayer = powerupEntity.hasComponent('Player');

        if (hasVel || hasHealth || hasPlayer) continue;

        // This is a powerup - check collision
        const dx = position.x - nearbyData.x;
        const dy = position.y - nearbyData.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < collision.radius + nearbyData.radius) {
          // Collect powerup
          this._collisions.push({
            victimId: car.id,
            killerId: 'powerup',
            x: nearbyData.x,
            y: nearbyData.y,
            type: 'powerup',
            timestamp: now,
          });

          // Remove powerup from spatial grid
          // Note: Powerups are managed by PowerupSystem, not as entities in EntityManager
          // We remove them from the spatial grid so they can't be collected again
          this._config.spatialGrid.removeEntity(powerupEntity.id);
        }
      }
    }
  }

  /**
   * Check zone boundary collisions
   */
  private _checkZoneCollisions(now: number): void {
    const zoneSystem = this.getEngine()?.getSystemManager()?.getSystem<ZoneSystem>('zone');
    if (!zoneSystem) return;

    const zoneInfo = zoneSystem.getDebugInfo();
    const zoneState = zoneInfo.state;

    // Skip if zone not active
    if (zoneState === 'idle' || zoneState === 'warning') return;

    const cars = this.entityManager.queryByMask(this._carMask);

    for (const car of cars) {
      const position = car.getComponent<Position>(ComponentNames.POSITION);
      const health = car.getComponent<Health>(ComponentNames.HEALTH);
      const velocity = car.getComponent<Velocity>(ComponentNames.VELOCITY);

      if (!position || !health) continue;
      if (!health.isAlive) continue;

      // Check if outside zone
      const dx = position.x - zoneInfo.center.x;
      const dy = position.y - zoneInfo.center.y;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      if (distFromCenter > zoneInfo.currentRadius + 50) {
        // Outside zone with margin - eliminate
        this._collisions.push({
          victimId: car.id,
          killerId: 'zone',
          x: position.x,
          y: position.y,
          type: 'zone',
          timestamp: now,
        });

        killEntity(health, 'zone', false);
      } else if (distFromCenter > zoneInfo.currentRadius) {
        // In warning zone — zero the outward velocity component so the entity slides
        // along the zone edge instead of oscillating. Position nudge alone caused
        // high-speed vibration because velocity kept driving the entity back out.
        if (velocity) {
          const outNx = dx / distFromCenter;
          const outNy = dy / distFromCenter;
          const outwardSpeed = velocity.vx * outNx + velocity.vy * outNy;
          if (outwardSpeed > 0) {
            velocity.vx -= outwardSpeed * outNx;
            velocity.vy -= outwardSpeed * outNy;
            velocity.speed = Math.hypot(velocity.vx, velocity.vy);
          }
        }
      }
    }
  }

  /**
   * Get all collisions this frame
   */
  getCollisions(): ReadonlyArray<CollisionResult> {
    return this._collisions;
  }

  /**
   * Clear collisions (called automatically each frame)
   */
  clearCollisions(): void {
    this._collisions.length = 0;
  }

  /**
   * Get current frame number
   */
  getCurrentFrame(): number {
    return this._config.currentFrame;
  }

  /**
   * Get near-miss events this frame (for dopamine feedback)
   */
  getNearMisses(): ReadonlyArray<NearMissEvent> {
    return this._nearMisses;
  }

  /**
   * Clear near-misses (called automatically each frame)
   */
  clearNearMisses(): void {
    this._nearMisses = [];
  }
}

/**
 * Factory function
 */
export function createCollisionSystem(spatialGrid: SpatialGrid): CollisionSystem {
  return new CollisionSystem(spatialGrid);
}
