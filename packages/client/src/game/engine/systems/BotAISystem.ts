/**
 * Bot AI System
 * AI-controlled car behavior for practice mode
 */

import { System, SystemPriority } from '../core/System';
import type { Position } from '../components/Position';
import type { Velocity } from '../components/Velocity';
import type { Health } from '../components/Health';
import type { Abilities } from '../components/Abilities';
import { isAbilityReady, AbilityType, ABILITY_CONFIG } from '../components/Abilities';
import type { Boost } from '../components/Boost';
import type { Player } from '../components/Player';
import { EntityType } from '../components/Player';
import { ZoneState } from './ZoneSystem';
import { SpatialGrid } from '../spatial/SpatialGrid';
import { ComponentNames, createComponentMask } from '../components';
import type { Entity } from '../core/Entity';
import type { Trail } from '../components/Trail';
import type { ZoneSystem } from './ZoneSystem';

/**
 * AI behavior state
 */
export enum AIState {
  /** Roaming randomly */
  ROAMING = 'roaming',

  /** Chasing a target */
  CHASING = 'chasing',

  /** Fleeing from danger */
  FLEEING = 'fleeing',

  /** Heading to safe zone */
  HEADING_TO_ZONE = 'heading_to_zone',

  /** Avoiding trails */
  AVOIDING = 'avoiding',
}

/**
 * Bot AI state for tracking each bot
 */
export interface BotAIState {
  /** Current AI state */
  state: AIState;

  /** Target entity ID */
  targetId: string | null;

  /** Target position */
  targetPosition: { x: number; y: number } | null;

  /** Last decision time */
  lastDecision: number;

  /** Boost end time */
  boostUntil: number;

  /** Last ability check time */
  lastAbilityCheck: number;
}

/**
 * AI configuration
 */
export interface BotAIConfig {
  /** Reaction delay (ms) */
  reactionDelay: number;

  /** Accuracy (0-1) */
  accuracy: number;

  /** Aggression (0-1) */
  aggression: number;

  /** Ability usage chance (0-1) */
  abilityUsageChance: number;

  /** Path prediction distance */
  predictionDistance: number;
}

/**
 * Bot AI system
 * Controls bot behavior for offline practice mode
 */
export class BotAISystem extends System {
  public readonly priority = SystemPriority.AI;

  private readonly _config: BotAIConfig;
  private readonly _spatialGrid: SpatialGrid;

  // Component masks
  private readonly _botMask: number;
  private readonly _targetMask: number;

  // AI state tracking
  private readonly _aiStates: Map<string, BotAIState> = new Map();

  constructor(spatialGrid: SpatialGrid, config?: Partial<BotAIConfig>) {
    super(SystemPriority.AI);

    this._spatialGrid = spatialGrid;

    this._config = {
      reactionDelay: config?.reactionDelay ?? 100,
      accuracy: config?.accuracy ?? 0.8,
      aggression: config?.aggression ?? 0.6,
      abilityUsageChance: config?.abilityUsageChance ?? 0.3,
      predictionDistance: config?.predictionDistance ?? 200,
    };

    this._botMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.VELOCITY,
      ComponentNames.HEALTH,
      ComponentNames.PLAYER
    );

