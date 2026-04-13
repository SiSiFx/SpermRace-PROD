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
import { hasSpawnProtection } from '../components/Health';
import type { Player } from '../components/Player';
import type { Boost } from '../components/Boost';
import type { Velocity } from '../components/Velocity';
import { ComponentNames, createComponentMask } from '../components';
import type { Entity } from '../core/Entity';
import { SpatialGrid } from '../spatial/SpatialGrid';
import { BODY_COLLISION_CONFIG, PLAYER_VISUAL_CONFIG } from '../config';
import { distanceToSegmentSquared } from '../view/math';

/**
 * Trail system configuration
 */
export interface TrailSystemConfig {
  /** Spatial grid for trail collision optimization */
  spatialGrid: SpatialGrid;

  /** Whether trails are enabled */
  enabled: boolean;
}

export interface TrailHazardSegment {
  ownerId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hitX: number;
  hitY: number;
  width: number;
  isBodySegment: boolean;
  segmentIndexFromHead: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  queryMark: number;
}

export interface TrailNearestHazard {
  ownerId: string;
  x: number;
  y: number;
  width: number;
  distanceSq: number;
  isBodySegment: boolean;
  segmentIndexFromHead: number;
}

/**
 * Trail system for creating and managing car trails
 * Uses spatial hashing for O(1) collision lookups
 */
export class TrailSystem extends System {
  public readonly priority = SystemPriority.TRAIL;

  private readonly _config: TrailSystemConfig;
  private readonly _trailMask: number;
  private readonly _gridCellSize: number;
  private readonly _gridCols: number;
  private readonly _gridRows: number;
  private readonly _hazardSegments: TrailHazardSegment[] = [];
  private readonly _hazardBuckets: Map<number, number[]> = new Map();
  private _hazardQueryMark: number = 0;

  constructor(config: TrailSystemConfig) {
    super(SystemPriority.TRAIL);
    this._config = config;
    const gridConfig = config.spatialGrid.getConfig();

    this._trailMask = createComponentMask(ComponentNames.TRAIL);
    this._gridCellSize = gridConfig.cellSize;
    this._gridCols = gridConfig.gridCols;
    this._gridRows = gridConfig.gridRows;
  }

  /**
   * Update trails and create new points
   */
  update(_dt: number): void {
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
      if (health && !health.isAlive) {
        // Kill clears trail instantly — no ghost trail after death
        if (trail.points.length > 0) trail.points.length = 0;
        continue;
      }
      if (!trail.active) continue;

      // Don't emit during spawn protection
      if (health && hasSpawnProtection(health)) continue;

      // Trail emits from the back edge of the head — the trail IS the visual tail.
      // Newest points are near the head (thick, bright), oldest are far behind (thin, dim).
      const isBoosted = boost?.isBoosting ?? false;
      const angle = velocity?.angle ?? 0;

      // Back edge of the oval head
      const headBackOffset = PLAYER_VISUAL_CONFIG.BODY_RADIUS * PLAYER_VISUAL_CONFIG.BODY_WIDTH_MULT;

      let tailTipX = position.x - Math.cos(angle) * headBackOffset;
      let tailTipY = position.y - Math.sin(angle) * headBackOffset;

      // Clamp large jumps (teleports / physics glitches only — normal movement is ≤8px/frame)
      if (trail.points.length > 0) {
        const last = trail.points[trail.points.length - 1];
        const jx = tailTipX - last.x;
        const jy = tailTipY - last.y;
        if (jx * jx + jy * jy > 30 * 30) {
          const dist = Math.hypot(jx, jy) || 1;
          tailTipX = last.x + (jx / dist) * 30;
          tailTipY = last.y + (jy / dist) * 30;
        }
      }

      // Add trail point at tail tip
      addTrailPoint(trail, tailTipX, tailTipY, entity.id, isBoosted);
    }

    // Clean up expired points
    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      if (!trail) continue;

