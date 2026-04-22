/**
 * Entity Factory
 * Factory functions for creating game entities with all required components
 */

import { EntityManager } from '../core/EntityManager';
import type { Position, Velocity, Collision, Trail, Health, Player, Boost, Abilities, Renderable, SpermClass } from '../components';
import type { KillPower } from '../components/KillPower';
import {
  createVelocity,
  createTrail,
  createHealth,
  createBoost,
  createAbilities,
  createKillPower,
  createSpermClass,
  SpermClassType,
  CLASS_STATS,
} from '../components';
import { ComponentNames } from '../components';
import { CollisionLayer, CollisionMask } from '../components/Collision';
import { EntityType } from '../components/Player';
import { EntityState } from '../components/Health';
import { TRAIL_CONFIG, BOOST_CONFIG, COLLISION_CONFIG, MATCH_CONFIG, CAR_PHYSICS, PLAYER_VISUAL_CONFIG } from '../config';

function getVisibleBodyCollisionRadius(sizeMultiplier: number): number {
  // Keep the gameplay hit circle aligned with the visible sperm head.
  const visibleBodyRadius = PLAYER_VISUAL_CONFIG.BODY_RADIUS * PLAYER_VISUAL_CONFIG.BODY_HEIGHT_MULT * 0.78;
  return Math.max(COLLISION_CONFIG.CAR_RADIUS, visibleBodyRadius) * sizeMultiplier;
}

/**
 * Entity factory configuration
 */
export interface EntityFactoryConfig {
  /** Entity manager for creating entities */
  entityManager: EntityManager;

  /** World width for spawn positioning */
  worldWidth: number;

  /** World height for spawn positioning */
  worldHeight: number;

  /** Whether abilities are enabled */
  enableAbilities?: boolean;
}

/**
 * Player creation options
 */
export interface CreatePlayerOptions {
  /** Player name */
  name: string;

  /** Player color (hex number) */
  color: number;

  /** Spawn position X (optional, random if not specified) */
  x?: number;

  /** Spawn position Y (optional, random if not specified) */
  y?: number;

  /** Is this a local player */
  isLocal?: boolean;

  /** Sperm class type (Balanced, Sprinter, Tank) */
  classType?: SpermClassType;
}

/**
 * Bot creation options
 */
export interface CreateBotOptions {
  /** Bot index (for naming/coloring) */
  index: number;

  /** Bot name */
  name?: string;

  /** Bot color (optional, auto-generated if not specified) */
  color?: number;

  /** Spawn position X (optional, random if not specified) */
  x?: number;

  /** Spawn position Y (optional, random if not specified) */
  y?: number;

  /** Sperm class type (random if not specified) */
  classType?: SpermClassType;
}

/**
 * Entity Factory class
 * Provides factory methods for creating common game entities
 */
export class EntityFactory {
  private readonly _config: EntityFactoryConfig;

  constructor(config: EntityFactoryConfig) {
    this._config = config;
  }

