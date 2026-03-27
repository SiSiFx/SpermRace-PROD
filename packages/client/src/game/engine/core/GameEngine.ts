/**
 * Game Engine - Fixed Timestep Game Loop
 *
 * Implements a deterministic game loop with:
 * - Fixed timestep physics updates (60Hz)
 * - Variable framerate rendering with interpolation
 * - Accumulator pattern for consistent physics
 * - Delta time capping for "spiral of death" prevention
 */

import { EntityManager, setEntityManager } from './EntityManager';
import { SystemManager, setSystemManager } from './System';
import { SpatialGrid, createSpatialGrid } from '../spatial/SpatialGrid';

/**
 * Engine configuration
 */
export interface GameEngineConfig {
  /** Fixed timestep in milliseconds (default: 16.67ms for 60Hz) */
  fixedDtMs?: number;

  /** Maximum frame time in milliseconds (prevents spiral of death) */
  maxFrameTimeMs?: number;

  /** World width */
  worldWidth?: number;

  /** World height */
  worldHeight?: number;

  /** Maximum entities */
  maxEntities?: number;

  /** Auto-start the engine */
  autoStart?: boolean;
}

/**
 * Game state for transitions
 */
export enum GameState {
  /** Engine not initialized */
  UNINITIALIZED = 'uninitialized',

  /** Engine ready but not running */
  IDLE = 'idle',

  /** Game paused */
  PAUSED = 'paused',

  /** Game running */
  RUNNING = 'running',

  /** Game in transition (loading, etc.) */
  TRANSITION = 'transition',

  /** Engine shutting down */
  SHUTTING_DOWN = 'shutting_down',
}

/**
 * Time statistics for monitoring
 */
export interface TimeStats {
  /** Current FPS */
  fps: number;

  /** Frame time in milliseconds */
  frameTime: number;

  /** Physics steps taken this frame */
  physicsSteps: number;

  /** Accumulator value (ms) */
  accumulator: number;

  /** Alpha value for interpolation (0-1) */
  alpha: number;

  /** Total running time (seconds) */
  totalTime: number;

  /** Delta time (seconds) */
  deltaTime: number;
}

/**
 * Game Engine class
 *
 * Manages the main game loop with fixed timestep physics
 * and variable framerate rendering.
 */
export class GameEngine {
  private readonly _fixedDt: number;
  private readonly _maxFrameTime: number;
  private readonly _worldWidth: number;
  private readonly _worldHeight: number;

  /** Core systems */
  private readonly _entityManager: EntityManager;
  private readonly _systemManager: SystemManager;
  private readonly _spatialGrid: SpatialGrid;

  /** Game state */
  private _state: GameState = GameState.UNINITIALIZED;

  /** Time tracking */
  private _lastTime: number = 0;
  private _accumulator: number = 0;
  private _timeScale: number = 1.0;
  private _totalTime: number = 0;
  private _frameCount: number = 0;
  private _fpsTime: number = 0;
  private _fpsFrames: number = 0;

  /** Time statistics */
  private readonly _timeStats: TimeStats = {
    fps: 60,
    frameTime: 16.67,
    physicsSteps: 0,
    accumulator: 0,
    alpha: 0,
    totalTime: 0,
    deltaTime: 0,
  };

  /** Animation frame handle */
  private _rafId: number | null = null;

  /** Callbacks */
  private readonly _onStateChangeCallbacks: Set<(state: GameState, data?: any) => void> = new Set();

  constructor(config: GameEngineConfig = {}) {
    this._fixedDt = (config.fixedDtMs ?? 1000 / 60) / 1000; // Convert to seconds
    this._maxFrameTime = config.maxFrameTimeMs ?? 250; // Cap at 250ms
    this._worldWidth = config.worldWidth ?? 3500;
    this._worldHeight = config.worldHeight ?? 2500;

    // Initialize core systems
    this._entityManager = new EntityManager(config.maxEntities ?? 10000);
    this._systemManager = new SystemManager();
    this._spatialGrid = createSpatialGrid(this._worldWidth, this._worldHeight);

    // Set global instances
    setEntityManager(this._entityManager);
    setSystemManager(this._systemManager);

    // Initialize if auto-start
    if (config.autoStart) {
      this.init();
    }
  }

