/**
 * Generic Object Pool for memory-efficient object reuse
 * Reduces GC pressure by reusing objects instead of creating new ones
 */

/**
 * Pool statistics for monitoring
 */
export interface PoolStats {
  /** Total objects in pool (available + in use) */
  total: number;

  /** Objects currently available for reuse */
  available: number;

  /** Objects currently in use */
  inUse: number;

  /** Maximum pool size reached */
  peakSize: number;

  /** Total objects created (lifetime) */
  totalCreated: number;

  /** Total objects reused (lifetime) */
  totalReused: number;
}

/**
 * Factory function for creating new pool objects
 */
export type PoolFactory<T> = () => T;

/**
 * Reset function for cleaning up objects before returning to pool
 */
export type PoolReset<T> = (obj: T) => void;

/**
 * Generic Object Pool
 *
 * Example usage:
 * ```ts
 * const pool = new ObjectPool({
 *   create: () => new Vector2(),
 *   reset: (v) => v.set(0, 0),
 *   initialSize: 100,
 * });
 *
 * const vector = pool.acquire();
 * vector.set(1, 2);
 * pool.release(vector);
 * ```
 */
export class ObjectPool<T> {
  private readonly _factory: PoolFactory<T>;
  private readonly _reset?: PoolReset<T>;
  private readonly _pool: T[] = [];
  private readonly _maxSize: number;
  private readonly _inUse: Set<T> = new Set();

  /** Statistics */
  private _stats: PoolStats = {
    total: 0,
    available: 0,
    inUse: 0,
    peakSize: 0,
    totalCreated: 0,
    totalReused: 0,
  };

  constructor(config: {
    create: PoolFactory<T>;
    reset?: PoolReset<T>;
    initialSize?: number;
    maxSize?: number;
  }) {
    this._factory = config.create;
    this._reset = config.reset;
    this._maxSize = config.maxSize ?? Infinity;

    // Pre-populate pool
    if (config.initialSize) {
      for (let i = 0; i < config.initialSize; i++) {
        this._pool.push(this._factory());
        this._stats.totalCreated++;
      }
      this._updateStats();
    }
  }

  /**
   * Acquire an object from the pool
   * Creates a new object if pool is empty (under max size)
   */
  acquire(): T {
    let obj: T;

    if (this._pool.length > 0) {
      obj = this._pool.pop()!;
      this._stats.totalReused++;
    } else {
      obj = this._factory();
      this._stats.totalCreated++;
    }

    this._inUse.add(obj);
    this._updateStats();

    return obj;
  }

  /**
   * Release an object back to the pool
   * Object is reset if a reset function was provided
   */
  release(obj: T): void {
    if (!this._inUse.has(obj)) {
      return;
    }

    this._inUse.delete(obj);

    // Reset object state
    if (this._reset) {
      this._reset(obj);
    }

    // Return to pool if under max size
    if (this._pool.length < this._maxSize) {
      this._pool.push(obj);
    }

    this._updateStats();
  }

  /**
   * Release multiple objects at once
   */
  releaseMany(objects: T[]): void {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  /**
   * Prewarm the pool with additional objects
   */
  prewarm(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this._pool.length >= this._maxSize) break;
      this._pool.push(this._factory());
      this._stats.totalCreated++;
    }
    this._updateStats();
  }

  /**
   * Clear all objects from the pool
   * In-use objects are not affected
   */
  clear(): void {
    this._pool.length = 0;
    this._updateStats();
  }

  /**
   * Shrink pool to a specific size
   * Removes available objects (does not affect in-use)
   */
  shrink(size: number): void {
    while (this._pool.length > size) {
      this._pool.pop();
    }
    this._updateStats();
  }

  /**
   * Get current pool statistics
   */
  getStats(): Readonly<PoolStats> {
    return this._stats;
  }

  /**
   * Check if an object is from this pool
   */
  isInUse(obj: T): boolean {
    return this._inUse.has(obj);
  }

  /**
   * Get number of available objects
   */
  get available(): number {
    return this._pool.length;
  }

  /**
   * Get number of objects in use
   */
  get inUse(): number {
    return this._inUse.size;
  }

  /**
   * Get total size (available + in use)
   */
  get size(): number {
    return this._pool.length + this._inUse.size;
  }

  /**
   * Get the internal pool array (for cleanup purposes)
   */
  getPool(): T[] {
    return this._pool;
  }

  /**
   * Update statistics
   */
  private _updateStats(): void {
    this._stats.total = this._pool.length + this._inUse.size;
    this._stats.available = this._pool.length;
    this._stats.inUse = this._inUse.size;
    this._stats.peakSize = Math.max(this._stats.peakSize, this._stats.total);
  }
}

/**
 * Auto-pool wrapper for automatic pool management
 * Wraps objects that auto-release when done
 */
export class PooledObject<T> {
  constructor(
    public readonly obj: T,
    private readonly _pool: ObjectPool<T>
  ) {}

  /**
   * Release the object back to the pool
   */
  release(): void {
    this._pool.release(this.obj);
  }
}

/**
 * Scoped pool helper for automatic cleanup
 * Usage:
 * ```ts
 * using(pool.acquire(), (obj) => {
 *   // use obj
 *   // auto-released after block
 * });
 * ```
 */
export function using<T>(pool: ObjectPool<T>, fn: (obj: T) => void): void {
  const obj = pool.acquire();
  try {
    fn(obj);
  } finally {
    pool.release(obj);
  }
}

/**
 * Create a pool with sensible defaults
 */
export function createPool<T>(
  factory: PoolFactory<T>,
  reset?: PoolReset<T>,
  initialSize: number = 50
): ObjectPool<T> {
  return new ObjectPool({
    create: factory,
    reset,
    initialSize,
    maxSize: 1000,
  });
}
