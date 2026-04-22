/**
 * Ability System
 * Manages active abilities (Dash, Shield, Trap, Overdrive)
 */

import { System, SystemPriority } from '../core/System';
import type { Abilities } from '../components/Abilities';
import { AbilityType, activateAbility, updateAbilities, getAbilityProgress } from '../components/Abilities';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import type { Boost } from '../components/Boost';
import { setBoostEnergy } from '../components/Boost';
import type { Trail } from '../components/Trail';
import { ComponentNames, createComponentMask } from '../components';
import type { Entity } from '../core/Entity';
import type { Player } from '../components/Player';
import type { SoundSystem } from './SoundSystem';
import { BOOST_CONFIG, CAR_PHYSICS } from '../config/GameConstants';
import type { SpermClass } from '../components/SpermClass';

/**
 * Ability activation request
 */
export interface AbilityRequest {
  /** Entity activating the ability */
  entityId: string;

  /** Ability type to activate */
  abilityType: AbilityType;

  /** Activation timestamp */
  timestamp: number;
}

/**
 * Ability effect data
 */
export interface AbilityEffect {
  /** Type of effect */
  type: AbilityType;

  /** Entity that created the effect */
  ownerId: string;

  /** Effect position */
  x: number;

  /** Effect position */
  y: number;

  /** Effect start time */
  startTime: number;

  /** Effect duration (ms) */
  duration: number;

  /** Effect data (type-specific) */
  data: any;
}

/**
 * Trap entity data
 */
export interface TrapData {
  /** Position X */
  x: number;

  /** Position Y */
  y: number;

  /** Trail points */
  trailPoints: Array<{ x: number; y: number }>;

  /** Lifetime (ms) */
  lifetime: number;

  /** Creation time */
  createdAt: number;
}

/**
 * Ability system for handling active abilities
 */
export class AbilitySystem extends System {
  public readonly priority = SystemPriority.ABILITIES;

  private readonly _pendingRequests: AbilityRequest[] = [];
  private readonly _activeEffects: Map<string, AbilityEffect> = new Map();
  private readonly _traps: Map<string, TrapData> = new Map();

  // Component masks
  private readonly _abilitiesMask: number;
  private readonly _fullCarMask: number;

