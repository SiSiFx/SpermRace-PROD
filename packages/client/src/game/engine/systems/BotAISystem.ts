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
import { SpatialGrid } from '../spatial/SpatialGrid';
import { ComponentNames, createComponentMask } from '../components';
import type { Entity } from '../core/Entity';
import type { ZoneSystem } from './ZoneSystem';
import type { TrailSystem } from './TrailSystem';
import type { AbilitySystem } from './AbilitySystem';

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

  /** Per-bot accuracy (0–1): sampled once at spawn for permanent personality */
  accuracy: number;

  /** Per-bot aggression (0–1): sampled once at spawn for permanent personality */
  aggression: number;
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
  update(_dt: number): void {
    const bots = this._getBotEntities();
    const targets = this._getTargetEntities();
    const systemManager = this.getEngine()?.getSystemManager();
    const now = Date.now();

    // Get zone state
    const zoneSystem = systemManager?.getSystem<ZoneSystem>('zone');
    const trailSystem = systemManager?.getSystem<TrailSystem>('trails');
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
        // Sample a random personality for this bot — spread across the skill curve
        // so the lobby feels varied (a few easy fish + a few apex predators)
        aiState = {
          state: AIState.ROAMING,
          targetId: null,
          targetPosition: null,
          lastDecision: 0,
          boostUntil: 0,
          lastAbilityCheck: now + Math.random() * 2000,
          accuracy: 0.62 + Math.random() * 0.28,    // 0.62 → 0.90 — no pushover bots, no laser bots
          aggression: 0.40 + Math.random() * 0.35,  // 0.40 → 0.75 — all bots engage, none are killers
        };
        this._aiStates.set(bot.id, aiState);
      }

      // Update AI decision — reaction delay also varies with accuracy (sharp bots react faster)
      const reactionDelay = this._config.reactionDelay * (2.0 - aiState.accuracy);
      if (now - aiState.lastDecision >= reactionDelay) {
        this._makeDecision(position, aiState, targets, bot.id, trailSystem, zoneCenter, zoneRadius);
        aiState.lastDecision = now;
      }

      // Update target angle
      this._updateSteering(position, velocity, aiState);

      // Update boost
      this._updateBoost(boost, aiState, now);

      // Use abilities
      if (abilities && now - aiState.lastAbilityCheck > 500) {
        this._useAbilities(bot, abilities, position, targets, now);
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
    position: Position,
    aiState: BotAIState,
    targets: Entity[],
    selfId: string,
    trailSystem: TrailSystem | undefined,
    zoneCenter: { x: number; y: number },
    zoneRadius: number
  ): void {
    // Check if in danger (outside zone)
    const dxToZone = position.x - zoneCenter.x;
    const dyToZone = position.y - zoneCenter.y;
    const zoneThreshold = zoneRadius * 0.8;

    if (dxToZone * dxToZone + dyToZone * dyToZone > zoneThreshold * zoneThreshold) {
      // Head to zone
      aiState.state = AIState.HEADING_TO_ZONE;
      aiState.targetPosition = { ...zoneCenter };
      aiState.targetId = null;
      return;
    }

    // Reynolds obstacle avoidance: accumulate repulsion forces from ALL nearby trail
    // segments (not just the nearest one) so bots flow around multi-trail hazard fields.
    const avoidForce = this._computeAvoidanceForce(position, 300, trailSystem);
    if (avoidForce !== null) {
      aiState.state = AIState.FLEEING;
      const len = Math.hypot(avoidForce.x, avoidForce.y);
      if (len > 0) {
        aiState.targetPosition = {
          x: position.x + (avoidForce.x / len) * 260,
          y: position.y + (avoidForce.y / len) * 260,
        };
      }
      aiState.targetId = null;
      return;
    }

    // Find target to chase (use per-bot aggression personality)
    if (targets.length > 0 && Math.random() < aiState.aggression) {
      const target = this._selectTarget(position, targets, selfId);
      if (target) {
        const pos = target.getComponent<Position>(ComponentNames.POSITION);
        const vel = target.getComponent<Velocity>(ComponentNames.VELOCITY);
        if (pos) {
          aiState.state = AIState.CHASING;
          aiState.targetId = target.id;

          // Predictive cutting: aim ahead of target using actual speed × time (0.8s).
          // Speed-based lead means a boosted target gets a wider lead, a slow one gets less.
          const leadDist = vel ? Math.min(600, vel.speed * 0.8) : 0;
          const targetAngle = vel?.angle ?? 0;
          aiState.targetPosition = {
            x: pos.x + Math.cos(targetAngle) * leadDist,
            y: pos.y + Math.sin(targetAngle) * leadDist,
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
   * Reynolds obstacle avoidance: sum repulsion vectors from all nearby trail segments.
   * Each segment contributes a force proportional to 1/distance, pushing the bot away.
   * Returns null when no segments are within the danger threshold.
   */
  private _computeAvoidanceForce(
    position: Position,
    radius: number,
    trailSystem: TrailSystem | undefined
  ): { x: number; y: number } | null {
    if (!trailSystem) return null;

    const DANGER_DIST = 120; // px — at 500px/s and 120ms reaction time, bot needs ~60px lead, 120 gives 2× margin
    const DANGER_DIST_SQ = DANGER_DIST * DANGER_DIST;

    let fx = 0;
    let fy = 0;
    let count = 0;

    trailSystem.forEachNearbySegment(position.x, position.y, radius, (seg) => {
      // Use the pre-computed closest point on the segment
      const dx = position.x - seg.hitX;
      const dy = position.y - seg.hitY;
      const distSq = dx * dx + dy * dy;
      if (distSq < 1 || distSq > DANGER_DIST_SQ) return;
      const invDist = 1 / Math.sqrt(distSq);
      // Force weight: stronger the closer the segment
      fx += dx * invDist * invDist;
      fy += dy * invDist * invDist;
      count++;
    });

    if (count === 0) return null;
    return { x: fx, y: fy };
  }

  /**
   * Select target to chase — closest alive entity, excluding self
   */
  private _selectTarget(position: Position, targets: Entity[], selfId: string): Entity | null {
    let closest: Entity | null = null;
    let closestDistSq = Infinity;

    for (const target of targets) {
      if (target.id === selfId) continue;

      const health = target.getComponent<Health>(ComponentNames.HEALTH);
      if (!health || !health.isAlive) continue;

      const pos = target.getComponent<Position>(ComponentNames.POSITION);
      if (!pos) continue;

      const dx = pos.x - position.x;
      const dy = pos.y - position.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closest = target;
      }
    }

    return closest;
  }

  /**
   * Update steering towards target
   */
  private _updateSteering(
    position: Position,
    velocity: Velocity,
    aiState: BotAIState
  ): void {
    // Determine target position
    let targetX = aiState.targetPosition?.x;
    let targetY = aiState.targetPosition?.y;

    if (targetX === undefined || targetY === undefined) {
      // No target, maintain current heading
      targetX = position.x + Math.cos(velocity.angle) * 100;
      targetY = position.y + Math.sin(velocity.angle) * 100;
    }

    // Apply proportional steering noise every frame using per-bot accuracy
    // accuracy 1.0 = laser-precise; 0.45 = noticeably wobbly
    {
      const noiseMag = (1 - aiState.accuracy) * 0.6;
      const noiseAngle = (Math.random() - 0.5) * noiseMag;
      const dx = targetX - position.x;
      const dy = targetY - position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const currentAngle = Math.atan2(dy, dx);
        const newAngle = currentAngle + noiseAngle;
        targetX = position.x + Math.cos(newAngle) * dist;
        targetY = position.y + Math.sin(newAngle) * dist;
      }
    }

    // Set target angle
    const targetAngle = Math.atan2(targetY - position.y, targetX - position.x);
    velocity.targetAngle = targetAngle;
  }

  /**
   * Update boost usage
   */
  private _updateBoost(boost: Boost | undefined, aiState: BotAIState, now: number): void {
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
   * Use abilities — delegates to AbilitySystem so all side-effects fire correctly:
   *   Shield  → health.shielded = true (collision system respects it)
   *   Dash    → vx/vy/angle snapped (not just velocity.speed)
   *   Trap    → _placeTrap() stamps trail points behind bot
   *   Overdrive → trail widening + wall stamp, proper expiry restore
   */
  private _useAbilities(
    bot: Entity,
    abilities: Abilities,
    position: Position,
    targets: Entity[],
    now: number
  ): void {
    const abilitySystem = this.getEngine()?.getSystemManager()?.getSystem<AbilitySystem>('abilities') ?? null;

    // Shield when nearby threat
    if (Math.random() < this._config.abilityUsageChance) {
      if (isAbilityReady(abilities, AbilityType.SHIELD)) {
        if (this._shouldUseShield(position, targets)) {
          abilitySystem?.activateAbility(bot.id, AbilityType.SHIELD);
          return;
        }
      }
    }

    // Dash when chasing
    if (Math.random() < this._config.abilityUsageChance * 0.5) {
      if (isAbilityReady(abilities, AbilityType.DASH)) {
        if (this._shouldUseDash(bot, position, targets)) {
          abilitySystem?.activateAbility(bot.id, AbilityType.DASH);
          return;
        }
      }
    }

    // Trap when being chased
    if (Math.random() < this._config.abilityUsageChance * 0.3) {
      if (isAbilityReady(abilities, AbilityType.TRAP)) {
        abilitySystem?.activateAbility(bot.id, AbilityType.TRAP);
        return;
      }
    }

    // Overdrive when aggressive
    if (Math.random() < this._config.abilityUsageChance * 0.2) {
      if (isAbilityReady(abilities, AbilityType.OVERDRIVE)) {
        abilitySystem?.activateAbility(bot.id, AbilityType.OVERDRIVE);
        return;
      }
    }
  }

  /**
   * Determine if bot should use shield
   */
  private _shouldUseShield(position: Position, targets: Entity[]): boolean {
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
   * Get all alive entities as potential targets (players AND other bots).
   * Bot self-exclusion is handled in _selectTarget via selfId.
   */
  private _getTargetEntities(): Entity[] {
    const entities = this.entityManager.queryByMask(this._targetMask);
    const targets: Entity[] = [];

    for (const entity of entities) {
      const health = entity.getComponent<Health>(ComponentNames.HEALTH);
      const player = entity.getComponent<Player>(ComponentNames.PLAYER);
      if (health && health.isAlive && player) {
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
