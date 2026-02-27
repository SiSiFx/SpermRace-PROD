/**
 * Collision System
 * Handles all collision detection using spatial grid optimization
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import type { Collision } from '../components/Collision';
import { CollisionLayer, shouldCollide, circleCollisionTest } from '../components/Collision';
import type { Trail } from '../components/Trail';
import type { TrailPoint } from '../components/Trail';
import type { Health } from '../components/Health';
import { killEntity, hasSpawnProtection } from '../components/Health';
import type { Player } from '../components/Player';
import { EntityType } from '../components/Player';
import type { Boost } from '../components/Boost';
import { setBoostEnergy } from '../components/Boost';
import { SpatialGrid } from '../spatial/SpatialGrid';
import { ComponentNames, createComponentMask } from '../components';
import { TRAIL_CONFIG, BODY_COLLISION_CONFIG } from '../config';
import type { ZoneSystem } from './ZoneSystem';
import { distanceToSegmentSquared } from '../view/math';

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
  private readonly _trailMask: number;
  private readonly _powerupMask: number;

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

    this._trailMask = createComponentMask(
      ComponentNames.TRAIL
    );

    this._powerupMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.COLLISION,
      ComponentNames.HEALTH,
      ComponentNames.PLAYER
    );
  }

  /**
   * Update collisions
   */
  update(dt: number): void {
    // Clear previous frame results
    this._collisions.length = 0;
    this._nearMisses = [];

    // Increment frame counter
    this._config.currentFrame++;

    // Cache current timestamp for this frame
    const now = Date.now();

    // Check car-trail/body collisions (slither.io-style)
    this._checkTrailCollisions(now);

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

      // Get nearby entities (potential trail owners)
      const nearby = this._config.spatialGrid.getNearbyEntities(
        position.x,
        position.y,
        collision.radius + 50
      );

      for (const [nearbyId, nearbyData] of nearby) {
        if (hitDetected) break;

        const nearbyEntity = this.entityManager.getEntity(nearbyId);
        if (!nearbyEntity) continue;

        const trail = nearbyEntity.getComponent<Trail>(ComponentNames.TRAIL);
        if (!trail || trail.points.length === 0) continue;

        const isSelfTrail = nearbyId === car.id;

        // Check collision with trail segments (CCD for robustness)
        // We check segments between i and i+1 to prevent tunneling
        for (let i = 0; i < trail.points.length - 1; i++) {
          const p1 = trail.points[i];
          const p2 = trail.points[i + 1];
          const p1Age = now - p1.timestamp;

          // Ignore expired segments
          if (p1Age > trail.lifetime) continue;

          // Determine if this is a "body" segment (recent) or "old trail" (lethal)
          // We use p1 (older point) to characterize the segment
          const isBodySegment = p1Age < BODY_COLLISION_CONFIG.BODY_SEGMENT_AGE_MS;
          const segmentIndex = trail.points.length - 1 - i; // Index from head (0 = newest)

          // Self-collision handling
          if (isSelfTrail) {
            // Skip grace segments near head (prevents instant self-death on spawn/turns)
            if (segmentIndex < BODY_COLLISION_CONFIG.SELF_COLLISION_GRACE_SEGMENTS) {
              continue;
            }
            // Only self-collide with older body segments (makes tight turns dangerous)
            if (isBodySegment) continue;
          } else {
            // Enemy collision: ignore very recent points from self (already handled by isSelfTrail)
            if (p1.ownerId === car.id && p1Age < TRAIL_CONFIG.EMIT_INTERVAL_MS * 2) {
              continue;
            }
          }

          // Calculate combined radius
          const radiusMult = isBodySegment ? BODY_COLLISION_CONFIG.SEGMENT_RADIUS_MULT : 1.0;
          // Use max width of segment ends for safety
          const segmentWidth = Math.max(p1.width, p2.width);
          const combinedRadius = collision.radius + segmentWidth * radiusMult;
          const combinedRadiusSq = combinedRadius * combinedRadius;

          // Calculate distance to segment (CCD)
          const distSq = distanceToSegmentSquared(position.x, position.y, p1.x, p1.y, p2.x, p2.y);
          const dist = Math.sqrt(distSq);

          // Near-miss detection (for dopamine feedback)
          const nearMissThreshold = BODY_COLLISION_CONFIG.NEAR_MISS_THRESHOLD_PX;
          if (dist > combinedRadius && dist < combinedRadius + nearMissThreshold && !isSelfTrail) {
            this._nearMisses.push({
              entityId: car.id,
              distance: dist - combinedRadius,
              timestamp: now,
            });
          }

          // Collision check
          if (distSq < combinedRadiusSq) {
            // Collision detected!
            const collisionType = isBodySegment ? 'body' : 'trail';

            this._collisions.push({
              victimId: car.id,
              killerId: isSelfTrail ? car.id : nearbyId, // Self-collision = killed by self
              x: p1.x, // Use p1 as impact approximation
              y: p1.y,
              type: collisionType,
              timestamp: now,
            });

            // Mark health for death
            killEntity(health, isSelfTrail ? car.id : nearbyId, true);
            hitDetected = true;
            break;
          }
        }
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

      for (const [nearbyId, nearbyData] of nearby) {
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

          // Apply powerup effect (restore energy)
          setBoostEnergy(boost, Math.min(boost.maxEnergy, boost.energy + 30));

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
        // In warning zone - push back
        const pushFactor = (distFromCenter - zoneInfo.currentRadius) / 50;
        const angle = Math.atan2(dy, dx);

        position.x -= Math.cos(angle) * pushFactor * 2;
        position.y -= Math.sin(angle) * pushFactor * 2;
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
