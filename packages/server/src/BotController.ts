import { PlayerInput, GameItem } from 'shared';
import { PlayerEntity } from './Player.js';

type BotState = 'search' | 'hunt' | 'attack' | 'panic';
type BotPersonality = 'aggressive' | 'cautious' | 'balanced';

export interface BotTrailQuery {
  hasPointNear(x: number, y: number, radius: number, excludePlayerId?: string): boolean;
}

interface BotSense {
  items: GameItem[];
  players: PlayerEntity[];
  worldWidth: number;
  worldHeight: number;
  trailQuery?: BotTrailQuery;
}

interface BotTraits {
  reactionTime: number;
  aimError: number;
  boostFrequency: number;
  riskTolerance: number;
  inconsistency: number;
  panicThreshold: number;
  aggressionDistance: number;
}

/**
 * SLITHER.IO-STYLE BOT CONTROLLER
 * Simpler, more predictable AI that works with streamlined physics
 */
export class BotController {
  public readonly id: string;
  public readonly player: PlayerEntity;

  private state: BotState = 'search';
  private aimAngle: number;
  private panicTimer: number = 0;
  private stateChangeTimer: number = 0;
  private currentTarget: { x: number; y: number } | null = null;
  private reactionTimer: number = 0;
  private mistakeTimer: number = 0;
  private boostTimer: number = 0;

  private personality: BotPersonality;
  private traits: BotTraits;

  constructor(player: PlayerEntity) {
    this.player = player;
    this.id = player.id;
    this.aimAngle = player.sperm.angle;
    this.personality = this.randomPersonality();
    this.traits = this.getTraits(this.personality);
    this.reactionTimer = Math.random() * this.traits.reactionTime;
  }