    this._targetMask = createComponentMask(
      ComponentNames.POSITION,
      ComponentNames.HEALTH
    );
  }

  /**
   * Update bot AI
   */
  update(dt: number): void {
    const bots = this._getBotEntities();
    const targets = this._getTargetEntities();

    // Get zone state
    const zoneSystem = this.getEngine()?.getSystemManager()?.getSystem<ZoneSystem>('zone');
    const zoneState = zoneSystem?.getState() ?? ZoneState.IDLE;
    const zoneCenter = zoneSystem?.getCenter() ?? { x: 1750, y: 1250 };
    const zoneRadius = zoneSystem?.getCurrentRadius() ?? 1000;

    for (const bot of bots) {
      const position = bot.getComponent<Position>(ComponentNames.POSITION);
      const velocity = bot.getComponent<Velocity>(ComponentNames.VELOCITY);
      const health = bot.getComponent<Health>(ComponentNames.HEALTH);
      const player = bot.getComponent<Player>(ComponentNames.PLAYER);
      const abilities = bot.getComponent<Abilities>(ComponentNames.ABILITIES);
      const boost = bot.getComponent<Boost>(ComponentNames.BOOST);

      if (!position || !velocity || !health || !player) continue;
      if (!health.isAlive) continue;

      // Get or create AI state
      let aiState = this._aiStates.get(bot.id);
      if (!aiState) {
        aiState = {
          state: AIState.ROAMING,
          targetId: null,
          targetPosition: null,
          lastDecision: 0,
          boostUntil: 0,
          lastAbilityCheck: Date.now() + Math.random() * 2000,
        };
        this._aiStates.set(bot.id, aiState);
      }

      const now = Date.now();

      // Update AI decision
      if (now - aiState.lastDecision >= this._config.reactionDelay) {
        this._makeDecision(bot, position, velocity, health, aiState, targets, zoneState, zoneCenter, zoneRadius);
        aiState.lastDecision = now;
      }

      // Update target angle
      this._updateSteering(bot, position, velocity, aiState, dt);

      // Update boost
      this._updateBoost(bot, boost, aiState, now);

      // Use abilities
      if (abilities && now - aiState.lastAbilityCheck > 500) {
        this._useAbilities(bot, abilities, boost, position, targets, now);
        aiState.lastAbilityCheck = now;
      }
    }

    // Clean up AI states for destroyed or dead entities
    const entityManager = this.entityManager;
    for (const [entityId, _] of this._aiStates) {
      const entity = entityManager.getEntity(entityId);
      if (!entity) {
        this._aiStates.delete(entityId);
        continue;
      }
      // Also clean up dead entities (they won't be respawned with same state)
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      if (health && !health.isAlive) {
        this._aiStates.delete(entityId);
      }
    }
  }

  /**
   * Make AI decision
   */
  private _makeDecision(
    bot: Entity,
    position: Position,
    velocity: Velocity,
    health: Health,
    aiState: BotAIState,
    targets: Entity[],
    zoneState: ZoneState,
    zoneCenter: { x: number; y: number },
    zoneRadius: number
  ): void {
    // Check if in danger (outside zone)
    const distFromZone = Math.sqrt(
      Math.pow(position.x - zoneCenter.x, 2) +
      Math.pow(position.y - zoneCenter.y, 2)
    );

    if (distFromZone > zoneRadius * 0.8) {
      // Head to zone
      aiState.state = AIState.HEADING_TO_ZONE;
      aiState.targetPosition = { ...zoneCenter };
      aiState.targetId = null;
      return;
    }

    // Check for nearby threats (trails)
    const nearestThreat = this._findNearestThreat(position, 100);
    if (nearestThreat) {
      // Flee from threat
      aiState.state = AIState.FLEEING;
      const fleeAngle = Math.atan2(
        position.y - nearestThreat.y,
        position.x - nearestThreat.x
      );
      aiState.targetPosition = {
        x: position.x + Math.cos(fleeAngle) * 200,
        y: position.y + Math.sin(fleeAngle) * 200,
      };
      aiState.targetId = null;
      return;
    }

    // Find target to chase
    if (targets.length > 0 && Math.random() < this._config.aggression) {
      const target = this._selectTarget(position, targets);
      if (target) {
        const pos = target.getComponent<Position>(ComponentNames.POSITION);
        if (pos) {
          aiState.state = AIState.CHASING;
          aiState.targetId = target.id;
          aiState.targetPosition = {
            x: pos.x,
            y: pos.y,
          };
          return;
        }
      }
    }

    // Default to roaming
    aiState.state = AIState.ROAMING;
    aiState.targetId = null;

    // Random destination within arena
    const angle = Math.random() * Math.PI * 2;
    const dist = 200 + Math.random() * 300;
    aiState.targetPosition = {
      x: Math.max(100, Math.min(this._spatialGrid.getConfig().worldWidth - 100, position.x + Math.cos(angle) * dist)),
      y: Math.max(100, Math.min(this._spatialGrid.getConfig().worldHeight - 100, position.y + Math.sin(angle) * dist)),
    };
  }

  /**
   * Find nearest threat (trail point)
   */
  private _findNearestThreat(position: Position, radius: number): { x: number; y: number } | null {
    const nearby = this._spatialGrid.getNearbyEntities(position.x, position.y, radius);

    for (const [id, data] of nearby) {
      const entity = this.entityManager.getEntity(id);
      if (!entity) continue;

      const trail = entity.getComponent<Trail>(ComponentNames.TRAIL);
      if (trail && trail.points.length > 0) {
        // Find closest point
        let closestPoint = null;
        let closestDist = Infinity;

        for (const point of trail.points) {
          const dx = point.x - position.x;
          const dy = point.y - position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < closestDist) {
            closestDist = dist;
            closestPoint = point;
          }
        }

        if (closestPoint && closestDist < 50) {
          return closestPoint;
        }
      }
    }

    return null;
  }

  /**
   * Select target to chase
   */
  private _selectTarget(position: Position, targets: Entity[]): Entity | null {
    // Find closest alive target
    let closest: Entity | null = null;
    let closestDist = Infinity;

    for (const target of targets) {
      const health = target.getComponent<Health>(ComponentNames.HEALTH);
      if (!health || !health.isAlive) continue;

      const pos = target.getComponent<Position>(ComponentNames.POSITION);
      if (!pos) continue;

      const dx = pos.x - position.x;
      const dy = pos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closest = target;
      }
    }

    return closest;
  }

  /**
   * Update steering towards target
   */
  private _updateSteering(
    bot: Entity,
    position: Position,
    velocity: Velocity,
    aiState: BotAIState,
    dt: number
  ): void {
    // Determine target position
    let targetX = aiState.targetPosition?.x;
    let targetY = aiState.targetPosition?.y;

    if (targetX === undefined || targetY === undefined) {
      // No target, maintain current heading
      targetX = position.x + Math.cos(velocity.angle) * 100;
      targetY = position.y + Math.sin(velocity.angle) * 100;
    }

    // Add some noise to target based on accuracy
    if (Math.random() > this._config.accuracy) {
      const noiseAngle = (Math.random() - 0.5) * 0.5;
      const dx = targetX - position.x;
      const dy = targetY - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const currentAngle = Math.atan2(dy, dx);
      const newAngle = currentAngle + noiseAngle;
      targetX = position.x + Math.cos(newAngle) * dist;
      targetY = position.y + Math.sin(newAngle) * dist;
    }

    // Set target angle
    const targetAngle = Math.atan2(targetY - position.y, targetX - position.x);
    velocity.targetAngle = targetAngle;
  }

  /**
   * Update boost usage
   */
  private _updateBoost(bot: Entity, boost: Boost | undefined, aiState: BotAIState, now: number): void {
    if (!boost) return;

    // Stop boosting after timeout
    if (aiState.boostUntil > 0 && now > aiState.boostUntil) {
      boost.isBoosting = false;
      aiState.boostUntil = 0;
    }

    // Boost when chasing
    if (aiState.state === AIState.CHASING && !boost.isBoosting && boost.energy >= boost.minEnergy) {
      if (Math.random() < 0.3) {
        boost.isBoosting = true;
        aiState.boostUntil = now + 1000 + Math.random() * 1000;
      }
    }

    // Boost when fleeing
    if (aiState.state === AIState.FLEEING && !boost.isBoosting && boost.energy >= boost.minEnergy) {
      boost.isBoosting = true;
      aiState.boostUntil = now + 500;
    }
  }

  /**
   * Use abilities
   */
  private _useAbilities(
    bot: Entity,
    abilities: Abilities,
    boost: Boost | undefined,
    position: Position,
    targets: Entity[],
    now: number
  ): void {
    const energy = boost?.energy ?? 100;

    // Shield when fleeing or low health
    if (Math.random() < this._config.abilityUsageChance) {
      if (isAbilityReady(abilities, AbilityType.SHIELD)) {
        if (this._shouldUseShield(bot, position, targets)) {
          abilities.shield.ready = false;
          abilities.shield.cooldownUntil = now + ABILITY_CONFIG[AbilityType.SHIELD].cooldown;
          abilities.shield.activeUntil = now + ABILITY_CONFIG[AbilityType.SHIELD].duration;
          abilities.active.add(AbilityType.SHIELD);
          return;
        }
      }
    }

    // Dash when chasing
    if (Math.random() < this._config.abilityUsageChance * 0.5) {
      if (isAbilityReady(abilities, AbilityType.DASH)) {
        if (this._shouldUseDash(bot, position, targets)) {
          abilities.dash.ready = false;
          abilities.dash.cooldownUntil = now + ABILITY_CONFIG[AbilityType.DASH].cooldown;
          // Apply dash effect
          const velocity = bot.getComponent<Velocity>(ComponentNames.VELOCITY);
          if (velocity) {
            velocity.speed = 600;
          }
          return;
        }
      }
    }

    // Trap when being chased
    if (Math.random() < this._config.abilityUsageChance * 0.3) {
      if (isAbilityReady(abilities, AbilityType.TRAP)) {
        abilities.trap.ready = false;
        abilities.trap.cooldownUntil = now + ABILITY_CONFIG[AbilityType.TRAP].cooldown;
        // Trap is handled by AbilitySystem
        return;
      }
    }

    // Overdrive when aggressive
    if (Math.random() < this._config.abilityUsageChance * 0.2) {
      if (isAbilityReady(abilities, AbilityType.OVERDRIVE)) {
        abilities.overdrive.ready = false;
        abilities.overdrive.cooldownUntil = now + ABILITY_CONFIG[AbilityType.OVERDRIVE].cooldown;
        abilities.overdrive.activeUntil = now + ABILITY_CONFIG[AbilityType.OVERDRIVE].duration;
        abilities.active.add(AbilityType.OVERDRIVE);
        if (boost) {
          boost.speedMultiplier = 2;
        }
        return;
      }
    }
  }

  /**
   * Determine if bot should use shield
   */
  private _shouldUseShield(bot: Entity, position: Position, targets: Entity[]): boolean {
    // Use shield if nearby enemy or in danger
    for (const target of targets) {
      const pos = target.getComponent<Position>(ComponentNames.POSITION);
      if (!pos) continue;

      const dx = pos.x - position.x;
      const dy = pos.y - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine if bot should use dash
   */
  private _shouldUseDash(bot: Entity, position: Position, targets: Entity[]): boolean {
    // Use dash when chasing a target
    if (this._aiStates.get(bot.id)?.state !== AIState.CHASING) {
      return false;
    }

    const targetId = this._aiStates.get(bot.id)?.targetId;
    if (!targetId) return false;

    for (const target of targets) {
      if (target.id === targetId) {
        const pos = target.getComponent<Position>(ComponentNames.POSITION);
        if (!pos) continue;

        const dx = pos.x - position.x;
        const dy = pos.y - position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Dash if target is at medium range
        if (dist > 200 && dist < 400) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get bot entities
   */
  private _getBotEntities(): Entity[] {
    const entities = this.entityManager.queryByMask(this._botMask);
    const bots: Entity[] = [];

    for (const entity of entities) {
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      if (player && player.type === EntityType.BOT) {
        bots.push(entity);
      }
    }

    return bots;
  }

  /**
   * Get target entities (alive players)
   */
  private _getTargetEntities(): Entity[] {
    const entities = this.entityManager.queryByMask(this._targetMask);
    const targets: Entity[] = [];

    for (const entity of entities) {
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      if (health && health.isAlive && player && player.type === EntityType.PLAYER) {
        targets.push(entity);
      }
    }

    return targets;
  }

  /**
   * Get AI state for debug
   */
  getAIState(entityId: string): BotAIState | undefined {
    return this._aiStates.get(entityId);
  }

  /**
   * Set AI config
   */
  setConfig(config: Partial<BotAIConfig>): void {
    Object.assign(this._config, config);
  }
}

/**
 * Factory function
 */
export function createBotAISystem(spatialGrid: SpatialGrid, config?: Partial<BotAIConfig>): BotAISystem {
  return new BotAISystem(spatialGrid, config);
}
