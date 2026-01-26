import { PlayerInput, GameItem } from 'shared';
import { PlayerEntity } from './Player.js';

type BotState = 'search' | 'hunt' | 'panic' | 'attack';

type BotPersonality = 'aggressive' | 'cautious' | 'balanced';

interface BotSense {
  items: GameItem[];
  players: PlayerEntity[];
  worldWidth: number;
  worldHeight: number;
}

interface BotPersonalityTraits {
  reactionTime: number;        // Delay before responding (seconds)
  aimError: number;            // Angular error in radians
  boostFrequency: number;      // How often they boost (0-1)
  riskTolerance: number;       // Willingness to take risks (0-1)
  inconsistency: number;       // How often they make mistakes (0-1)
  panicThreshold: number;      // Distance at which they panic (pixels)
  aggressionDistance: number;  // Distance to engage enemies (pixels)
}

/**
 * BotController drives a PlayerEntity using an enhanced state machine with human-like behaviors:
 * SEARCH (Gather DNA)
 * HUNT (Chase player from distance)
 * ATTACK (Strategic cut-off maneuvers)
 * PANIC (Evade walls and trails)
 *
 * Each bot has a personality that affects their decision-making, reaction times,
 * and tendency to make mistakes - making them feel more like human players.
 */
export class BotController {
  public readonly id: string;
  public readonly player: PlayerEntity;

  private state: BotState = 'search';
  private aimAngle: number;
  private panicTimer: number = 0;

  // Human-like behavior properties
  private personality: BotPersonality;
  private traits: BotPersonalityTraits;
  private reactionTimer: number = 0;
  private stateChangeTimer: number = 0;
  private lastTargetUpdate: number = 0;
  private currentTarget: { x: number; y: number } | null = null;
  private microAdjustmentTimer: number = 0;
  private mistakeTimer: number = 0;
  private hesitationChance: number = 0;

  constructor(player: PlayerEntity) {
    this.player = player;
    this.id = player.id;
    this.aimAngle = player.sperm.angle;

    // Assign a random personality to this bot
    this.personality = this.randomPersonality();
    this.traits = this.getPersonalityTraits(this.personality);

    // Randomize initial reaction timer
    this.reactionTimer = Math.random() * this.traits.reactionTime;
  }

