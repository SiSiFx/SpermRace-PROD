/**
 * Unique entity ID generator
 */
let nextEntityId = 0;

export function generateEntityId(): string {
  return `entity_${++nextEntityId}_${Date.now()}`;
}

/**
 * Component type map for type-safe component access
 */
export type ComponentTypeMap = {
  [key: string]: any;
};

/**
 * Bitmask for component type tracking
 * Each component type gets a unique bit position
 */
let nextComponentBit = 1;
export const componentBitMasks: Map<string, number> = new Map();

export function getComponentBit(componentName: string): number {
  if (!componentBitMasks.has(componentName)) {
    componentBitMasks.set(componentName, nextComponentBit);
    nextComponentBit <<= 1;
  }
  return componentBitMasks.get(componentName)!;
}

/**
 * Entity class - represents a game entity with components
 *
 * Entities are lightweight containers that hold components.
 * Components are plain data objects (no logic).
 */
export class Entity {
  /**
   * Unique identifier for this entity
   */
  public readonly id: string;

  /**
   * Human-readable name for debugging
   */
  public name: string;

  /**
   * Flag indicating if this entity is active
   * Inactive entities are ignored by systems
   */
  public active: boolean = true;

  /**
   * Component bitmask for quick filtering
   */
  private _componentMask: number = 0;

  /**
   * Map of component name to component instance
   */
  private readonly _components: Map<string, any> = new Map();
  private _onMaskChange: (() => void) | null = null;

  constructor(name?: string) {
    this.id = generateEntityId();
    this.name = name || this.id;
  }

  /**
   * Get the component bitmask for this entity
   */
  get componentMask(): number {
    return this._componentMask;
  }

  /**
   * Add a component to this entity
   */
  addComponent<T>(componentName: string, component: T): this {
    const prevMask = this._componentMask;
    if (this._components.has(componentName)) {
      // Silently replace duplicate component
    }
    this._components.set(componentName, component);
    this._componentMask |= getComponentBit(componentName);
    if (this._componentMask !== prevMask) {
      this._notifyMaskChange();
    }
    return this;
  }

  /**
   * Get a component from this entity
   */
  getComponent<T>(componentName: string): T | undefined {
    return this._components.get(componentName);
  }

  /**
   * Check if entity has a specific component
   */
  hasComponent(componentName: string): boolean {
    return this._components.has(componentName);
  }

  /**
   * Check if entity matches a component mask
   */
  matchesMask(mask: number): boolean {
    return (this._componentMask & mask) === mask;
  }

  /**
   * Remove a component from this entity
   */
  removeComponent(componentName: string): this {
    if (!this._components.has(componentName)) {
      return this;
    }

    const prevMask = this._componentMask;
    this._components.delete(componentName);
    this._componentMask &= ~getComponentBit(componentName);
    if (this._componentMask !== prevMask) {
      this._notifyMaskChange();
    }
    return this;
  }

  /**
   * Get all component names on this entity
   */
  getComponentNames(): string[] {
    return Array.from(this._components.keys());
  }

  /**
   * Clear all components from this entity
   */
  clearComponents(): this {
    if (this._componentMask === 0) {
      return this;
    }

    this._components.clear();
    this._componentMask = 0;
    this._notifyMaskChange();
    return this;
  }

  /**
   * Mark entity for removal (will be cleaned up by EntityManager)
   */
  destroy(): void {
    this.active = false;
    this._notifyMaskChange();
  }

  /**
   * Reset entity state for reuse (object pooling)
   */
  reset(): void {
    this._components.clear();
    this._componentMask = 0;
    this.active = true;
  }

  /**
   * Internal hook used by EntityManager so query caches are invalidated when
   * component membership changes.
   */
  _setMaskChangeHandler(handler: (() => void) | null): void {
    this._onMaskChange = handler;
  }

  private _notifyMaskChange(): void {
    this._onMaskChange?.();
  }
}

/**
 * Entity factory for creating pre-configured entities
 */
export class EntityFactory {
  /**
   * Create a player car entity with all required components
   */
  static createPlayerCar(_x: number, _y: number, _angle: number): Entity {
    const entity = new Entity('player_car');
    // Components will be added by the systems that need them
    return entity;
  }

  /**
   * Create a bot car entity
   */
  static createBotCar(_x: number, _y: number, _angle: number): Entity {
    const entity = new Entity('bot_car');
    return entity;
  }

  /**
   * Create a trail segment entity
   */
  static createTrailSegment(_x: number, _y: number, _ownerId: string): Entity {
    const entity = new Entity('trail_segment');
    return entity;
  }

  /**
   * Create a powerup entity
   */
  static createPowerup(type: string, _x: number, _y: number): Entity {
    const entity = new Entity(`powerup_${type}`);
    return entity;
  }
}
