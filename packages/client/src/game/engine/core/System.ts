import { EntityManager, getEntityManager, setEntityManager } from './EntityManager';

/**
 * Game engine interface
 * Minimal interface to avoid circular dependencies
 */
export interface GameEngine {
  getSystemManager(): SystemManager;
  getEntityManager(): EntityManager;
  getWorldSize(): { width: number; height: number };
  getSpatialGrid?(): unknown;
  setTimeScale?(scale: number): void;
  getTimeScale?(): number;
}

/**
 * System priority levels
 * Higher priority systems run first
 */
export enum SystemPriority {
  /**
   * Input handling - runs before everything else
   */
  INPUT = 1000,

  /**
   * Network prediction - runs after input
   */
  NETWORK_PREDICTION = 900,

  /**
   * Physics - runs after prediction
   */
  PHYSICS = 800,

  /**
   * Abilities - runs after physics
   */
  ABILITIES = 700,

  /**
   * Trail - runs after abilities
   */
  TRAIL = 600,

  /**
   * Collision - runs after trail
   */
  COLLISION = 500,

  /**
   * Zone - runs after collision
   */
  ZONE = 400,

  /**
   * Powerup - runs after zone
   */
  POWERUP = 300,

  /**
   * AI - runs after powerup
   */
  AI = 200,

  /**
   * Effects - runs after AI, before rendering
   */
  EFFECTS = 150,

  /**
   * Rendering - runs last
   */
  RENDERING = 100,

  /**
   * UI - runs after rendering
   */
  UI = 50,
}

/**
 * Base System class
 *
 * Systems contain game logic and operate on entities with specific components.
 * Each system should implement update() and optionally init() and destroy().
 */
export abstract class System {
  /**
   * System priority (determines update order)
   */
  public readonly priority: SystemPriority;

  /**
   * Whether this system is enabled
   */
  public enabled: boolean = true;

  /**
   * Reference to the entity manager
   */
  protected readonly entityManager: EntityManager;

  /**
   * Time accumulator for fixed timestep updates
   */
  protected accumulator: number = 0;

  constructor(priority: SystemPriority = SystemPriority.PHYSICS, entityManager?: EntityManager) {
    this.priority = priority;
    this.entityManager = entityManager || this._getDefaultEntityManager();
  }

  /**
   * Initialize the system
   * Called once when the game starts
   */
  init?(): void | Promise<void>;

  /**
   * Update the system
   * Called every frame with delta time in seconds
   */
  abstract update(dt: number): void;

  /**
   * Fixed timestep update
   * Override if system needs fixed timestep physics
   */
  fixedUpdate?(fixedDt: number): void;

  /**
   * Clean up system resources
   * Called when the system is destroyed
   */
  destroy?(): void;

  /**
   * Handle window resize
   * Override if system needs to respond to resize
   */
  onResize?(width: number, height: number): void;

  /**
   * Handle game state changes
   * Override if system needs to respond to state changes
   */
  onStateChange?(state: string, data?: any): void;

  /**
   * Get default entity manager
   */
  private _getDefaultEntityManager(): EntityManager {
    return getEntityManager();
  }

  /**
   * Get the game engine (accessed via SystemManager)
   */
  getEngine(): GameEngine | undefined {
    // @ts-ignore - accessed via SystemManager
    return this._engine;
  }

  /**
   * Internal: Set engine reference (called by SystemManager)
   */
  _setEngine(engine: GameEngine): void {
    // @ts-ignore
    this._engine = engine;
  }
}

/**
 * System manager for organizing and updating systems
 */
export class SystemManager {
  private readonly _systems: System[] = [];
  private readonly _systemsByName: Map<string, System> = new Map();
  private _engine: GameEngine | null = null;

  /**
   * Set the engine reference (called by GameEngine)
   */
  setEngine(engine: GameEngine): void {
    this._engine = engine;
    // Update all systems with engine reference
    for (const system of this._systems) {
      system._setEngine(engine);
    }
  }

  /**
   * Get the engine
   */
  getEngine(): any {
    return this._engine;
  }

  /**
   * Add a system to the manager
   * Systems are automatically sorted by priority
   */
  addSystem(system: System, name?: string): this {
    this._systems.push(system);
    this._systems.sort((a, b) => b.priority - a.priority);

    if (name) {
      this._systemsByName.set(name, system);
    } else {
      this._systemsByName.set(system.constructor.name, system);
    }

    // Set engine reference if already available
    if (this._engine) {
      system._setEngine(this._engine);
    }

    return this;
  }

  /**
   * Get a system by name
   */
  getSystem<T extends System>(name: string): T | undefined {
    return this._systemsByName.get(name) as T;
  }

  /**
   * Remove a system
   */
  removeSystem(name: string): boolean {
    const system = this._systemsByName.get(name);
    if (system) {
      const index = this._systems.indexOf(system);
      if (index >= 0) {
        this._systems.splice(index, 1);
      }
      this._systemsByName.delete(name);

      if (system.destroy) {
        system.destroy();
      }

      return true;
    }
    return false;
  }

  /**
   * Update all enabled systems
   */
  update(dt: number): void {
    for (const system of this._systems) {
      if (system.enabled) {
        system.update(dt);
      }
    }
  }

  /**
   * Fixed timestep update for systems that need it
   */
  fixedUpdate(fixedDt: number): void {
    for (const system of this._systems) {
      if (system.enabled && system.fixedUpdate) {
        system.fixedUpdate(fixedDt);
      }
    }
  }

  /**
   * Initialize all systems
   */
  async initAll(): Promise<void> {
    for (const system of this._systems) {
      if (system.init) {
        await system.init();
      }
    }
  }

  /**
   * Destroy all systems
   */
  destroyAll(): void {
    // Reverse order for cleanup
    for (let i = this._systems.length - 1; i >= 0; i--) {
      const system = this._systems[i];
      if (system.destroy) {
        system.destroy();
      }
    }
    this._systems.length = 0;
    this._systemsByName.clear();
  }

  /**
   * Handle resize event
   */
  onResize(width: number, height: number): void {
    for (const system of this._systems) {
      if (system.enabled && system.onResize) {
        system.onResize(width, height);
      }
    }
  }

  /**
   * Handle state change event
   */
  onStateChange(state: string, data?: any): void {
    for (const system of this._systems) {
      if (system.enabled && system.onStateChange) {
        system.onStateChange(state, data);
      }
    }
  }

  /**
   * Get all systems
   */
  getSystems(): ReadonlyArray<System> {
    return this._systems;
  }

  /**
   * Get system count
   */
  getSystemCount(): number {
    return this._systems.length;
  }
}

/**
 * Global system manager instance
 */
let globalSystemManager: SystemManager | null = null;

export function getSystemManager(): SystemManager {
  if (!globalSystemManager) {
    globalSystemManager = new SystemManager();
  }
  return globalSystemManager;
}

export function setSystemManager(manager: SystemManager): void {
  globalSystemManager = manager;
}