  update(deltaTime: number, sense: BotSense): void {
    if (!this.player.isAlive) return;

    const self = this.player;
    const pos = self.sperm.position;

    // Update reaction timer (human reaction delay)
    this.reactionTimer = Math.max(0, this.reactionTimer - deltaTime);
    this.microAdjustmentTimer = Math.max(0, this.microAdjustmentTimer - deltaTime);
    this.mistakeTimer = Math.max(0, this.mistakeTimer - deltaTime);
    this.stateChangeTimer = Math.max(0, this.stateChangeTimer - deltaTime);

    // Decrement panic timer
    this.panicTimer = Math.max(0, this.panicTimer - deltaTime);

    const enemies = sense.players.filter(p => p.isAlive && p.id !== self.id);
    const nearestEnemy = this.findNearestEnemy(enemies);
    const nearestDNA = this.findNearestDNA(sense.items, pos);

    const panicDetected = this.detectPanic(sense, deltaTime);

    // STATE TRANSITION LOGIC with human-like delays and personality
    if (panicDetected && this.stateChangeTimer <= 0) {
      if (this.state !== 'panic') {
        // Add reaction delay before panicking
        this.reactionTimer = this.traits.reactionTime * (0.5 + Math.random() * 0.5);
      }
      this.state = 'panic';
      this.panicTimer = Math.max(this.panicTimer, 0.8);
      this.stateChangeTimer = 0.3;
    } else if (this.panicTimer <= 0 && this.stateChangeTimer <= 0) {
      if (nearestEnemy) {
        // Personality affects engagement distance
        const engageDist = this.traits.aggressionDistance;
        if (nearestEnemy.dist < 180) {
          if (this.state !== 'attack' || Math.random() < this.traits.inconsistency * 0.3) {
            this.state = 'attack';
            this.stateChangeTimer = 0.2 + Math.random() * 0.3;
          }
        } else if (nearestEnemy.dist < engageDist) {
          if (this.state !== 'hunt' || Math.random() < this.traits.inconsistency * 0.2) {
            this.state = 'hunt';
            this.stateChangeTimer = 0.3 + Math.random() * 0.4;
          }
        } else {
          if (this.state !== 'search' || Math.random() < this.traits.inconsistency * 0.1) {
            this.state = 'search';
            this.stateChangeTimer = 0.5;
          }
        }
      } else {
        if (this.state !== 'search') {
          this.state = 'search';
          this.stateChangeTimer = 0.5;
        }
      }
    }

    // Build input based on current state
    let input: PlayerInput = {
      target: { ...self.input.target },
      accelerate: true,
      boost: false,
      drift: false,
    };

    switch (this.state) {
      case 'panic':
        input = this.buildPanicInput(pos, sense);
        break;
      case 'attack':
        input = this.buildAttackInput(pos, nearestEnemy, sense);
        break;
      case 'hunt':
        input = this.buildHuntInput(pos, nearestEnemy, sense);
        break;
      case 'search':
      default:
        input = this.buildSearchInput(pos, nearestDNA, sense);
        break;
    }

    // Apply human-like behaviors if reaction timer has elapsed
    if (this.reactionTimer <= 0) {
      // Add aiming error based on personality
      const aimError = (Math.random() - 0.5) * 2 * this.traits.aimError;

      // Calculate desired angle with aim error
      const desiredAngle = Math.atan2(input.target.y - pos.y, input.target.x - pos.x) + aimError;
      let diff = desiredAngle - this.aimAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Add micro-adjustments (human-like jitter)
      if (this.microAdjustmentTimer <= 0) {
        const microAdjust = (Math.random() - 0.5) * 0.1;
        diff += microAdjust;
        this.microAdjustmentTimer = 0.1 + Math.random() * 0.15;
      }

      // Turn rate with slight variation (humans aren't perfectly consistent)
      const MAX_INPUT_TURN_RAD_PER_S = Math.PI * 2.2 * (0.95 + Math.random() * 0.1);
      const maxTurn = MAX_INPUT_TURN_RAD_PER_S * deltaTime;
      const clamped = Math.max(-maxTurn, Math.min(maxTurn, diff));
      this.aimAngle += clamped;

      // Occasional mistakes (hesitation, over-steering, etc.)
      if (this.mistakeTimer <= 0 && Math.random() < this.traits.inconsistency * 0.1) {
        this.mistakeTimer = 0.5 + Math.random() * 1.0;
        // Make a mistake: over-steer or hesitate
        if (Math.random() < 0.5) {
          // Over-steer
          this.aimAngle += (Math.random() - 0.5) * 0.3;
        } else {
          // Hesitate (will be handled below)
          this.hesitationChance = 0.7;
        }
      }

      const aimDistance = 1000;
      this.currentTarget = {
        x: pos.x + Math.cos(this.aimAngle) * aimDistance,
        y: pos.y + Math.sin(this.aimAngle) * aimDistance,
      };
    }

    // Apply current target (maintain last known target if still reacting)
    if (this.currentTarget) {
      input.target = { ...this.currentTarget };
    }

    // Apply hesitation (humans sometimes delay actions)
    if (this.hesitationChance > 0 && Math.random() < this.hesitationChance) {
      input.boost = false;
      this.hesitationChance = 0;
    }

    // Modify boost behavior based on personality
    if (input.boost) {
      // Personality affects boost decision
      if (Math.random() > this.traits.boostFrequency) {
        input.boost = false;
      }
      // Risk-tolerant bots boost more in dangerous situations
      if (this.state === 'attack' && this.traits.riskTolerance < 0.3 && Math.random() < 0.3) {
        input.boost = false;
      }
    }

    this.player.setInput(input);

    // Boost activation with personality-based timing
    if (input.boost && this.player.canLunge(40)) {
      // Cautious bots hesitate before boosting
      const hesitation = this.personality === 'cautious' ? Math.random() < 0.2 : false;
      if (!hesitation) {
        this.player.tryActivateBoost();
      }
    }
  }

  private findNearestDNA(items: GameItem[], pos: { x: number; y: number }) {
    let best = null;
    for (const item of items) {
      if (item.type !== 'dna') continue;
      const d = Math.hypot(item.x - pos.x, item.y - pos.y);
      if (!best || d < best.dist) best = { item, dist: d };
    }
    return best;
  }