  /**
   * Initialize the engine
   */
  async init(): Promise<void> {
    if (this._state !== GameState.UNINITIALIZED) {
      return;
    }

    this._setState(GameState.IDLE);

    // Initialize all systems
    await this._systemManager.initAll();
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this._state === GameState.RUNNING) {
      return;
    }

    this._setState(GameState.RUNNING);
    this._lastTime = performance.now();
    this._accumulator = 0;

    this._rafId = requestAnimationFrame((t) => this._gameLoop(t));
  }

  /**
   * Pause the game loop
   */
  pause(): void {
    if (this._state !== GameState.RUNNING) {
      return;
    }

    this._setState(GameState.PAUSED);

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (this._state !== GameState.PAUSED) {
      return;
    }

    this._setState(GameState.RUNNING);
    this._lastTime = performance.now();

    this._rafId = requestAnimationFrame((t) => this._gameLoop(t));
  }

  /**
   * Stop the game loop and clean up
   */
  async stop(): Promise<void> {
    this._setState(GameState.SHUTTING_DOWN);

    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    // Destroy all systems
    this._systemManager.destroyAll();
    this._entityManager.clear();

    this._setState(GameState.IDLE);
  }

  /**
   * Reset the game state
   */
  reset(): void {
    this._accumulator = 0;
    this._totalTime = 0;
    this._frameCount = 0;
    this._entityManager.clear();
  }

  /**
   * Main game loop
   */
  private _gameLoop(timestamp: number): void {
    if (this._state !== GameState.RUNNING) {
      return;
    }

    // Calculate frame time
    let frameTime = (timestamp - this._lastTime) / 1000; // Convert to seconds
    this._lastTime = timestamp;

    this._runFrame(frameTime);

    // Request next frame
    this._rafId = requestAnimationFrame((t) => this._gameLoop(t));
  }

  /**
   * Advance simulation by an explicit amount of time (ms).
   * Useful for deterministic automation and debugging.
   */
  advanceTime(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    if (this._state !== GameState.RUNNING && this._state !== GameState.PAUSED) return;

    let remainingSec = ms / 1000;
    const maxStepSec = this._maxFrameTime / 1000;
    let guard = 0;

    while (remainingSec > 0 && guard < 600) {
      const chunk = Math.min(remainingSec, maxStepSec);
      this._runFrame(chunk);
      remainingSec -= chunk;
      guard++;
    }
  }

  /**
   * Process one simulation frame.
   */
  private _runFrame(frameTimeSec: number): void {
    // Apply time scaling (slow motion / pause)
    let frameTime = frameTimeSec * this._timeScale;

    // Cap frame time to prevent spiral of death
    if (frameTime > this._maxFrameTime / 1000) {
      frameTime = this._maxFrameTime / 1000;
    }
    if (frameTime < 0) frameTime = 0;

    // Update statistics
    this._timeStats.frameTime = frameTime * 1000;
    this._timeStats.deltaTime = frameTime;
    this._totalTime += frameTime;
    this._timeStats.totalTime = this._totalTime;

    // FPS calculation
    this._fpsFrames++;
    this._fpsTime += frameTime;
    if (this._fpsTime >= 1) {
      this._timeStats.fps = this._fpsFrames;
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }

    // Add to accumulator
    this._accumulator += frameTime;
    this._timeStats.accumulator = this._accumulator * 1000;

    // Fixed timestep physics updates
    let physicsSteps = 0;
    const maxPhysicsSteps = 10; // Prevent excessive steps

    while (this._accumulator >= this._fixedDt && physicsSteps < maxPhysicsSteps) {
      // Update entities marked for destruction
      this._entityManager.flushDestroyedEntities();

      // Fixed timestep update
      this._systemManager.fixedUpdate(this._fixedDt);

      this._accumulator -= this._fixedDt;
      physicsSteps++;
    }

    this._timeStats.physicsSteps = physicsSteps;

    // Calculate alpha for interpolation (0-1)
    // Represents how far we are between physics frames
    this._timeStats.alpha = this._accumulator / this._fixedDt;

    // Variable timestep update (for things that don't need fixed timestep)
    this._systemManager.update(frameTime);

    this._frameCount++;
  }

  /**
   * Set time scale (1.0 = normal, 0.5 = half speed)
   */
  setTimeScale(scale: number): void {
    this._timeScale = Math.max(0, scale);
  }

  /**
   * Get current time scale
   */
  getTimeScale(): number {
    return this._timeScale;
  }

  /**
   * Register a state change callback
   */
  onStateChange(callback: (state: GameState, data?: any) => void): () => void {
    this._onStateChangeCallbacks.add(callback);
    return () => this._onStateChangeCallbacks.delete(callback);
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return this._state;
  }

  /**
   * Check if engine is running
   */
  isRunning(): boolean {
    return this._state === GameState.RUNNING;
  }

  /**
   * Check if engine is paused
   */
  isPaused(): boolean {
    return this._state === GameState.PAUSED;
  }

  /**
   * Get time statistics
   */
  getTimeStats(): Readonly<TimeStats> {
    return this._timeStats;
  }

  /**
   * Get current FPS
   */
  getFPS(): number {
    return this._timeStats.fps;
  }

  /**
   * Get interpolation alpha (0-1)
   */
  getAlpha(): number {
    return this._timeStats.alpha;
  }

  /**
   * Get entity manager
   */
  getEntityManager(): EntityManager {
    return this._entityManager;
  }

  /**
   * Get system manager
   */
  getSystemManager(): SystemManager {
    return this._systemManager;
  }

  /**
   * Get spatial grid
   */
  getSpatialGrid(): SpatialGrid {
    return this._spatialGrid;
  }

  /**
   * Get world dimensions
   */
  getWorldSize(): { width: number; height: number } {
    return {
      width: this._worldWidth,
      height: this._worldHeight,
    };
  }

  /**
   * Get fixed timestep
   */
  getFixedDt(): number {
    return this._fixedDt;
  }

  /**
   * Set internal state and notify listeners
   */
  private _setState(state: GameState, data?: any): void {
    this._state = state;

    // Notify systems
    this._systemManager.onStateChange(state, data);

    // Notify listeners
    for (const callback of this._onStateChangeCallbacks) {
      try {
        callback(state, data);
      } catch (e) {
        console.error('Error in state change callback:', e);
      }
    }

  }

  /**
   * Handle window resize
   */
  onResize(width: number, height: number): void {
    this._systemManager.onResize(width, height);
  }

  /**
   * Get debug information
   */
  getDebugInfo(): {
    state: GameState;
    timeStats: TimeStats;
    entityManager: ReturnType<EntityManager['getDebugInfo']>;
    spatialGrid: ReturnType<SpatialGrid['getDebugInfo']>;
    systemCount: number;
  } {
    return {
      state: this._state,
      timeStats: { ...this._timeStats },
      entityManager: this._entityManager.getDebugInfo(),
      spatialGrid: this._spatialGrid.getDebugInfo(),
      systemCount: this._systemManager.getSystemCount(),
    };
  }
}

/**
 * Global game engine instance
 */
let globalGameEngine: GameEngine | null = null;

/**
 * Get or create the global game engine
 */
export function getGameEngine(config?: GameEngineConfig): GameEngine {
  if (!globalGameEngine) {
    globalGameEngine = new GameEngine({ ...config, autoStart: true });
  }
  return globalGameEngine;
}

/**
 * Set the global game engine
 */
export function setGameEngine(engine: GameEngine): void {
  globalGameEngine = engine;
}

/**
 * Destroy the global game engine
 */
export async function destroyGameEngine(): Promise<void> {
  if (globalGameEngine) {
    await globalGameEngine.stop();
    globalGameEngine = null;
  }
}