  constructor() {
    super(SystemPriority.ABILITIES);

    this._abilitiesMask = createComponentMask(ComponentNames.ABILITIES);
    this._fullCarMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.VELOCITY,
      ComponentNames.BOOST,
      ComponentNames.ABILITIES
    );
  }

  /**
   * Process ability updates
   */
  update(dt: number): void {
    const now = Date.now();

    // Process pending requests
    for (const request of this._pendingRequests) {
      this._processRequest(request);
    }
    this._pendingRequests.length = 0;

    // Update abilities on all entities
    const entities = this.entityManager.queryByMask(this._abilitiesMask);

    for (const entity of entities) {
      const abilities = entity.getComponent<Abilities>(ComponentNames.ABILITIES);
      const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
      const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);

      if (!abilities) continue;

      // Update ability cooldowns and states
      const expired = updateAbilities(abilities, dt);

      // Handle expired abilities
      for (const type of expired) {
        this._onAbilityExpired(entity, type);
      }

      // Apply active ability effects
      for (const type of abilities.active) {
        this._applyActiveEffect(entity, type, dt);
      }
    }

    // Update active effects (traps, etc.)
    this._updateEffects(now);

    // Clean up expired traps
    this._cleanupTraps(now);
  }

  /**
   * Request ability activation
   */
  activateAbility(entityId: string, abilityType: AbilityType): boolean {
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) return false;

    const abilities = entity.getComponent<Abilities>(ComponentNames.ABILITIES);
    const boost = entity.getComponent<Boost>(ComponentNames.BOOST);

    if (!abilities) return false;

    const energy = boost?.energy ?? 100;
    const result = activateAbility(abilities, abilityType, energy);

    if (result.success && boost && result.energyCost > 0) {
      // Deduct energy
      setBoostEnergy(boost, boost.energy - result.energyCost);
    }

    if (result.success) {
      // Apply immediate effect
      this._onAbilityActivated(entity, abilityType);
    }

    return result.success;
  }

  /**
   * Get ability progress for UI
   */
  getAbilityProgress(entityId: string, abilityType: AbilityType): { cooldown: number; active: number } {
    const entity = this.entityManager.getEntity(entityId);
    if (!entity) return { cooldown: 0, active: 0 };

    const abilities = entity.getComponent<Abilities>(ComponentNames.ABILITIES);
    if (!abilities) return { cooldown: 0, active: 0 };

    return getAbilityProgress(abilities, abilityType);
  }

  /**
   * Get all active traps
   */
  getTraps(): ReadonlyMap<string, TrapData> {
    return this._traps;
  }

  /**
   * Handle ability activation
   */
  private _onAbilityActivated(entity: Entity, type: AbilityType): void {
    const position = entity.getComponent<Position>(ComponentNames.POSITION);
    const velocity = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
    const abilities = entity.getComponent<Abilities>(ComponentNames.ABILITIES);

    if (!position || !velocity || !abilities) return;

    // Sound: only for local player
    const player = entity.getComponent<Player>(ComponentNames.PLAYER);
    if (player?.isLocal) {
      const sound = this.getEngine()?.getSystemManager()?.getSystem<SoundSystem>('sound') ?? null;
      if (sound) {
        switch (type) {
          case AbilityType.DASH:      sound.playDash();   break;
          case AbilityType.SHIELD:    sound.playShield(); break;
          case AbilityType.TRAP:      sound.playTrap();   break;
          case AbilityType.OVERDRIVE: sound.playDash();   break; // reuse dash whoosh, louder feel
        }
      }
    }

    switch (type) {
      case AbilityType.DASH:
        this._applyDash(entity, position, velocity, abilities);
        break;

      case AbilityType.SHIELD:
        this._applyShield(entity);
        break;

      case AbilityType.TRAP:
        this._placeTrap(entity, position, velocity);
        break;

      case AbilityType.OVERDRIVE:
        this._applyOverdrive(entity);
        break;
    }
  }

  /**
   * Handle ability expiration
   */
  private _onAbilityExpired(entity: Entity, type: AbilityType): void {
    switch (type) {
      case AbilityType.DASH:
        // Dash is instant, no expiration handling needed
        break;

      case AbilityType.SHIELD: {
        const health = entity.getComponent<any>(ComponentNames.HEALTH);
        if (health) {
          health.shielded = false;
          health.shieldUntil = 0;
        }
        break;
      }

      case AbilityType.OVERDRIVE: {
        // Restore trail visuals — speed returns automatically since PhysicsSystem
        // reads abilities.active.has(OVERDRIVE) which is now cleared on expiry.
        const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
        if (boost) {
          boost.trailWidthMultiplier = BOOST_CONFIG.TRAIL_WIDTH_MULTIPLIER;
          boost.trailLifetimeBonus = BOOST_CONFIG.TRAIL_LIFETIME_BONUS;
        }
        break;
      }
    }
  }

  /**
   * Apply dash ability
   */
  private _applyDash(entity: Entity, position: Position, velocity: Velocity, abilities: Abilities): void {
    // Instant speed boost in current direction
    const dashSpeed = 600;
    const dashDuration = 0.15; // seconds

    velocity.vx = Math.cos(velocity.angle) * dashSpeed;
    velocity.vy = Math.sin(velocity.angle) * dashSpeed;

    // Create visual effect
    this._createDashEffect(position.x, position.y, velocity.angle, entity.id);
  }

  /**
   * Apply shield ability
   */
  private _applyShield(entity: Entity): void {
    // Set invincible flag - handled by collision system
    const health = entity.getComponent<any>('Health');
    if (health) {
      health.shielded = true;
      health.shieldUntil = Date.now() + 1500;
    }

    // Create visual effect
    const position = entity.getComponent<Position>(ComponentNames.POSITION);
    if (position) {
      this._createShieldEffect(position.x, position.y, entity.id);
    }
  }

  /**
   * Place trap ability
   */
  private _placeTrap(entity: Entity, position: Position, velocity: Velocity): void {
    const trapId = `trap_${entity.id}_${Date.now()}`;
    const trailLength = 10;
    const spacing = 15;

    const trailPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < trailLength; i++) {
      const dist = i * spacing;
      trailPoints.push({
        x: position.x - Math.cos(velocity.angle) * dist,
        y: position.y - Math.sin(velocity.angle) * dist,
      });
    }

    this._traps.set(trapId, {
      x: position.x,
      y: position.y,
      trailPoints,
      lifetime: 8000, // 8 seconds
      createdAt: Date.now(),
    });

    // Create visual effect
    this._createTrapEffect(trailPoints, entity.id);
  }

  /**
   * Apply overdrive ability
   */
  private _applyOverdrive(entity: Entity): void {
    const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
    if (boost) {
      // Fat trail + lifetime bonus — the signature visual of Overdrive.
      // Speed is now handled in PhysicsSystem via abilities.active.has(OVERDRIVE)
      // so it works without requiring isBoosting (no energy drain).
      boost.trailWidthMultiplier = 3;
      boost.trailLifetimeBonus = 3000;
    }
  }

  /**
   * Apply continuous active effects
   */
  private _applyActiveEffect(entity: Entity, type: AbilityType, dt: number): void {
    // Most effects are applied on activation
    // This is for continuous effects (if any)
  }

  /**
   * Process ability request from queue
   */
  private _processRequest(request: AbilityRequest): void {
    this.activateAbility(request.entityId, request.abilityType);
  }

  /**
   * Update active effects
   */
  private _updateEffects(now: number): void {
    // Check for expired effects
    for (const [id, effect] of this._activeEffects.entries()) {
      if (now - effect.startTime >= effect.duration) {
        this._activeEffects.delete(id);
      }
    }
  }

  /**
   * Clean up expired traps
   */
  private _cleanupTraps(now: number): void {
    for (const [id, trap] of this._traps.entries()) {
      if (now - trap.createdAt >= trap.lifetime) {
        this._traps.delete(id);
      }
    }
  }

  /**
   * Create dash visual effect
   */
  private _createDashEffect(x: number, y: number, angle: number, ownerId: string): void {
    const effect: AbilityEffect = {
      type: AbilityType.DASH,
      ownerId,
      x,
      y,
      startTime: Date.now(),
      duration: 200,
      data: { angle },
    };
    this._activeEffects.set(`dash_${ownerId}_${Date.now()}`, effect);
  }

  /**
   * Create shield visual effect
   */
  private _createShieldEffect(x: number, y: number, ownerId: string): void {
    const effect: AbilityEffect = {
      type: AbilityType.SHIELD,
      ownerId,
      x,
      y,
      startTime: Date.now(),
      duration: 1500,
      data: {},
    };
    this._activeEffects.set(`shield_${ownerId}_${Date.now()}`, effect);
  }

  /**
   * Create trap visual effect
   */
  private _createTrapEffect(trailPoints: Array<{ x: number; y: number }>, ownerId: string): void {
    // Visual effect handled by render system
  }

  /**
   * Get active effects for rendering
   */
  getActiveEffects(): ReadonlyArray<AbilityEffect> {
    return Array.from(this._activeEffects.values());
  }

  /**
   * Clear all effects
   */
  clearEffects(): void {
    this._activeEffects.clear();
    this._traps.clear();
  }
}

/**
 * Factory function
 */
export function createAbilitySystem(): AbilitySystem {
  return new AbilitySystem();
}