  private findNearestEnemy(players: PlayerEntity[]) {
    let best = null;
    const selfPos = this.player.sperm.position;
    for (const p of players) {
      const d = Math.hypot(p.sperm.position.x - selfPos.x, p.sperm.position.y - selfPos.y);
      if (!best || d < best.dist) best = { player: p, dist: d };
    }
    return best;
  }

  private buildSearchInput(pos: { x: number; y: number }, nearestDNA: any, sense: BotSense): PlayerInput {
    // Personality affects search behavior
    let targetX, targetY;

    if (nearestDNA) {
      targetX = nearestDNA.item.x;
      targetY = nearestDNA.item.y;
    } else {
      // Different personalities patrol differently when no items
      if (this.personality === 'aggressive') {
        // Aggressive bots patrol edges looking for action
        const edgeOffset = 200;
        targetX = pos.x < sense.worldWidth / 2 ? sense.worldWidth - edgeOffset : edgeOffset;
        targetY = pos.y < sense.worldHeight / 2 ? sense.worldHeight - edgeOffset : edgeOffset;
      } else if (this.personality === 'cautious') {
        // Cautious bots stay near center
        targetX = sense.worldWidth / 2 + (Math.random() - 0.5) * 400;
        targetY = sense.worldHeight / 2 + (Math.random() - 0.5) * 400;
      } else {
        // Balanced bots wander randomly
        targetX = sense.worldWidth / 2;
        targetY = sense.worldHeight / 2;
      }
    }

    return {
      target: { x: targetX, y: targetY },
      accelerate: true,
      boost: false,
      drift: false,
    };
  }

