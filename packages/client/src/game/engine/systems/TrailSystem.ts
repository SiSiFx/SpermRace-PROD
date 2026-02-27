/**
 * Trail System
 * Manages trail creation, lifecycle, and spatial-optimized collision
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Trail } from '../components/Trail';
import { addTrailPoint, cleanupExpiredTrailPoints } from '../components/Trail';
import type { TrailPoint } from '../components/Trail';
import type { Health } from '../components/Health';
import { hasSpawnProtection, killEntity } from '../components/Health';
import type { Collision } from '../components/Collision';
import { CollisionLayer } from '../components/Collision';
import type { Player } from '../components/Player';
import type { Boost } from '../components/Boost';
import type { Velocity } from '../components/Velocity';
import { ComponentNames, createComponentMask } from '../components';
import { SpatialGrid } from '../spatial/SpatialGrid';
import { TRAIL_CONFIG, COLLISION_CONFIG, PLAYER_VISUAL_CONFIG } from '../config';

/**
 * Trail system configuration
 */
export interface TrailSystemConfig {
  /** Spatial grid for trail collision optimization */
  spatialGrid: SpatialGrid;

  /** Whether trails are enabled */
  enabled: boolean;
}

/**
 * Trail collision result
 */
export interface TrailCollisionResult {
  /** Entity that was hit */
  victimId: string;

  /** Trail owner that killed */
  killerId: string;

  /** Collision point */
  x: number;

  /** Collision point */
  y: number;
}

/**
 * Trail system for creating and managing car trails
 * Uses spatial hashing for O(1) collision lookups
 */
export class TrailSystem extends System {
  public readonly priority = SystemPriority.TRAIL;

  private readonly _config: TrailSystemConfig;
  private readonly _collisions: TrailCollisionResult[] = [];

  // Component masks
  private readonly _trailMask: number;
  private readonly _positionTrailHealthMask: number;
  private readonly _carWithCollisionMask: number;