  update(deltaTime: number, sense: BotSense): void {
    if (!this.player.isAlive) return;

    const self = this.player;
    const pos = self.sperm.position;

    // Update timers
    this.reactionTimer = Math.max(0, this.reactionTimer - deltaTime);
    this.stateChangeTimer = Math.max(0, this.stateChangeTimer - deltaTime);
    this.panicTimer = Math.max(0, this.panicTimer - deltaTime);
    this.boostTimer = Math.max(0, this.boostTimer - deltaTime);
    this.mistakeTimer = Math.max(0, this.mistakeTimer - deltaTime);

    const nearestEnemy = this.findNearestEnemy(sense.players);
    const nearestDNA = this.findNearestDNA(sense.items, pos);

    // PANIC detection (walls and trails)
    const panicDetected = this.detectPanic(sense, pos);

    // State transitions
    if (panicDetected && this.stateChangeTimer <= 0) {
      if (this.state !== 'panic') {
        this.reactionTimer = this.traits.reactionTime * 0.5;
      }
      this.state = 'panic';
      this.panicTimer = Math.max(this.panicTimer, 1.0);
      this.stateChangeTimer = 0.3;
    } else if (this.panicTimer <= 0 && this.stateChangeTimer <= 0) {
      if (nearestEnemy) {
        const dist = nearestEnemy.dist;
        if (dist < 150) {
          this.state = 'attack';
          this.stateChangeTimer = 0.3;
        } else if (dist < this.traits.aggressionDistance) {
          this.state = 'hunt';
          this.stateChangeTimer = 0.4;
        } else {
          this.state = 'search';
          this.stateChangeTimer = 0.6;
        }
      } else {
        this.state = 'search';
        this.stateChangeTimer = 0.6;
      }
    }

    // Build input based on state
    let input: PlayerInput = {
      target: { ...self.input.target },
      accelerate: true,
      boost: false,
    };

    switch (this.state) {
      case 'panic':
        input = this.buildPanicInput(pos, sense);
        break;
      case 'attack':
        input = this.buildAttackInput(pos, nearestEnemy);
        break;
      case 'hunt':
        input = this.buildHuntInput(pos, nearestEnemy);
        break;
      case 'search':
      default:
        input = this.buildSearchInput(pos, nearestDNA, sense);
        break;
    }

    // Apply human-like behaviors
    if (this.reactionTimer <= 0) {
      // Add aiming error
      const aimError = (Math.random() - 0.5) * 2 * this.traits.aimError;
      const desiredAngle = Math.atan2(input.target.y - pos.y, input.target.x - pos.x) + aimError;
      
      let diff = desiredAngle - this.aimAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Smooth turn rate
      const maxTurn = this.state === 'panic' ? Math.PI * 3 : Math.PI * 2;
      const clamped = Math.max(-maxTurn * deltaTime, Math.min(maxTurn * deltaTime, diff));
      this.aimAngle += clamped;

      // Occasional mistakes
      if (this.mistakeTimer <= 0 && Math.random() < this.traits.inconsistency * 0.1) {
        this.mistakeTimer = 0.5 + Math.random();
        this.aimAngle += (Math.random() - 0.5) * 0.4;
      }

      const aimDistance = 800;
      this.currentTarget = {
        x: pos.x + Math.cos(this.aimAngle) * aimDistance,
        y: pos.y + Math.sin(this.aimAngle) * aimDistance,
      };
    }

    if (this.currentTarget) {
      input.target = { ...this.currentTarget };
    }

    // Boost decision
    if (input.boost && Math.random() > this.traits.boostFrequency) {
      input.boost = false;
    }

    self.setInput(input);

    // Activate boost
    if (input.boost && self.canLunge(20) && this.boostTimer <= 0) {
      if (self.tryActivateBoost()) {
        this.boostTimer = 1.5;
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
      if (!p.isAlive || p.id === this.player.id) continue;
      const d = Math.hypot(p.sperm.position.x - selfPos.x, p.sperm.position.y - selfPos.y);
      if (!best || d < best.dist) best = { player: p, dist: d };
    }
    return best;
  }

  private buildSearchInput(pos: { x: number; y: number }, nearestDNA: any, sense: BotSense): PlayerInput {
    let targetX, targetY;

    if (nearestDNA) {
      targetX = nearestDNA.item.x;
      targetY = nearestDNA.item.y;
    } else {
      // Patrol pattern based on personality
      if (this.personality === 'aggressive') {
        // Circle the center looking for action
        const time = Date.now() / 1000;
        const radius = Math.min(sense.worldWidth, sense.worldHeight) * 0.3;
        targetX = sense.worldWidth / 2 + Math.cos(time) * radius;
        targetY = sense.worldHeight / 2 + Math.sin(time) * radius;
      } else {
        // Move toward center
        targetX = sense.worldWidth / 2 + (Math.random() - 0.5) * 400;
        targetY = sense.worldHeight / 2 + (Math.random() - 0.5) * 400;
      }
    }

    return {
      target: { x: targetX, y: targetY },
      accelerate: true,
      boost: false,
    };
  }

  private buildHuntInput(pos: { x: number; y: number }, nearestEnemy: any): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, { worldWidth: 3000, worldHeight: 2000, items: [], players: [] });
    
    const target = nearestEnemy.player;
    
    // Simple prediction
    const leadTime = Math.min(0.8, nearestEnemy.dist / 400);
    const predictedX = target.sperm.position.x + target.sperm.velocity.x * leadTime;
    const predictedY = target.sperm.position.y + target.sperm.velocity.y * leadTime;

