/**
 * ObjectPool - Generic object pooling to reduce GC pressure
 *
 * Reuses objects instead of creating new ones, significantly reducing
 * garbage collection pauses in hot paths like the game loop.
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  /**
   * @param factory Function to create new objects when pool is empty
   * @param reset Function to reset object state before returning to pool
   * @param initialSize Initial number of objects to preallocate
   * @param maxSize Maximum pool size (prevents unbounded memory growth)
   */
  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 0,
    maxSize: number = 1000
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;

    // Preallocate objects
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /**
   * Return an object to the pool for reuse
   */
  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      this.reset(obj);
      this.pool.push(obj);
    }
  }

  /**
   * Get current pool size (for monitoring)
   */
  get size(): number {
    return this.pool.length;
  }

  /**
   * Clear the pool to free memory
   */
  clear(): void {
    this.pool.length = 0;
  }
}

/**
 * TrailPoint-specific pool
 */
import { TrailPoint } from 'shared';

export class TrailPointPool extends ObjectPool<TrailPoint> {
  constructor(initialSize: number = 500, maxSize: number = 2000) {
    super(
      () => ({ x: 0, y: 0, expiresAt: 0, createdAt: 0 }),
      () => {}, // TrailPoints are immutable, no reset needed
      initialSize,
      maxSize
    );
  }
}

/**
 * Vector2 pool for temporary calculations
 */
import { Vector2 } from 'shared';

export class Vector2Pool extends ObjectPool<Vector2> {
  constructor(initialSize: number = 100, maxSize: number = 500) {
    super(
      () => ({ x: 0, y: 0 }),
      (obj) => { obj.x = 0; obj.y = 0; },
      initialSize,
      maxSize
    );
  }
}