  constructor(config: TrailSystemConfig) {
    super(SystemPriority.TRAIL);
    this._config = config;

    this._trailMask = createComponentMask(ComponentNames.TRAIL);
    this._positionTrailHealthMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.TRAIL,
      ComponentNames.HEALTH
    );
    // Mask for cars that can collide with trails
    this._carWithCollisionMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.HEALTH,
      ComponentNames.COLLISION
    );
  }

  /**
   * Update trails and create new points
   */
  update(dt: number): void {
    if (!this._config.enabled) return;

    const now = Date.now();
    const entities = this.entityManager.queryByMask(this._trailMask);

    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      const boost = entity.getComponent<Boost>(ComponentNames.BOOST);

      const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);

      if (!trail || !position || !player) continue;
      if (health && !health.isAlive) continue;
      if (!trail.active) continue;

      // Don't emit during spawn protection
      if (health && hasSpawnProtection(health)) continue;

      // Calculate tail tip position (trail emits from end of tail, not head center)
      const isBoosted = boost?.isBoosting ?? false;
      const currentSpeed = Math.max(0, velocity?.speed ?? 0);
      const speedNorm = Math.max(0, Math.min(1.45, currentSpeed / 315));
      const angle = velocity?.angle ?? 0;

      // Match render-side tail length/stretch so visual tail and lethal trail stay coherent.
      const baseTailLength = isBoosted
        ? PLAYER_VISUAL_CONFIG.TAIL_LENGTH_BOOST
        : PLAYER_VISUAL_CONFIG.TAIL_LENGTH;
      const profileTailLength = baseTailLength * (isBoosted ? 1.12 : 1.02);
      const speedStretch = isBoosted
        ? 1 + speedNorm * 0.12
        : 1 + speedNorm * 0.05;
      const visualTailLength = profileTailLength * speedStretch;

      // Back edge of the oval head in local space.
      const bodyRadius = PLAYER_VISUAL_CONFIG.BODY_RADIUS;
      const headBackOffset = bodyRadius * PLAYER_VISUAL_CONFIG.BODY_WIDTH_MULT - 1;

      // Keep trail start near visible tail tip.
      const totalTailOffset = headBackOffset + visualTailLength * 1.0;

      // Calculate tail tip position (opposite direction of movement)
      let tailTipX = position.x - Math.cos(angle) * totalTailOffset;
      let tailTipY = position.y - Math.sin(angle) * totalTailOffset;

      // Prevent teleport-like trail jumps when aim changes abruptly.
      // This avoids giant zig-zag trail artifacts under fast turns.
      if (trail.points.length > 0) {
        const last = trail.points[trail.points.length - 1];
        const jx = tailTipX - last.x;
        const jy = tailTipY - last.y;
        const maxJump = Math.max(60, visualTailLength * 0.34);
        if (jx * jx + jy * jy > maxJump * maxJump) {
          // Clamp abrupt direction changes instead of skipping emission.
          // This preserves a continuous readable trail under hard turns.
          const dist = Math.hypot(jx, jy) || 1;
          const clamp = maxJump / dist;
          tailTipX = last.x + jx * clamp;
          tailTipY = last.y + jy * clamp;
        }
      }

      // Add trail point at tail tip
      addTrailPoint(trail, tailTipX, tailTipY, entity.id, isBoosted);

      // Update spatial grid with trail points
      this._updateTrailInSpatialGrid(entity, trail, player.color);
    }

    // Clean up expired points
    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      if (!trail) continue;

      cleanupExpiredTrailPoints(trail, now);
    }

    // Check collisions
    this._checkTrailCollisions(now);
  }

  /**
   * Check for trail-car collisions using spatial grid
   */
  private _checkTrailCollisions(now: number): void {
    const entities = this.entityManager.queryByMask(this._carWithCollisionMask);

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const collision = entity.getComponent<Collision>(ComponentNames.COLLISION);

      if (!position || !health || !collision) continue;
      if (!health.isAlive) continue;
      if (hasSpawnProtection(health)) continue;

      // Query nearby entities (including trail points)
      const nearby = this._config.spatialGrid.getNearbyEntities(
        position.x,
        position.y,
        collision.radius + 20 // Slightly larger radius for trail collision
      );

      for (const [nearbyId, nearbyData] of nearby.entries()) {
        if (nearbyId === entity.id) continue; // Don't check against self

        const nearbyEntity = this.entityManager.getEntity(nearbyId);
        if (!nearbyEntity) continue;

        const nearbyTrail = nearbyEntity.getComponent<Trail>(ComponentNames.TRAIL);
        if (!nearbyTrail) continue;

        // Check collision with trail points
        for (const point of nearbyTrail.points) {
          // Ignore recent points from self
          // Use consistent 300ms matching server and COLLISION_CONFIG.SELF_IGNORE_MS
          const SELF_IGNORE_MS = 300;
          if (point.ownerId === entity.id && now - point.timestamp < SELF_IGNORE_MS) {
            continue;
          }

          // Ignore expired points
          if (now - point.timestamp > nearbyTrail.lifetime) {
            continue;
          }

          // Check collision
          const dx = position.x - point.x;
          const dy = position.y - point.y;
          const combinedRadius = collision.radius + point.width;

          if (dx * dx + dy * dy < combinedRadius * combinedRadius) {
            // Collision detected!
            this._collisions.push({
              victimId: entity.id,
              killerId: nearbyId,
              x: point.x,
              y: point.y,
            });

            // Mark health for death
            killEntity(health, nearbyId, true);

            break; // Only one collision per frame
          }
        }
      }
    }
  }

  /**
   * Update trail points in spatial grid
   * Each trail point is added as a separate entity for collision
   */
  private _updateTrailInSpatialGrid(entity: any, trail: Trail, color: number): void {
    const position = entity.getComponent(ComponentNames.POSITION) as Position | undefined;
    if (!position) return;

    const collision = entity.getComponent(ComponentNames.COLLISION) as Collision | undefined;
    if (!collision) return;

    // Register trail points in spatial grid
    for (const point of trail.points) {
      this._config.spatialGrid.addEntity(
        `trail-${entity.id}-${point.timestamp}`,
        point.x,
        point.y,
        collision.radius
      );
    }
  }

  /**
   * Get all collisions this frame
   */
  getCollisions(): ReadonlyArray<TrailCollisionResult> {
    return this._collisions;
  }

  /**
   * Clear collisions (call after processing)
   */
  clearCollisions(): void {
    this._collisions.length = 0;
  }

  /**
   * Get all trail points from all entities
   */
  getAllTrailPoints(): TrailPoint[] {
    const points: TrailPoint[] = [];
    const entities = this.entityManager.queryByMask(this._trailMask);

    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      if (!trail) continue;

      points.push(...trail.points);
    }

    return points;
  }

  /**
   * Enable/disable trails
   */
  setEnabled(enabled: boolean): void {
    this._config.enabled = enabled;
  }

  /**
   * Clear all trails
   */
  clearAllTrails(): void {
    const entities = this.entityManager.queryByMask(this._trailMask);

    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      if (!trail) continue;

      trail.points = [];
    }
  }
}

/**
 * Factory function
 */
export function createTrailSystem(spatialGrid: SpatialGrid): TrailSystem {
  return new TrailSystem({
    spatialGrid,
    enabled: true,
  });
}