    return {
      target: { x: predictedX, y: predictedY },
      accelerate: true,
      boost: nearestEnemy.dist < 250 && Math.random() < this.traits.boostFrequency * 0.6,
    };
  }

  private buildAttackInput(pos: { x: number; y: number }, nearestEnemy: any): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, { worldWidth: 3000, worldHeight: 2000, items: [], players: [] });
    
    const target = nearestEnemy.player;
    const angleToTarget = Math.atan2(target.sperm.position.y - pos.y, target.sperm.position.x - pos.x);
    
    // Cut-off maneuver - try to get in front of target
    const cutOffAngle = angleToTarget + (Math.random() > 0.5 ? 0.6 : -0.6);
    const attackDist = 500;

    return {
      target: {
        x: pos.x + Math.cos(cutOffAngle) * attackDist,
        y: pos.y + Math.sin(cutOffAngle) * attackDist,
      },
      accelerate: true,
      boost: true,
    };
  }

  private buildPanicInput(pos: { x: number; y: number }, sense: BotSense): PlayerInput {
    const safeAngle = this.findSafeEvasionDirection(pos, sense);
    
    return {
      target: {
        x: pos.x + Math.cos(safeAngle) * 600,
        y: pos.y + Math.sin(safeAngle) * 600,
      },
      accelerate: true,
      boost: Math.random() < 0.7,
    };
  }

  private detectPanic(sense: BotSense, pos: { x: number; y: number }): boolean {
    const self = this.player;
    const angle = self.sperm.angle;

    // Wall detection
    const wallBuffer = this.traits.panicThreshold;
    const lookAhead = 200;
    const probeX = pos.x + Math.cos(angle) * lookAhead;
    const probeY = pos.y + Math.sin(angle) * lookAhead;
    
    if (probeX < wallBuffer || probeY < wallBuffer ||
        probeX > sense.worldWidth - wallBuffer ||
        probeY > sense.worldHeight - wallBuffer) {
      return true;
    }

    // Trail detection (simplified ray cast)
    const rayAngles = [-0.3, -0.15, 0, 0.15, 0.3];
    const dangerRadius = 60;
    
    for (const offset of rayAngles) {
      const rayAngle = angle + offset;
      for (const dist of [100, 180]) {
        const px = pos.x + Math.cos(rayAngle) * dist;
        const py = pos.y + Math.sin(rayAngle) * dist;
        
        if (this.isPointNearTrail(px, py, dangerRadius, sense)) {
          return true;
        }
      }
    }

    return false;
  }

  private isPointNearTrail(x: number, y: number, radius: number, sense: BotSense): boolean {
    const radiusSq = radius * radius;
    const self = this.player;

    if (sense.trailQuery) {
      return sense.trailQuery.hasPointNear(x, y, radius, self.id);
    }

    for (const p of sense.players) {
      if (!p.isAlive || p.id === self.id) continue;
      for (const point of p.trail) {
        const dx = point.x - x;
        const dy = point.y - y;
        if (dx * dx + dy * dy < radiusSq) {
          return true;
        }
      }
    }
    return false;
  }

  private findSafeEvasionDirection(pos: { x: number; y: number }, sense: BotSense): number {
    const self = this.player;
    const currentAngle = self.sperm.angle;
    
    const directions: Array<{ angle: number; score: number }> = [];
    const numSamples = 16;
    
    for (let i = 0; i < numSamples; i++) {
      const offset = -Math.PI * 0.5 + (Math.PI * i) / (numSamples - 1); // -90 to +90 degrees
      const angle = currentAngle + offset;
      
      let score = 0;
      const checkDistances = [100, 200, 300];
      const dangerRadius = 70;

      for (const dist of checkDistances) {
        const px = pos.x + Math.cos(angle) * dist;
        const py = pos.y + Math.sin(angle) * dist;

        if (this.isPointNearTrail(px, py, dangerRadius, sense)) {
          score -= (400 - dist);
        } else {
          score += 20;
        }

        // Wall penalty
        if (px < 120 || py < 120 || px > sense.worldWidth - 120 || py > sense.worldHeight - 120) {
          score -= 500;
        }
      }

      // Prefer directions closer to current heading
      score -= Math.abs(offset) * 50;
      
      directions.push({ angle, score });
    }

    directions.sort((a, b) => b.score - a.score);
    return directions[0]?.angle ?? currentAngle;
  }

  private randomPersonality(): BotPersonality {
    const rand = Math.random();
    if (rand < 0.33) return 'aggressive';
    if (rand < 0.66) return 'cautious';
    return 'balanced';
  }

  private getTraits(personality: BotPersonality): BotTraits {
    switch (personality) {
      case 'aggressive':
        return {
          reactionTime: 0.12,
          aimError: 0.1,
          boostFrequency: 0.8,
          riskTolerance: 0.8,
          inconsistency: 0.35,
          panicThreshold: 100,
          aggressionDistance: 600,
        };
      case 'cautious':
        return {
          reactionTime: 0.22,
          aimError: 0.04,
          boostFrequency: 0.4,
          riskTolerance: 0.2,
          inconsistency: 0.15,
          panicThreshold: 160,
          aggressionDistance: 400,
        };
      default:
        return {
          reactionTime: 0.17,
          aimError: 0.07,
          boostFrequency: 0.6,
          riskTolerance: 0.5,
          inconsistency: 0.25,
          panicThreshold: 130,
          aggressionDistance: 500,
        };
    }
  }
}
