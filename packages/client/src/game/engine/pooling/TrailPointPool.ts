/**
 * Trail Point Object Pool
 * Specialized pool for trail point objects to reduce GC churn
 */

import { ObjectPool } from './ObjectPool';
import type { TrailPoint } from '../components/Trail';

/**
 * Reusable trail point structure
 * Uses object pooling pattern for efficient memory management
 */
export class PooledTrailPoint {
  x: number = 0;
  y: number = 0;
  timestamp: number = 0;
  width: number = 0;
  ownerId: string = '';
  isBoosted: boolean = false;
  next: PooledTrailPoint | null = null;
  prev: PooledTrailPoint | null = null;

  /**
   * Set values for reuse
   */
  set(x: number, y: number, timestamp: number, width: number, ownerId: string, isBoosted: boolean): this {
    this.x = x;
    this.y = y;
    this.timestamp = timestamp;
    this.width = width;
    this.ownerId = ownerId;
    this.isBoosted = isBoosted;
    return this;
  }

  /**
   * Convert to regular TrailPoint
   */
  toTrailPoint(): TrailPoint {
    return {
      x: this.x,
      y: this.y,
      timestamp: this.timestamp,
      width: this.width,
      ownerId: this.ownerId,
      isBoosted: this.isBoosted,
    };
  }

  /**
   * Reset for pool return
   */
  reset(): void {
    this.x = 0;
    this.y = 0;
    this.timestamp = 0;
    this.width = 0;
    this.ownerId = '';
    this.isBoosted = false;
    this.next = null;
    this.prev = null;
  }
}

/**
 * Trail point pool with linked list support
 * Optimized for frequent trail point creation/destruction
 */
export class TrailPointPool {
  private readonly _pool: ObjectPool<PooledTrailPoint>;

  constructor(initialSize: number = 500, maxSize: number = 5000) {
    this._pool = new ObjectPool({
      create: () => new PooledTrailPoint(),
      reset: (pt) => pt.reset(),
      initialSize,
      maxSize,
    });
  }

  /**
   * Acquire a trail point from the pool
   */
  acquire(): PooledTrailPoint {
    return this._pool.acquire();
  }

  /**
   * Acquire and initialize a trail point
   */
  acquireWith(
    x: number,
    y: number,
    timestamp: number,
    width: number,
    ownerId: string,
    isBoosted: boolean
  ): PooledTrailPoint {
    const pt = this._pool.acquire();
    return pt.set(x, y, timestamp, width, ownerId, isBoosted);
  }

  /**
   * Release a trail point back to the pool
   */
  release(point: PooledTrailPoint): void {
    this._pool.release(point);
  }

  /**
   * Release a linked list of trail points
   */
  releaseList(head: PooledTrailPoint | null): void {
    let current = head;
    while (current) {
      const next = current.next;
      this._pool.release(current);
      current = next;
    }
  }

  /**
   * Create an array of regular TrailPoints from pooled points
   */
  toArray(head: PooledTrailPoint | null): TrailPoint[] {
    const result: TrailPoint[] = [];
    let current = head;
    while (current) {
      result.push(current.toTrailPoint());
      current = current.next;
    }
    return result;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return this._pool.getStats();
  }

  /**
   * Clear the pool
   */
  clear(): void {
    this._pool.clear();
  }

  /**
   * Prewarm the pool
   */
  prewarm(count: number): void {
    this._pool.prewarm(count);
  }
}

/**
 * Global trail point pool instance
 */
let globalTrailPointPool: TrailPointPool | null = null;

export function getTrailPointPool(): TrailPointPool {
  if (!globalTrailPointPool) {
    globalTrailPointPool = new TrailPointPool();
  }
  return globalTrailPointPool;
}

export function setTrailPointPool(pool: TrailPointPool): void {
  globalTrailPointPool = pool;
}

/**
 * Helper to create a trail point from the global pool
 */
export function createTrailPoint(
  x: number,
  y: number,
  width: number,
  ownerId: string,
  isBoosted: boolean = false
): PooledTrailPoint {
  return getTrailPointPool().acquireWith(x, y, Date.now(), width, ownerId, isBoosted);
}
