import { Entity, getComponentBit } from './Entity';

/**
 * Entity query result for efficient iteration
 */
export interface EntityQuery {
  entities: Entity[];
  count: number;
}

/**
 * Filter function for entity queries
 */
export type EntityFilter = (entity: Entity) => boolean;

/**
 * Component mask filter for efficient queries
 */
export class ComponentFilter {
  constructor(public readonly mask: number) {}

  matches(entity: Entity): boolean {
    return entity.matchesMask(this.mask);
  }
}

/**
 * EntityManager manages all entities in the game
 *
 * Responsibilities:
 * - Create and destroy entities
 * - Query entities by component types
 * - Cache query results for performance
 * - Entity pooling for memory efficiency
 */
export class EntityManager {
  /**
   * All entities, indexed by ID
   */
  private readonly _entities: Map<string, Entity> = new Map();

  /**
   * Active entities (for fast iteration)
   */
  private readonly _activeEntities: Set<Entity> = new Set();

  /**
   * Inactive entities (pooling)
   */
  private readonly _inactiveEntities: Set<Entity> = new Set();

  /**
   * Entities marked for destruction
   */
  private readonly _entitiesToDestroy: Set<Entity> = new Set();

  /**
   * Query cache for performance
   */
  private readonly _queryCache: Map<string, Entity[]> = new Map();

  /**
   * Maximum entities allowed (for performance)
   */
  private readonly _maxEntities: number;

  /**
   * Entity pool for reuse
   */
  private readonly _entityPool: Entity[] = [];

  constructor(maxEntities: number = 10000) {
    this._maxEntities = maxEntities;
  }

  /**
   * Create a new entity
   */
  createEntity(name?: string): Entity {
    // Try to reuse from pool
    let entity: Entity;
    if (this._entityPool.length > 0) {
      entity = this._entityPool.pop()!;
      entity.name = name || entity.id;
      entity.reset();
    } else {
      entity = new Entity(name);
    }

    this._entities.set(entity.id, entity);
    this._activeEntities.add(entity);
    this._invalidateQueryCache();

    return entity;
  }

  /**
   * Get an entity by ID
   */
  getEntity(id: string): Entity | undefined {
    return this._entities.get(id);
  }

  /**
   * Check if an entity exists
   */
  hasEntity(id: string): boolean {
    return this._entities.has(id);
  }

  /**
   * Mark an entity for destruction
   * Actual removal happens during flushDestroyedEntities()
   */
  destroyEntity(id: string): boolean {
    const entity = this._entities.get(id);
    if (entity) {
      this._entitiesToDestroy.add(entity);
      return true;
    }
    return false;
  }

  /**
   * Immediately remove an entity
   */
  removeEntity(entity: Entity): void {
    this._entities.delete(entity.id);
    this._activeEntities.delete(entity);
    this._inactiveEntities.delete(entity);

    // Add to pool if not too many
    if (this._entityPool.length < 1000) {
      this._entityPool.push(entity);
    }

    this._invalidateQueryCache();
  }

  /**
   * Process all entities marked for destruction
   * Call this at the end of each frame
   */
  flushDestroyedEntities(): void {
    for (const entity of this._entitiesToDestroy) {
      this.removeEntity(entity);
    }
    this._entitiesToDestroy.clear();
  }

  /**
   * Query entities by component mask (efficient)
   */
  queryByMask(mask: number): Entity[] {
    const cacheKey = `mask_${mask}`;
    let result = this._queryCache.get(cacheKey);

    if (!result) {
      result = [];
      for (const entity of this._activeEntities) {
        if (entity.active && entity.matchesMask(mask)) {
          result.push(entity);
        }
      }
      this._queryCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Query entities by filter function (flexible but slower)
   */
  queryByFilter(filter: EntityFilter): Entity[] {
    const result: Entity[] = [];
    for (const entity of this._activeEntities) {
      if (entity.active && filter(entity)) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * Query entities by component names
   * Creates a mask and uses queryByMask
   */
  query(...componentNames: string[]): Entity[] {
    let mask = 0;
    for (const name of componentNames) {
      mask |= this._getComponentBit(name);
    }
    return this.queryByMask(mask);
  }

  /**
   * Get all active entities
   */
  getActiveEntities(): Entity[] {
    return Array.from(this._activeEntities);
  }

  /**
   * Get count of active entities
   */
  getActiveCount(): number {
    return this._activeEntities.size;
  }

  /**
   * Get all entities (active and inactive)
   */
  getAllEntities(): ReadonlyMap<string, Entity> {
    return this._entities;
  }

  /**
   * Clear all entities
   */
  clear(): void {
    for (const entity of this._entities.values()) {
      entity.clearComponents();
      this._entityPool.push(entity);
    }
    this._entities.clear();
    this._activeEntities.clear();
    this._inactiveEntities.clear();
    this._entitiesToDestroy.clear();
    this._invalidateQueryCache();
  }

  /**
   * Invalidate query cache (call when entities change)
   */
  _invalidateQueryCache(): void {
    this._queryCache.clear();
  }

  /**
   * Invalidate query cache (public API)
   * Call this when components are added/removed from entities
   * or at the start of each frame for guaranteed consistency
   */
  invalidateQueryCache(): void {
    this._queryCache.clear();
  }

  /**
   * Get component bit for a component name
   */
  private _getComponentBit(componentName: string): number {
    return getComponentBit(componentName);
  }

  /**
   * Debug: Get entity count information
   */
  getDebugInfo(): {
    total: number;
    active: number;
    inactive: number;
    toDestroy: number;
    pooled: number;
  } {
    return {
      total: this._entities.size,
      active: this._activeEntities.size,
      inactive: this._inactiveEntities.size,
      toDestroy: this._entitiesToDestroy.size,
      pooled: this._entityPool.length,
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalEntityManager: EntityManager | null = null;

export function getEntityManager(): EntityManager {
  if (!globalEntityManager) {
    globalEntityManager = new EntityManager();
  }
  return globalEntityManager;
}

export function setEntityManager(manager: EntityManager): void {
  globalEntityManager = manager;
}

/**
 * Reset the global entity manager (for testing)
 */
export function resetEntityManager(): void {
  globalEntityManager = null;
}