      cleanupExpiredTrailPoints(trail, now);
    }

    // Build one shared hazard index for collision, AI, and danger UI.
    this._rebuildHazardIndex(now, entities);
  }

  forEachNearbySegment(
    x: number,
    y: number,
    radius: number,
    visitor: (segment: Readonly<TrailHazardSegment>) => boolean | void
  ): void {
    const queryMark = ++this._hazardQueryMark;
    const minX = x - radius;
    const maxX = x + radius;
    const minY = y - radius;
    const maxY = y + radius;
    const minCellX = Math.max(0, Math.floor(minX / this._gridCellSize));
    const maxCellX = Math.min(this._gridCols - 1, Math.floor(maxX / this._gridCellSize));
    const minCellY = Math.max(0, Math.floor(minY / this._gridCellSize));
    const maxCellY = Math.min(this._gridRows - 1, Math.floor(maxY / this._gridCellSize));

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const bucket = this._hazardBuckets.get(cellY * this._gridCols + cellX);
        if (!bucket) continue;

        for (const segmentIndex of bucket) {
          const segment = this._hazardSegments[segmentIndex];
          if (!segment || segment.queryMark === queryMark) continue;
          segment.queryMark = queryMark;

          if (
            segment.maxX < minX ||
            segment.minX > maxX ||
            segment.maxY < minY ||
            segment.minY > maxY
          ) {
            continue;
          }

          if (visitor(segment) === false) {
            return;
          }
        }
      }
    }
  }

  findNearestHazard(
    x: number,
    y: number,
    radius: number,
    options?: { ignoreOwnerId?: string }
  ): TrailNearestHazard | null {
    const radiusSq = radius * radius;
    let nearest: TrailNearestHazard | null = null;

    this.forEachNearbySegment(x, y, radius, (segment) => {
      if (options?.ignoreOwnerId && segment.ownerId === options.ignoreOwnerId) {
        return;
      }

      const hit = this._getClosestPointOnSegment(x, y, segment);
      const distanceSq = distanceToSegmentSquared(x, y, segment.x1, segment.y1, segment.x2, segment.y2);
      if (distanceSq > radiusSq) {
        return;
      }

      if (!nearest || distanceSq < nearest.distanceSq) {
        nearest = {
          ownerId: segment.ownerId,
          x: hit.x,
          y: hit.y,
          width: segment.width,
          distanceSq,
          isBodySegment: segment.isBodySegment,
          segmentIndexFromHead: segment.segmentIndexFromHead,
        };
      }
    });

    return nearest;
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

    this._hazardSegments.length = 0;
    this._hazardBuckets.clear();
  }

  private _rebuildHazardIndex(now: number, entities: readonly Entity[]): void {
    this._hazardSegments.length = 0;
    this._hazardBuckets.clear();

    for (const entity of entities) {
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      if (!trail || trail.points.length < 2 || !trail.active) continue;

      for (let index = 0; index < trail.points.length - 1; index++) {
        const p1 = trail.points[index];
        const p2 = trail.points[index + 1];
        const pointAge = now - p1.timestamp;

        if (pointAge > trail.lifetime) continue;

        const width = Math.max(p1.width, p2.width);
        const padding = width * 1.5;
        const segment: TrailHazardSegment = {
          ownerId: entity.id,
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          hitX: p1.x,
          hitY: p1.y,
          width,
          isBodySegment: pointAge < BODY_COLLISION_CONFIG.BODY_SEGMENT_AGE_MS,
          segmentIndexFromHead: trail.points.length - 1 - index,
          minX: Math.min(p1.x, p2.x) - padding,
          minY: Math.min(p1.y, p2.y) - padding,
          maxX: Math.max(p1.x, p2.x) + padding,
          maxY: Math.max(p1.y, p2.y) + padding,
          queryMark: 0,
        };

        const segmentIndex = this._hazardSegments.push(segment) - 1;
        this._indexSegment(segmentIndex, segment);
      }
    }
  }

  private _indexSegment(index: number, segment: TrailHazardSegment): void {
    const minCellX = Math.max(0, Math.floor(segment.minX / this._gridCellSize));
    const maxCellX = Math.min(this._gridCols - 1, Math.floor(segment.maxX / this._gridCellSize));
    const minCellY = Math.max(0, Math.floor(segment.minY / this._gridCellSize));
    const maxCellY = Math.min(this._gridRows - 1, Math.floor(segment.maxY / this._gridCellSize));

    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        const bucketIndex = cellY * this._gridCols + cellX;
        const bucket = this._hazardBuckets.get(bucketIndex);
        if (bucket) {
          bucket.push(index);
        } else {
          this._hazardBuckets.set(bucketIndex, [index]);
        }
      }
    }
  }

  private _getClosestPointOnSegment(
    x: number,
    y: number,
    segment: TrailHazardSegment
  ): { x: number; y: number } {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq <= 1e-6) {
      return { x: segment.x1, y: segment.y1 };
    }

    const t = Math.max(
      0,
      Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSq)
    );

    return {
      x: segment.x1 + t * dx,
      y: segment.y1 + t * dy,
    };
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
