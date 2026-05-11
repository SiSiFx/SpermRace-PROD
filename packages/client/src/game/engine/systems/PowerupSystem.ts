/**
 * Powerup System
 * Manages energy orb spawns and collection
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Collision } from '../components/Collision';
import type { Boost } from '../components/Boost';
import { setBoostEnergy } from '../components/Boost';
import type { Health } from '../components/Health';
import { ComponentNames, createComponentMask } from '../components';
import type { KillPower } from '../components/KillPower';
import { createKillPower, activateKillPower } from '../components/KillPower';
import { POWERUP_CONFIG, COLLISION_CONFIG } from '../config/GameConstants';
import { SpatialGrid } from '../spatial/SpatialGrid';
import type { Entity } from '../core/Entity';
import type { AbilitySystem } from './AbilitySystem';
import { AbilityType } from '../config/AbilityConfig';

/**
 * Powerup types
 */
export enum PowerupType {
  /** Energy boost - refills boost energy */
  ENERGY = 'energy',

  /** Health - respawn (not used in battle royale) */
  HEALTH = 'health',

  /** Speed boost - temporary speed increase */
  SPEED = 'speed',

  /** Overdrive - combined speed + trail boost */
  OVERDRIVE = 'overdrive',
}

/**
 * Powerup configuration
 */
export interface PowerupConfig {
  /** Spawn interval (ms) */
  spawnIntervalMs: number;

  /** Maximum powerups on map */
  maxPowerups: number;

  /** Energy value for energy powerups */
  energyValue: number;

  /** Lifetime of powerups (ms) */
  lifetime: number;

  /** Spawn margin from edges */
  spawnMargin: number;
}

/**
 * Powerup entity data
 */
export interface PowerupData {
  /** Entity ID */
  entityId: string;

  /** Powerup type */
  type: PowerupType;

  /** Position */
  x: number;

  /** Position */
  y: number;

  /** Spawn time */
  spawnTime: number;

  /** Whether it's been collected */
  collected: boolean;

  /** Current scale for animation */
  scale: number;

  /** Current rotation */
  rotation: number;
}

/**
 * Powerup system for spawning and managing collectibles
 */
export class PowerupSystem extends System {
  public readonly priority = SystemPriority.POWERUP;

  private readonly _config: PowerupConfig;
  private readonly _spatialGrid: SpatialGrid;
  private readonly _powerups: Map<string, PowerupData> = new Map();
  private readonly _collected: Set<string> = new Set();

  private _lastSpawnTime: number = 0;
  private _nextId: number = 0;

  // Component masks
  private readonly _collectorMask: number;

