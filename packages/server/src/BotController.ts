import { PlayerInput, GameItem } from 'shared';
import { PlayerEntity } from './Player.js';

type BotState = 'search' | 'hunt' | 'panic' | 'ambush' | 'flee' | 'circle';

interface BotMemory {
  lastKnownPlayerPositions: Map<string, { x: number; y: number; time: number }>;
  dangerousAreas: Array<{ x: number; y: number; radius: number; time: number }>;
  lastBoostTime: number;
  huntingSuccessCount: number;
  evasionSuccessCount: number;
  preferredDirection: number;
  targetAcquisitionTimer: number;
  zigzagTimer: number;
}

interface BotSense {
  items: GameItem[];
  players: PlayerEntity[];
  worldWidth: number;
  worldHeight: number;
}

/**
 * Enhanced BotController with sophisticated AI and memory system:
 * SEARCH → HUNT → AMBUSH → PANIC → FLEE → CIRCLE. All movement is server-authoritative.
 */
export class BotController {
  public readonly id: string;
  public readonly player: PlayerEntity;

  private state: BotState = 'search';
  private aimAngle: number;
  private panicTimer: number = 0;
  private memory: BotMemory;
  private lastStateChange: number = 0;
  private targetPlayer: string | null = null;
  private huntingPersistence: number = 0;
  private ambushTimer: number = 0;
  private skillLevel: number; // 0.5 to 1.5, affects bot intelligence

  constructor(player: PlayerEntity) {
    this.player = player;
    this.id = player.id;
    this.aimAngle = player.sperm.angle;
    this.skillLevel = 0.7 + Math.random() * 0.6; // Vary bot skill levels
    
    this.memory = {
      lastKnownPlayerPositions: new Map(),
      dangerousAreas: [],
      lastBoostTime: Date.now(),
      huntingSuccessCount: 0,
      evasionSuccessCount: 0,
      preferredDirection: Math.random() * Math.PI * 2,
      targetAcquisitionTimer: 0,
      zigzagTimer: 0
    };
  }

  update(deltaTime: number, sense: BotSense): void {
    if (!this.player.isAlive) return;

    const self = this.player;
    const pos = self.sperm.position;
    const now = Date.now();

    // Update timers
    this.panicTimer = Math.max(0, this.panicTimer - deltaTime);
    this.memory.targetAcquisitionTimer += deltaTime;
    this.memory.zigzagTimer += deltaTime;
    this.ambushTimer = Math.max(0, this.ambushTimer - deltaTime);
    this.lastStateChange += deltaTime;

    // Update memory
    this.updateMemory(sense, now);
    this.cleanupOldMemories(now);

    const enemies = sense.players.filter(p => p.isAlive && p.id !== self.id);
    const nearestEnemy = this.findNearestEnemy(enemies);
    const nearestDNA = this.findNearestDNA(sense.items, pos);

    // Advanced state determination
    this.determineState(sense, nearestEnemy, deltaTime);

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
      case 'flee':
        input = this.buildFleeInput(pos, sense, nearestEnemy);
        break;
      case 'ambush':
        input = this.buildAmbushInput(pos, nearestEnemy, sense);
        break;
      case 'hunt':
        input = this.buildHuntInput(pos, nearestEnemy, sense);
        break;
      case 'circle':
        input = this.buildCircleInput(pos, sense);
        break;
      case 'search':
      default:
        input = this.buildSearchInput(pos, nearestDNA, sense);
        break;
    }

    // Enhanced aim smoothing with skill-based adjustments
    const desiredAngle = Math.atan2(input.target.y - pos.y, input.target.x - pos.x);
    let diff = desiredAngle - this.aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    // Skill-based turn rate
    const maxTurnRate = Math.PI * (1.8 * this.skillLevel);
    const maxTurn = maxTurnRate * deltaTime;
    const clamped = Math.max(-maxTurn, Math.min(maxTurn, diff));
    this.aimAngle += clamped;

    const aimDistance = 900 + Math.random() * 200 * this.skillLevel;
    const smoothedTarget = {
      x: pos.x + Math.cos(this.aimAngle) * aimDistance,
      y: pos.y + Math.sin(this.aimAngle) * aimDistance,
    };
    input.target = smoothedTarget;

