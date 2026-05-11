/**
 * Spatial Query utilities
 * High-performance spatial queries using the spatial grid
 */

import { SpatialGrid } from './SpatialGrid';

/**
 * Query result with entity IDs and positions
 */
export interface QueryResult {
  /** Entity ID */
  id: string;

  /** Entity position */
  x: number;

  /** Entity position */
  y: number;

  /** Distance from query center */
  distance: number;

  /** Entity radius (if available) */
  radius: number;
}

/**
 * Sort options for query results
 */
export enum QuerySort {
  /** No sorting */
  NONE = 'none',

  /** Sort by distance (ascending) */
  DISTANCE_ASC = 'distance_asc',

  /** Sort by distance (descending) */
  DISTANCE_DESC = 'distance_desc',
}

/**
 * Spatial query options
 */
export interface QueryOptions {
  /** Maximum results to return */
  limit?: number;

  /** Sort order */
  sort?: QuerySort;

  /** Entity IDs to exclude */
  exclude?: Set<string>;

  /** Filter function for additional filtering */
  filter?: (id: string, x: number, y: number) => boolean;
}

/**
 * Query class for spatial lookups
 */
export class Query {
  constructor(private readonly _grid: SpatialGrid) {}

  /**
   * Find all entities near a point
   */
  findNearby(
    x: number,
    y: number,
    radius: number,
    options?: QueryOptions
  ): QueryResult[] {
    const nearby = this._grid.getNearbyEntities(x, y, radius, options?.exclude);
    const results: QueryResult[] = [];

    for (const [id, data] of nearby.entries()) {
      if (options?.filter && !options.filter(id, data.x, data.y)) {
        continue;
      }

      const dx = data.x - x;
      const dy = data.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      results.push({
        id,
        x: data.x,
        y: data.y,
        distance,
        radius: data.radius,
      });
    }

    // Apply sorting
    if (options?.sort === QuerySort.DISTANCE_ASC) {
      results.sort((a, b) => a.distance - b.distance);
    } else if (options?.sort === QuerySort.DISTANCE_DESC) {
      results.sort((a, b) => b.distance - a.distance);
    }

    // Apply limit
    if (options?.limit && results.length > options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Find the closest entity to a point
   */
  findClosest(x: number, y: number, maxRadius: number, exclude?: Set<string>): QueryResult | null {
    const results = this.findNearby(x, y, maxRadius, {
      exclude,
      sort: QuerySort.DISTANCE_ASC,
      limit: 1,
    });

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Find all entities in a rectangular region
   */
  findInRect(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: QueryOptions
  ): QueryResult[] {
    const entities = this._grid.queryRect(x, y, width, height);
    const results: QueryResult[] = [];
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    for (const id of entities) {
      if (options?.exclude?.has(id)) continue;

      const data = this._grid.getEntity(id);
      if (!data) continue;

      if (options?.filter && !options.filter(id, data.x, data.y)) {
        continue;
      }

      const dx = data.x - centerX;
      const dy = data.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      results.push({
        id,
        x: data.x,
        y: data.y,
        distance,
        radius: data.radius,
      });
    }

    // Apply limit
    if (options?.limit && results.length > options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Check if any entity exists within a radius
   */
  hasAnyInRadius(x: number, y: number, radius: number, exclude?: Set<string>): boolean {
    const nearby = this._grid.getNearbyEntities(x, y, radius, exclude);
    return nearby.size > 0;
  }

  /**
   * Count entities within a radius
   */
  countInRadius(x: number, y: number, radius: number, exclude?: Set<string>): number {
    return this._grid.getNearbyEntities(x, y, radius, exclude).size;
  }

  /**
   * Get all entities of a specific type using a filter
   */
  findByFilter(
    filter: (id: string, x: number, y: number) => boolean,
    x?: number,
    y?: number,
    radius?: number
  ): QueryResult[] {
    if (x !== undefined && y !== undefined && radius !== undefined) {
      return this.findNearby(x, y, radius, { filter });
    }

    // Full world scan (slow!)
    const results: QueryResult[] = [];
    // Note: This would require iterating all entities in the grid
    // For now, return empty - implement if needed
    return results;
  }

  /**
   * Raycast from origin in a direction
   * Returns the first hit entity
   */
  raycast(
    originX: number,
    originY: number,
    dirX: number,
    dirY: number,
    maxDistance: number,
    exclude?: Set<string>
  ): { id: string; x: number; y: number; distance: number } | null {
    // Normalize direction
    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len === 0) return null;

    const ndx = dirX / len;
    const ndy = dirY / len;

    // Step along the ray
    const stepSize = this._grid.getConfig().cellSize * 0.5;
    let currentX = originX;
    let currentY = originY;
    let distance = 0;

    while (distance < maxDistance) {
      // Check for entities at current position
      const hit = this.findClosest(currentX, currentY, stepSize, exclude);

      if (hit && hit.distance < stepSize * 2) {
        return {
          id: hit.id,
          x: hit.x,
          y: hit.y,
          distance,
        };
      }

      // Advance
      currentX += ndx * stepSize;
      currentY += ndy * stepSize;
      distance += stepSize;
    }

    return null;
  }

  /**
   * Find entities within a cone
   */
  findInCone(
    originX: number,
    originY: number,
    direction: number,
    coneAngle: number,
    maxDistance: number,
    _options?: QueryOptions
  ): QueryResult[] {
    const candidates = this.findNearby(originX, originY, maxDistance);
    const results: QueryResult[] = [];
    const halfCone = coneAngle / 2;

    for (const candidate of candidates) {
      // Calculate angle to entity
      const dx = candidate.x - originX;
      const dy = candidate.y - originY;
      const angle = Math.atan2(dy, dx);

      // Check if within cone
      let angleDiff = angle - direction;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

      if (Math.abs(angleDiff) <= halfCone) {
        results.push(candidate);
      }
    }

    return results;
  }

  /**
   * Get path cost between two points (for AI pathfinding)
   * Returns a rough estimate of difficulty
   */
  estimatePathCost(fromX: number, fromY: number, toX: number, toY: number): number {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Simple distance for now - could add obstacle avoidance
    return distance;
  }
}

/**
 * Create a query instance from a spatial grid
 */
export function createQuery(grid: SpatialGrid): Query {
  return new Query(grid);
}

/**
 * Utility functions for common spatial operations
 */
export class SpatialUtils {
  constructor(private readonly _query: Query) {}

  /**
   * Check if a position is safe (no nearby entities)
   */
  isSafePosition(x: number, y: number, safeRadius: number, exclude?: Set<string>): boolean {
    return !this._query.hasAnyInRadius(x, y, safeRadius, exclude);
  }

  /**
   * Find a safe spawn position
   */
  findSafeSpawn(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    safeRadius: number,
    maxAttempts: number = 100,
    exclude?: Set<string>
  ): { x: number; y: number } | null {
    for (let i = 0; i < maxAttempts; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);

      if (this.isSafePosition(x, y, safeRadius, exclude)) {
        return { x, y };
      }
    }

    return null;
  }

  /**
   * Check if a point is within world bounds
   */
  isInBounds(x: number, y: number, width: number, height: number, margin: number = 0): boolean {
    return x >= margin && x <= width - margin && y >= margin && y <= height - margin;
  }

  /**
   * Clamp position to world bounds
   */
  clampToBounds(x: number, y: number, width: number, height: number, margin: number = 0): { x: number; y: number } {
    return {
      x: Math.max(margin, Math.min(width - margin, x)),
      y: Math.max(margin, Math.min(height - margin, y)),
    };
  }
}

/**
 * Create spatial utilities from a query
 */
export function createSpatialUtils(query: Query): SpatialUtils {
  return new SpatialUtils(query);
}