  /**
   * Create a player entity
   */
  createPlayer(options: CreatePlayerOptions): string {
    const { name, color, x, y, isLocal = true, classType = SpermClassType.BALANCED } = options;
    const entityManager = this._config.entityManager;

    // Get class stats
    const classStats = CLASS_STATS[classType];
    const collisionRadius = getVisibleBodyCollisionRadius(classStats.sizeMultiplier);

    // Create entity
    const player = entityManager.createEntity(name);
    const spawn = this._getSpawnPosition(x, y);

    // Position
    player.addComponent<Position>(ComponentNames.POSITION, {
      x: spawn.x,
      y: spawn.y,
    });

    // Point spawn toward arena center — avoids the default angle-0 (right) drift.
    // Soft initial burst (~55% base speed) gives a launch feel at GO without instant full speed.
    const spawnAngle = Math.atan2(
      this._config.worldHeight / 2 - spawn.y,
      this._config.worldWidth / 2 - spawn.x
    );
    const spawnSpeed = CAR_PHYSICS.BASE_SPEED * classStats.speedMultiplier * 0.55;

    // Velocity (apply class speed multiplier)
    player.addComponent<Velocity>(
      ComponentNames.VELOCITY,
      createVelocity({
        maxSpeed: CAR_PHYSICS.BASE_SPEED * classStats.speedMultiplier,
        acceleration: CAR_PHYSICS.ACCELERATION * classStats.speedMultiplier,
        drag: CAR_PHYSICS.LONGITUDINAL_DRAG,
        angle: spawnAngle,
        targetAngle: spawnAngle,
        vx: Math.cos(spawnAngle) * spawnSpeed,
        vy: Math.sin(spawnAngle) * spawnSpeed,
      })
    );

    // Collision (apply class size multiplier)
    player.addComponent<Collision>(ComponentNames.COLLISION, {
      radius: collisionRadius,
      layer: CollisionLayer.PLAYER,
      mask: CollisionMask.CAR,
      enabled: true,
      isTrigger: false,
      lastCollisionFrame: 0,
    });

    // Sperm Class
    player.addComponent<SpermClass>(ComponentNames.SPERM_CLASS, createSpermClass(classType));

    // Trail (apply class size multiplier to width)
    player.addComponent<Trail>(ComponentNames.TRAIL, createTrail({
      color,
      baseWidth: TRAIL_CONFIG.BASE_WIDTH * classStats.sizeMultiplier,
      boostedWidth: TRAIL_CONFIG.BOOSTED_WIDTH * classStats.sizeMultiplier,
      lifetime: TRAIL_CONFIG.LIFETIME_MS,
      emitDistance: TRAIL_CONFIG.EMIT_DISTANCE,
      emitInterval: TRAIL_CONFIG.EMIT_INTERVAL_MS,
      maxLength: TRAIL_CONFIG.MAX_POINTS,
    }));

    // Health
    player.addComponent<Health>(ComponentNames.HEALTH, createHealth({
      state: EntityState.ALIVE,
      isAlive: true,
      spawnGraceUntil: Date.now() + MATCH_CONFIG.SPAWN_GRACE_MS,
    }));

    // Player
    player.addComponent<Player>(ComponentNames.PLAYER, {
      type: EntityType.PLAYER,
      name,
      playerId: player.id,
      color,
      isLocal,
    });

    // Boost
    player.addComponent<Boost>(ComponentNames.BOOST, createBoost({
      energy: BOOST_CONFIG.MAX_ENERGY,
      maxEnergy: BOOST_CONFIG.MAX_ENERGY,
      minEnergy: BOOST_CONFIG.MIN_ENERGY,
      speedMultiplier: BOOST_CONFIG.SPEED_MULTIPLIER,
    }));

    // Kill Power (temporary buff after kills)
    player.addComponent<KillPower>(ComponentNames.KILL_POWER, createKillPower());

    // Abilities (optional)
    if (this._config.enableAbilities) {
      player.addComponent<Abilities>(ComponentNames.ABILITIES, createAbilities());
    }

    return player.id;
  }

  /**
   * Create a bot entity
   */
  createBot(options: CreateBotOptions): string {
    const { index, name, color, x, y, classType } = options;
    const entityManager = this._config.entityManager;

    // Auto-generate name and color if not provided
    const BOT_NAMES = [
      'Vex', 'Kira', 'Dax', 'Zara', 'Rook', 'Nova', 'Jett', 'Lyra',
      'Colt', 'Fenn', 'Skye', 'Oryn', 'Blaze', 'Sable', 'Raze', 'Wren',
    ];
    const botName = name ?? BOT_NAMES[index % BOT_NAMES.length];
    // Distinct bright colors readable on dark backgrounds
    const COLOR_PALETTE = [
      0xf472b6, // pink
      0xfbbf24, // amber
      0x4ade80, // green
      0xfb923c, // orange
      0xa78bfa, // purple
      0xf87171, // red
      0x2dd4bf, // teal
      0xfde047, // yellow
      0xa3e635, // lime
      0x60a5fa, // blue
    ];
    const botColor = color ?? COLOR_PALETTE[index % COLOR_PALETTE.length];

    // Random class for bots (for variety)
    const allClasses = [SpermClassType.BALANCED, SpermClassType.SPRINTER, SpermClassType.TANK];
    const botClassType = classType ?? allClasses[Math.floor(Math.random() * allClasses.length)];
    const classStats = CLASS_STATS[botClassType];
    const collisionRadius = getVisibleBodyCollisionRadius(classStats.sizeMultiplier);

    // Create entity
    const bot = entityManager.createEntity(botName);
    const spawn = this._getSpawnPosition(x, y);

    // Position
    bot.addComponent<Position>(ComponentNames.POSITION, {
      x: spawn.x,
      y: spawn.y,
    });

    // Bots also spawn pointing toward center for visual consistency
    const botSpawnAngle = Math.atan2(
      this._config.worldHeight / 2 - spawn.y,
      this._config.worldWidth / 2 - spawn.x
    );
    const botSpawnSpeed = CAR_PHYSICS.BASE_SPEED * classStats.speedMultiplier * 0.55;

    // Velocity (apply class speed multiplier)
    bot.addComponent<Velocity>(
      ComponentNames.VELOCITY,
      createVelocity({
        maxSpeed: CAR_PHYSICS.BASE_SPEED * classStats.speedMultiplier,
        acceleration: CAR_PHYSICS.ACCELERATION * classStats.speedMultiplier,
        drag: CAR_PHYSICS.LONGITUDINAL_DRAG,
        angle: botSpawnAngle,
        targetAngle: botSpawnAngle,
        vx: Math.cos(botSpawnAngle) * botSpawnSpeed,
        vy: Math.sin(botSpawnAngle) * botSpawnSpeed,
      })
    );

    // Collision (apply class size multiplier)
    bot.addComponent<Collision>(ComponentNames.COLLISION, {
      radius: collisionRadius,
      layer: CollisionLayer.BOT,
      mask: CollisionMask.CAR,
      enabled: true,
      isTrigger: false,
      lastCollisionFrame: 0,
    });

    // Sperm Class
    bot.addComponent<SpermClass>(ComponentNames.SPERM_CLASS, createSpermClass(botClassType));

    // Trail (apply class size multiplier to width)
    bot.addComponent<Trail>(ComponentNames.TRAIL, createTrail({
      color: botColor,
      baseWidth: TRAIL_CONFIG.BASE_WIDTH * classStats.sizeMultiplier,
      boostedWidth: TRAIL_CONFIG.BOOSTED_WIDTH * classStats.sizeMultiplier,
      lifetime: TRAIL_CONFIG.LIFETIME_MS,
      emitDistance: TRAIL_CONFIG.EMIT_DISTANCE,
      emitInterval: TRAIL_CONFIG.EMIT_INTERVAL_MS,
      maxLength: TRAIL_CONFIG.MAX_POINTS,
    }));

    // Health
    bot.addComponent<Health>(ComponentNames.HEALTH, createHealth({
      state: EntityState.ALIVE,
      isAlive: true,
      spawnGraceUntil: Date.now() + MATCH_CONFIG.SPAWN_GRACE_MS,
    }));

    // Player (bot)
    bot.addComponent<Player>(ComponentNames.PLAYER, {
      type: EntityType.BOT,
      name: botName,
      playerId: bot.id,
      color: botColor,
      isLocal: false,
    });

    // Boost
    bot.addComponent<Boost>(ComponentNames.BOOST, createBoost());

    // Kill Power (temporary buff after kills)
    bot.addComponent<KillPower>(ComponentNames.KILL_POWER, createKillPower());

    // Abilities (optional)
    if (this._config.enableAbilities) {
      bot.addComponent<Abilities>(ComponentNames.ABILITIES, createAbilities());
    }

    return bot.id;
  }