  constructor(spatialGrid: SpatialGrid, config?: Partial<PowerupConfig>) {
    super(SystemPriority.POWERUP);

    this._spatialGrid = spatialGrid;

    this._config = {
      spawnIntervalMs: config?.spawnIntervalMs ?? POWERUP_CONFIG.SPAWN_INTERVAL_MS,
      maxPowerups: config?.maxPowerups ?? POWERUP_CONFIG.MAX_POWERUPS,
      energyValue: config?.energyValue ?? POWERUP_CONFIG.ENERGY_VALUE,
      lifetime: config?.lifetime ?? POWERUP_CONFIG.LIFETIME_MS,
      spawnMargin: config?.spawnMargin ?? POWERUP_CONFIG.SPAWN_MARGIN,
    };

    this._collectorMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.COLLISION,
      ComponentNames.BOOST,
      ComponentNames.HEALTH
    );
  }

  /**
   * Update powerups and check collections
   */
  update(_dt: number): void {
    const now = Date.now();

    // Spawn new powerups
    if (now - this._lastSpawnTime >= this._config.spawnIntervalMs) {
      if (this._powerups.size < this._config.maxPowerups) {
        this._spawnPowerup();
      }
      this._lastSpawnTime = now;
    }

    // Update powerup animations
    for (const powerup of this._powerups.values()) {
      if (powerup.collected) continue;

      // Bobbing animation
      powerup.scale = 1 + Math.sin((now - powerup.spawnTime) / 200) * 0.1;

      // Slow rotation
      powerup.rotation = (now - powerup.spawnTime) / 1000;
    }

    // Check for collisions
    this._checkCollections();

    // Clean up expired powerups
    this._cleanupExpired(now);
  }

  /**
   * Spawn a new powerup
   */
  private _spawnPowerup(): void {
    const worldSize = this._spatialGrid.getConfig();
    const margin = this._config.spawnMargin;

    // Find a safe position
    let x: number, y: number;
    let attempts = 0;
    let safe = false;

    while (!safe && attempts < 50) {
      x = margin + Math.random() * (worldSize.worldWidth - margin * 2);
      y = margin + Math.random() * (worldSize.worldHeight - margin * 2);

      // Check if position is safe
      const nearby = this._spatialGrid.getNearbyEntities(x, y, 100);
      safe = nearby.size === 0;
      attempts++;
    }

    if (!safe) return; // Could not find safe position

    const id = `powerup_${this._nextId++}`;
    const type = this._getRandomType();

    const powerup: PowerupData = {
      entityId: id,
      type,
      x: x!,
      y: y!,
      spawnTime: Date.now(),
      collected: false,
      scale: 1,
      rotation: 0,
    };

    this._powerups.set(id, powerup);

    // Add to spatial grid
    this._spatialGrid.addEntity(id, powerup.x, powerup.y, COLLISION_CONFIG.POWERUP_RADIUS);
  }

  /**
   * Get random powerup type
   */
  private _getRandomType(): PowerupType {
    const r = Math.random();
    if (r < 0.45) return PowerupType.ENERGY;
    if (r < 0.85) return PowerupType.SPEED;
    return PowerupType.OVERDRIVE; // 15% chance — rare, high-impact
  }

  /**
   * Check for powerup collections
   */
  private _checkCollections(): void {
    const entities = this.entityManager.queryByMask(this._collectorMask);

    for (const entity of entities) {
      const position = entity.getComponent<Position>(ComponentNames.POSITION);
      const collision = entity.getComponent<Collision>(ComponentNames.COLLISION);
      const boost = entity.getComponent<Boost>(ComponentNames.BOOST);
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);

      if (!position || !collision || !boost || !health) continue;
      if (!health.isAlive) continue;

      // Query nearby powerups
      const nearby = this._spatialGrid.getNearbyEntities(
        position.x,
        position.y,
        collision.radius + 30
      );

      for (const [powerupId] of nearby) {
        const powerup = this._powerups.get(powerupId);
        if (!powerup || powerup.collected) continue;

        // Check distance
        const dx = position.x - powerup.x;
        const dy = position.y - powerup.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < collision.radius + COLLISION_CONFIG.POWERUP_RADIUS) {
          // Collect!
          this._collectPowerup(entity, powerup);
        }
      }
    }
  }

  /**
   * Collect a powerup
   */
  private _collectPowerup(entity: Entity, powerup: PowerupData): void {
    powerup.collected = true;
    this._collected.add(powerup.entityId);

    const boost = entity.getComponent<Boost>(ComponentNames.BOOST);

    switch (powerup.type) {
      case PowerupType.ENERGY:
        if (boost) {
          setBoostEnergy(boost, Math.min(boost.maxEnergy, boost.energy + this._config.energyValue));
        }
        break;

      case PowerupType.SPEED: {
        let kp = entity.getComponent<KillPower>(ComponentNames.KILL_POWER);
        if (!kp) {
          kp = createKillPower();
          entity.addComponent(ComponentNames.KILL_POWER, kp);
        }
        // Use activateKillPower so glow, stack count, and expiry are all set correctly
        activateKillPower(kp, Date.now());
        // Override speed multiplier with the powerup-specific value (may exceed kill reward)
        kp.speedMultiplier = Math.max(kp.speedMultiplier, POWERUP_CONFIG.SPEED_MULTIPLIER);
        kp.speedExpiresAt = Math.max(kp.speedExpiresAt, Date.now() + POWERUP_CONFIG.SPEED_DURATION_MS);
        break;
      }

      case PowerupType.OVERDRIVE: {
        // Delegate to AbilitySystem so all activation side-effects fire (trail widening,
        // wall stamp, sound). Fill boost to max first so the activation energy gate
        // always passes — the cost (50) is still deducted from the refilled tank.
        const abilitySystem = this.getEngine()?.getSystemManager()?.getSystem<AbilitySystem>('abilities');
        if (abilitySystem) {
          if (boost) setBoostEnergy(boost, boost.maxEnergy);
          abilitySystem.activateAbility(entity.id, AbilityType.OVERDRIVE);
        }
        break;
      }
    }

    // Remove from spatial grid
    this._spatialGrid.removeEntity(powerup.entityId);
  }

  /**
   * Clean up expired powerups
   */
  private _cleanupExpired(now: number): void {
    for (const [id, powerup] of this._powerups.entries()) {
      if (now - powerup.spawnTime >= this._config.lifetime) {
        this._powerups.delete(id);
        this._spatialGrid.removeEntity(id);
        this._collected.delete(id);
      }
    }

    // Clean up collected
    for (const id of this._collected) {
      const powerup = this._powerups.get(id);
      if (powerup && powerup.collected) {
        this._powerups.delete(id);
        this._collected.delete(id);
      }
    }
  }

  /**
   * Get all powerups for rendering
   */
  getPowerups(): ReadonlyArray<PowerupData> {
    return Array.from(this._powerups.values());
  }

  /**
   * Clear all powerups
   */
  clear(): void {
    for (const id of this._powerups.keys()) {
      this._spatialGrid.removeEntity(id);
    }
    this._powerups.clear();
    this._collected.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PowerupConfig>): void {
    Object.assign(this._config, config);
  }

  /**
   * Set arena size
   */
  setArenaSize(_width: number, _height: number): void {
    // Powerup positions will respect new arena size on next spawn
  }
}

/**
 * Factory function
 */
export function createPowerupSystem(spatialGrid: SpatialGrid, config?: Partial<PowerupConfig>): PowerupSystem {
  return new PowerupSystem(spatialGrid, config);
}