  private buildHuntInput(pos: { x: number; y: number }, nearestEnemy: any, sense: BotSense): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, sense);
    const target = nearestEnemy.player;

    // Personality affects prediction accuracy
    let leadTime;
    if (this.personality === 'aggressive') {
      // Over-commits to predictions (can overshoot)
      leadTime = Math.min(1.4, nearestEnemy.dist / 400);
    } else if (this.personality === 'cautious') {
      // More conservative predictions
      leadTime = Math.min(1.0, nearestEnemy.dist / 500);
    } else {
      // Balanced prediction
      leadTime = Math.min(1.2, nearestEnemy.dist / 450);
    }

    // Add slight prediction error
    leadTime *= (0.9 + Math.random() * 0.2);

    const predictedX = target.sperm.position.x + target.sperm.velocity.x * leadTime;
    const predictedY = target.sperm.position.y + target.sperm.velocity.y * leadTime;

    // Personality affects boost usage during hunt
    const boostChance = this.traits.boostFrequency * 0.4;

    return {
      target: {
        x: predictedX,
        y: predictedY
      },
      accelerate: true,
      boost: nearestEnemy.dist < 350 && Math.random() < boostChance,
      drift: false,
    };
  }

  private buildAttackInput(pos: { x: number; y: number }, nearestEnemy: any, sense: BotSense): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, sense);
    const target = nearestEnemy.player;
    const angleToTarget = Math.atan2(target.sperm.position.y - pos.y, target.sperm.position.x - pos.x);

    // Personality affects attack style
    let cutOffAngle;
    if (this.personality === 'aggressive') {
      // More aggressive cut-offs (riskier)
      cutOffAngle = angleToTarget + (Math.random() > 0.5 ? 0.7 : -0.7);
    } else if (this.personality === 'cautious') {
      // More conservative cut-offs
      cutOffAngle = angleToTarget + (Math.random() > 0.5 ? 0.35 : -0.35);
    } else {
      // Balanced approach
      cutOffAngle = angleToTarget + (Math.random() > 0.5 ? 0.5 : -0.5);
    }

    // Add some randomness to make it less predictable
    cutOffAngle += (Math.random() - 0.5) * 0.2;

    const attackDistance = this.personality === 'aggressive' ? 700 : 600;

    return {
      target: {
        x: pos.x + Math.cos(cutOffAngle) * attackDistance,
        y: pos.y + Math.sin(cutOffAngle) * attackDistance
      },
      accelerate: true,
      boost: true,
      drift: false,
    };
  }

  private buildPanicInput(pos: { x: number; y: number }, sense: BotSense): PlayerInput {
    // Personality affects panic behavior
    let targetX, targetY;

    if (this.personality === 'aggressive') {
      // Aggressive bots might boost-escape (risky)
      return {
        target: { x: sense.worldWidth / 2, y: sense.worldHeight / 2 },
        accelerate: true,
        boost: Math.random() < 0.5,
        drift: true,
      };
    } else if (this.personality === 'cautious') {
      // Cautious bots drift toward center carefully
      targetX = sense.worldWidth / 2;
      targetY = sense.worldHeight / 2;
      return {
        target: { x: targetX, y: targetY },
        accelerate: true,
        boost: false,
        drift: true,
      };
    } else {
      // Balanced bots
      targetX = sense.worldWidth / 2;
      targetY = sense.worldHeight / 2;
      return {
        target: { x: targetX, y: targetY },
        accelerate: true,
        boost: Math.random() < 0.2,
        drift: true,
      };
    }
  }

  private detectPanic(sense: BotSense, _dt: number): boolean {
    const self = this.player;
    const pos = self.sperm.position;

    // Personality affects panic threshold
    const lookAhead = this.traits.panicThreshold;
    const probeX = pos.x + Math.cos(self.sperm.angle) * lookAhead;
    const probeY = pos.y + Math.sin(self.sperm.angle) * lookAhead;

    // Wall detection with personality-based buffer
    const wallBuffer = this.personality === 'cautious' ? 80 : 60;
    if (probeX < wallBuffer || probeY < wallBuffer ||
        probeX > sense.worldWidth - wallBuffer || probeY > sense.worldHeight - wallBuffer) {
      // Risk-tolerant bots might ignore wall danger if chasing
      if (this.traits.riskTolerance > 0.6 && this.state === 'attack' && Math.random() < 0.4) {
        return false;
      }
      return true;
    }

    // Trail collision detection
    const dangerRadius = this.personality === 'cautious' ? 55 : 45;
    for (const p of sense.players) {
      if (!p.isAlive || p.id === self.id) continue;
      for (const point of p.trail) {
        if (Math.hypot(point.x - probeX, point.y - probeY) < dangerRadius) {
          // Risk-tolerant bots might ignore trail danger if attacking
          if (this.traits.riskTolerance > 0.7 && this.state === 'attack' && Math.random() < 0.3) {
            return false;
          }
          return true;
        }
      }
    }
    return false;
  }

  private randomPersonality(): BotPersonality {
    const rand = Math.random();
    if (rand < 0.33) return 'aggressive';
    if (rand < 0.66) return 'cautious';
    return 'balanced';
  }

  private getPersonalityTraits(personality: BotPersonality): BotPersonalityTraits {
    switch (personality) {
      case 'aggressive':
        return {
          reactionTime: 0.15 + Math.random() * 0.1,     // Fast reactions
          aimError: 0.08 + Math.random() * 0.05,         // Less accurate (rushing)
          boostFrequency: 0.85 + Math.random() * 0.15,   // Boosts often
          riskTolerance: 0.75 + Math.random() * 0.2,     // High risk tolerance
          inconsistency: 0.4 + Math.random() * 0.2,      // Somewhat inconsistent
          panicThreshold: 120,                            // Panics later
          aggressionDistance: 700,                       // Engages from further
        };

      case 'cautious':
        return {
          reactionTime: 0.25 + Math.random() * 0.15,     // Slower reactions
          aimError: 0.03 + Math.random() * 0.02,         // More accurate
          boostFrequency: 0.4 + Math.random() * 0.2,     // Boosts rarely
          riskTolerance: 0.15 + Math.random() * 0.15,    // Low risk tolerance
          inconsistency: 0.2 + Math.random() * 0.15,     // More consistent
          panicThreshold: 180,                            // Panics earlier
          aggressionDistance: 500,                       // Engages from closer
        };

      case 'balanced':
      default:
        return {
          reactionTime: 0.2 + Math.random() * 0.1,      // Average reactions
          aimError: 0.05 + Math.random() * 0.04,        // Average accuracy
          boostFrequency: 0.6 + Math.random() * 0.2,    // Moderate boosting
          riskTolerance: 0.45 + Math.random() * 0.2,    // Moderate risk
          inconsistency: 0.3 + Math.random() * 0.2,     // Average inconsistency
          panicThreshold: 150,                           // Average panic distance
          aggressionDistance: 600,                       // Average engagement
        };
    }
  }
}