  /**
   * Create multiple bots at once
   */
  createBots(count: number): string[] {
    const botIds: string[] = [];
    for (let i = 0; i < count; i++) {
      botIds.push(this.createBot({ index: i }));
    }
    return botIds;
  }

  /**
   * Get a random spawn position
   */
  private _getSpawnPosition(x?: number, y?: number): { x: number; y: number } {
    if (x !== undefined && y !== undefined) {
      return { x, y };
    }

    const margin = 200;
    return {
      x: margin + Math.random() * (this._config.worldWidth - margin * 2),
      y: margin + Math.random() * (this._config.worldHeight - margin * 2),
    };
  }

  /**
   * Get the entity manager
   */
  getEntityManager(): EntityManager {
    return this._config.entityManager;
  }
}

/**
 * Create an entity factory
 */
export function createEntityFactory(config: EntityFactoryConfig): EntityFactory {
  return new EntityFactory(config);
}

/**
 * Helper function to create a player entity directly
 */
export function createPlayerEntity(
  entityManager: EntityManager,
  options: CreatePlayerOptions & {
    worldWidth?: number;
    worldHeight?: number;
    enableAbilities?: boolean;
  }
): string {
  const factory = new EntityFactory({
    entityManager,
    worldWidth: options.worldWidth ?? 3500,
    worldHeight: options.worldHeight ?? 2500,
    enableAbilities: options.enableAbilities ?? false,
  });
  return factory.createPlayer(options);
}

/**
 * Helper function to create a bot entity directly
 */
export function createBotEntity(
  entityManager: EntityManager,
  options: CreateBotOptions & {
    worldWidth?: number;
    worldHeight?: number;
    enableAbilities?: boolean;
  }
): string {
  const factory = new EntityFactory({
    entityManager,
    worldWidth: options.worldWidth ?? 3500,
    worldHeight: options.worldHeight ?? 2500,
    enableAbilities: options.enableAbilities ?? false,
  });
  return factory.createBot(options);
}

/**
 * Helper function to create trail point entities (if needed for spatial grid)
 */
export function createTrailPointEntity(
  entityManager: EntityManager,
  x: number,
  y: number,
  ownerId: string,
  width: number,
  lifetime: number
): string {
  const point = entityManager.createEntity(`trail_${ownerId}_${Date.now()}_${Math.random()}`);

  point.addComponent<Position>(ComponentNames.POSITION, { x, y });
  point.addComponent<Collision>(ComponentNames.COLLISION, {
    radius: width,
    layer: CollisionLayer.TRAIL,
    mask: CollisionMask.CAR,
    enabled: true,
    isTrigger: true,
    lastCollisionFrame: 0,
  });

  return point.id;
}
