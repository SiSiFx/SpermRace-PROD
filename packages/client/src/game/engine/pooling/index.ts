/**
 * Object pooling exports
 * Centralized import point for all pooling utilities
 */

export * from './ObjectPool';
export * from './TrailPointPool';
export * from './ParticlePool';
export * from './GraphicsPool';

export {
  ObjectPool,
  PooledObject,
  using,
  createPool,
  type PoolFactory,
  type PoolReset,
  type PoolStats,
} from './ObjectPool';

export {
  TrailPointPool,
  PooledTrailPoint,
  getTrailPointPool,
  setTrailPointPool,
  createTrailPoint,
} from './TrailPointPool';

export {
  ParticlePool,
  ParticleType,
  type Particle,
  getParticlePool,
  setParticlePool,
} from './ParticlePool';

export {
  GraphicsPool,
  getGraphicsPool,
  setGraphicsPool,
  acquireGraphics,
  releaseGraphics,
  acquireContainer,
  releaseContainer,
} from './GraphicsPool';