    // Apply input to underlying player
    this.player.setInput(input);

    // Smart boost activation based on skill level and situation
    if (input.boost && this.player.canLunge(50)) {
      const shouldBoost = this.shouldActivateBoost(nearestEnemy, deltaTime);
      if (shouldBoost) {
        this.player.tryActivateBoost();
        this.memory.lastBoostTime = now;
      }
    }
  }

  private findNearestDNA(items: GameItem[], pos: { x: number; y: number }) {
    let best: { item: GameItem; dist: number } | null = null;
    for (const item of items) {
      if (item.type !== 'dna') continue;
      const dx = item.x - pos.x;
      const dy = item.y - pos.y;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.dist) best = { item, dist: d };
    }
    return best;
  }

  private findNearestEnemy(players: PlayerEntity[]) {
    let best: { player: PlayerEntity; dist: number } | null = null;
    const selfPos = this.player.sperm.position;
    for (const p of players) {
      const dx = p.sperm.position.x - selfPos.x;
      const dy = p.sperm.position.y - selfPos.y;
      const d = Math.hypot(dx, dy);
      if (!best || d < best.dist) best = { player: p, dist: d };
    }
    return best;
  }

  private updateMemory(sense: BotSense, now: number) {
    // Update known player positions
    for (const player of sense.players) {
      if (player.id === this.id || !player.isAlive) continue;
      this.memory.lastKnownPlayerPositions.set(player.id, {
        x: player.sperm.position.x,
        y: player.sperm.position.y,
        time: now
      });
    }

    // Mark dangerous areas (recent collisions/explosions)
    for (const player of sense.players) {
      if (player.id === this.id || !player.isAlive) continue;
      if (player.trail.length > 0) {
        const recentPoint = player.trail[player.trail.length - 1];
        if (recentPoint.createdAt && now - recentPoint.createdAt < 2000) { // Last 2 seconds
          this.memory.dangerousAreas.push({
            x: recentPoint.x,
            y: recentPoint.y,
            radius: 40,
            time: now
          });
        }
      }
    }
  }

  private cleanupOldMemories(now: number) {
    // Remove old player position memories (older than 5 seconds)
    for (const [playerId, data] of this.memory.lastKnownPlayerPositions.entries()) {
      if (now - data.time > 5000) {
        this.memory.lastKnownPlayerPositions.delete(playerId);
      }
    }

    // Remove old dangerous areas (older than 3 seconds)
    this.memory.dangerousAreas = this.memory.dangerousAreas.filter(
      area => now - area.time < 3000
    );
  }

  private determineState(sense: BotSense, nearestEnemy: { player: PlayerEntity; dist: number } | null, deltaTime: number) {
    const panicDetected = this.detectPanic(sense, deltaTime);
    const shouldFlee = this.shouldFlee(nearestEnemy);
    const shouldAmbush = this.shouldAmbush(nearestEnemy);
    const shouldCircle = this.shouldCircle(sense, deltaTime);

    // State transition logic
    if (panicDetected || shouldFlee) {
      this.state = shouldFlee ? 'flee' : 'panic';
      this.panicTimer = Math.max(this.panicTimer, 0.8);
    } else if (shouldAmbush && this.ambushTimer <= 0) {
      this.state = 'ambush';
      this.ambushTimer = 2.0; // ambush for 2 seconds
    } else if (this.panicTimer <= 0 && this.ambushTimer <= 0) {
      if (nearestEnemy && nearestEnemy.dist < 350 * this.skillLevel) {
        this.state = 'hunt';
        this.huntingPersistence = Math.min(this.huntingPersistence + deltaTime, 3.0);
      } else if (shouldCircle) {
        this.state = 'circle';
      } else {
        this.state = 'search';
        this.huntingPersistence = Math.max(0, this.huntingPersistence - deltaTime * 0.5);
      }
    }
  }

  private shouldFlee(nearestEnemy: { player: PlayerEntity; dist: number } | null): boolean {
    if (!nearestEnemy) return false;
    
    // Flee if enemy is very close and has more energy/speed advantage
    const enemyEnergy = nearestEnemy.player.getBoostEnergy();
    const myEnergy = this.player.getBoostEnergy();
    const energyDisadvantage = enemyEnergy > myEnergy + 30;
    
    return nearestEnemy.dist < 200 && energyDisadvantage && Math.random() < 0.3;
  }

  private shouldAmbush(nearestEnemy: { player: PlayerEntity; dist: number } | null): boolean {
    if (!nearestEnemy) return false;
    
    // Ambush when enemy is nearby but not actively hunting
    const dist = nearestEnemy.dist;
    const canSeeTarget = dist > 150 && dist < 400;
    const enemyNotLooking = Math.random() < 0.2 * this.skillLevel;
    
    return canSeeTarget && enemyNotLooking && Math.random() < 0.1;
  }

  private shouldCircle(sense: BotSense, deltaTime: number): boolean {
    // Circle when low on health/energy or in center of arena
    const boostEnergy = this.player.getBoostEnergy();
    const pos = this.player.sperm.position;
    const center = { x: sense.worldWidth / 2, y: sense.worldHeight / 2 };
    const distFromCenter = Math.hypot(pos.x - center.x, pos.y - center.y);
    
    return boostEnergy < 30 || distFromCenter < 200;
  }

  private shouldActivateBoost(nearestEnemy: { player: PlayerEntity; dist: number } | null, deltaTime: number): boolean {
    if (!nearestEnemy) return Math.random() < 0.1 * this.skillLevel;
    
    const dist = nearestEnemy.dist;
    const now = Date.now();
    const timeSinceLastBoost = now - this.memory.lastBoostTime;
    
    // Boost when enemy is in good range or escaping danger
    if (dist < 250 && dist > 80) return true;
    if (timeSinceLastBoost > 3000 && Math.random() < 0.3 * this.skillLevel) return true;
    
    return false;
  }

  private buildSearchInput(pos: { x: number; y: number }, nearestDNA: { item: GameItem; dist: number } | null, sense: BotSense): PlayerInput {
    let target: { x: number; y: number };
    
    if (nearestDNA && nearestDNA.dist < 600) {
      target = { x: nearestDNA.item.x, y: nearestDNA.item.y };
    } else {
      // Smart patrol pattern
      const patrolRadius = Math.min(sense.worldWidth, sense.worldHeight) * 0.3;
      const angle = this.memory.preferredDirection + Math.sin(Date.now() * 0.001) * 0.5;
      target = {
        x: sense.worldWidth / 2 + Math.cos(angle) * patrolRadius,
        y: sense.worldHeight / 2 + Math.sin(angle) * patrolRadius
      };
    }

    return {
      target,
      accelerate: true,
      boost: false,
      drift: Math.random() < 0.1 * this.skillLevel,
    };
  }

  private buildHuntInput(pos: { x: number; y: number }, nearestEnemy: { player: PlayerEntity; dist: number } | null, sense: BotSense): PlayerInput {
    if (!nearestEnemy) {
      return this.buildSearchInput(pos, null, sense);
    }

    const targetPlayer = nearestEnemy.player;
    const dist = nearestEnemy.dist;
    
    // Enhanced prediction based on target's recent movements
    const leadTime = Math.min(1.2, dist / 500) * this.skillLevel;
    const predicted = {
      x: targetPlayer.sperm.position.x + targetPlayer.sperm.velocity.x * leadTime,
      y: targetPlayer.sperm.position.y + targetPlayer.sperm.velocity.y * leadTime,
    };

    // Add slight randomization to avoid predictable paths
    const randomOffset = (Math.random() - 0.5) * 50 * (2 - this.skillLevel);
    predicted.x += randomOffset;
    predicted.y += randomOffset;

    const canBoost = this.player.getBoostEnergy() > 40 && this.player.canLunge(40);

    return {
      target: predicted,
      accelerate: true,
      boost: canBoost,
      drift: dist < 200 && Math.random() < 0.3,
    };
  }

  private buildPanicInput(pos: { x: number; y: number }, sense: BotSense): PlayerInput {
    // Steer toward arena center while drifting to brake hard
    const center = { x: sense.worldWidth / 2, y: sense.worldHeight / 2 };
    return {
      target: center,
      accelerate: true,
      boost: false,
      drift: true,
    };
  }

  private buildFleeInput(pos: { x: number; y: number }, sense: BotSense, nearestEnemy: { player: PlayerEntity; dist: number } | null): PlayerInput {
    if (!nearestEnemy) {
      return this.buildPanicInput(pos, sense);
    }

    // Flee away from nearest enemy with some randomness
    const dx = pos.x - nearestEnemy.player.sperm.position.x;
    const dy = pos.y - nearestEnemy.player.sperm.position.y;
    const dist = Math.hypot(dx, dy) || 1;
    
    const fleeDistance = 400;
    const target = {
      x: pos.x + (dx / dist) * fleeDistance,
      y: pos.y + (dy / dist) * fleeDistance
    };

    return {
      target,
      accelerate: true,
      boost: this.player.getBoostEnergy() > 60,
      drift: true,
    };
  }

  private buildAmbushInput(pos: { x: number; y: number }, nearestEnemy: { player: PlayerEntity; dist: number } | null, sense: BotSense): PlayerInput {
    if (!nearestEnemy) {
      return this.buildSearchInput(pos, null, sense);
    }

    // Position behind or to the side of the target for ambush
    const targetPlayer = nearestEnemy.player;
    const dx = targetPlayer.sperm.position.x - pos.x;
    const dy = targetPlayer.sperm.position.y - pos.y;
    const dist = Math.hypot(dx, dy) || 1;
    
    const ambushDistance = 200;
    const perpendicularAngle = Math.atan2(dy, dx) + Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
    
    const target = {
      x: targetPlayer.sperm.position.x + Math.cos(perpendicularAngle) * ambushDistance,
      y: targetPlayer.sperm.position.y + Math.sin(perpendicularAngle) * ambushDistance
    };

    return {
      target,
      accelerate: true,
      boost: false, // Save energy for the strike
      drift: Math.random() < 0.4,
    };
  }

  private buildCircleInput(pos: { x: number; y: number }, sense: BotSense): PlayerInput {
    const center = { x: sense.worldWidth / 2, y: sense.worldHeight / 2 };
    const angle = Math.atan2(pos.y - center.y, pos.x - center.x) + Math.PI / 2;
    
    const circleRadius = 300;
    const target = {
      x: center.x + Math.cos(angle) * circleRadius,
      y: center.y + Math.sin(angle) * circleRadius
    };

    return {
      target,
      accelerate: true,
      boost: false,
      drift: Math.random() < 0.6,
    };
  }

  private detectPanic(sense: BotSense, _dt: number): boolean {
    const self = this.player;
    const pos = self.sperm.position;
    const dirX = Math.cos(self.sperm.angle);
    const dirY = Math.sin(self.sperm.angle);
    const lookAhead = 120;
    const probeX = pos.x + dirX * lookAhead;
    const probeY = pos.y + dirY * lookAhead;

    // Wall proximity
    const margin = 50;
    if (
      probeX < margin ||
      probeY < margin ||
      probeX > sense.worldWidth - margin ||
      probeY > sense.worldHeight - margin
    ) {
      return true;
    }

    // Check dangerous areas from memory
    for (const danger of this.memory.dangerousAreas) {
      const dx = probeX - danger.x;
      const dy = probeY - danger.y;
      if ((dx * dx + dy * dy) <= danger.radius * danger.radius) {
        return true;
      }
    }

    // Approximate trail hazard: any trail point from other players within radius of probe
    const dangerRadius = 35;
    const dangerSq = dangerRadius * dangerRadius;
    for (const p of sense.players) {
      if (!p.isAlive || p.id === self.id) continue;
      for (const point of p.trail) {
        const dx = point.x - probeX;
        const dy = point.y - probeY;
        if ((dx * dx + dy * dy) <= dangerSq) {
          return true;
        }
      }
    }

    return false;
  }
}
