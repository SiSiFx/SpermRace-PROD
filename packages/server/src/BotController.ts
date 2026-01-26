import { PlayerInput, GameItem } from 'shared';
import { PlayerEntity } from './Player.js';

type BotState = 'search' | 'hunt' | 'panic' | 'attack';

interface BotSense {
  items: GameItem[];
  players: PlayerEntity[];
  worldWidth: number;
  worldHeight: number;
}

/**
 * BotController drives a PlayerEntity using an enhanced state machine:
 * SEARCH (Gather DNA) 
 * HUNT (Chase player from distance) 
 * ATTACK (Strategic cut-off maneuvers)
 * PANIC (Evade walls and trails)
 */
export class BotController {
  public readonly id: string;
  public readonly player: PlayerEntity;

  private state: BotState = 'search';
  private aimAngle: number;
  private panicTimer: number = 0;

  constructor(player: PlayerEntity) {
    this.player = player;
    this.id = player.id;
    this.aimAngle = player.sperm.angle;
  }

  update(deltaTime: number, sense: BotSense): void {
    if (!this.player.isAlive) return;

    const self = this.player;
    const pos = self.sperm.position;

    // Decrement panic timer
    this.panicTimer = Math.max(0, this.panicTimer - deltaTime);

    const enemies = sense.players.filter(p => p.isAlive && p.id !== self.id);
    const nearestEnemy = this.findNearestEnemy(enemies);
    const nearestDNA = this.findNearestDNA(sense.items, pos);

    const panicDetected = this.detectPanic(sense, deltaTime);

    // STATE TRANSITION LOGIC
    if (panicDetected) {
      this.state = 'panic';
      this.panicTimer = Math.max(this.panicTimer, 0.8);
    } else if (this.panicTimer <= 0) {
      if (nearestEnemy) {
        if (nearestEnemy.dist < 180) {
          this.state = 'attack';
        } else if (nearestEnemy.dist < 650) {
          this.state = 'hunt';
        } else {
          this.state = 'search';
        }
      } else {
        this.state = 'search';
      }
    }

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

    // Calculate desired angle based on target
    let desiredAngle = Math.atan2(input.target.y - pos.y, input.target.x - pos.x);

    // In panic mode, allow faster turning for emergency evasion
    const maxTurnRate = this.state === 'panic' ? Math.PI * 4.0 : Math.PI * 2.2;
    let diff = desiredAngle - this.aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = maxTurnRate * deltaTime;
    const clamped = Math.max(-maxTurn, Math.min(maxTurn, diff));
    this.aimAngle += clamped;

    const aimDistance = 1000;
    input.target = {
      x: pos.x + Math.cos(this.aimAngle) * aimDistance,
      y: pos.y + Math.sin(this.aimAngle) * aimDistance,
    };

    this.player.setInput(input);

    if (input.boost && this.player.canLunge(40)) {
      this.player.tryActivateBoost();
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
    return {
      target: nearestDNA ? { x: nearestDNA.item.x, y: nearestDNA.item.y } : { x: sense.worldWidth / 2, y: sense.worldHeight / 2 },
      accelerate: true,
      boost: false,
      drift: false,
    };
  }

  private buildHuntInput(pos: { x: number; y: number }, nearestEnemy: any, sense: BotSense): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, sense);
    const target = nearestEnemy.player;
    const leadTime = Math.min(1.2, nearestEnemy.dist / 450);
    return {
      target: {
        x: target.sperm.position.x + target.sperm.velocity.x * leadTime,
        y: target.sperm.position.y + target.sperm.velocity.y * leadTime
      },
      accelerate: true,
      boost: nearestEnemy.dist < 300 && Math.random() < 0.2,
      drift: false,
    };
  }

  private buildAttackInput(pos: { x: number; y: number }, nearestEnemy: any, sense: BotSense): PlayerInput {
    if (!nearestEnemy) return this.buildSearchInput(pos, null, sense);
    const target = nearestEnemy.player;
    const angleToTarget = Math.atan2(target.sperm.position.y - pos.y, target.sperm.position.x - pos.x);
    const cutOffAngle = angleToTarget + (Math.random() > 0.5 ? 0.5 : -0.5);
    return {
      target: {
        x: pos.x + Math.cos(cutOffAngle) * 600,
        y: pos.y + Math.sin(cutOffAngle) * 600
      },
      accelerate: true,
      boost: true,
      drift: false,
    };
  }

  private buildPanicInput(pos: { x: number; y: number }, sense: BotSense): PlayerInput {
    // Find the safest evasion direction using multi-directional sampling
    const safeAngle = this.findSafeEvasionDirection(pos, sense);

    // Calculate target point at a safe distance in the chosen direction
    const targetDistance = 600;
    const target = {
      x: pos.x + Math.cos(safeAngle) * targetDistance,
      y: pos.y + Math.sin(safeAngle) * targetDistance,
    };

    return {
      target,
      accelerate: true,
      boost: false, // Don't boost when evading
      drift: true,  // Use drift for tighter turning
    };
  }

  /**
   * Enhanced panic detection using multi-ray casting.
   * Checks multiple directions at multiple distances to detect trail collisions early.
   * Returns true if any of the probe rays detect danger within safety margins.
   */
  private detectPanic(sense: BotSense, _dt: number): boolean {
    const self = this.player;
    const pos = self.sperm.position;
    const currentAngle = self.sperm.angle;

    // Wall detection - check if we're heading toward walls
    const lookAheadDistances = [250, 400];
    for (const lookAhead of lookAheadDistances) {
      const probeX = pos.x + Math.cos(currentAngle) * lookAhead;
      const probeY = pos.y + Math.sin(currentAngle) * lookAhead;
      const wallMargin = 100; // Increased wall margin
      if (probeX < wallMargin || probeY < wallMargin ||
          probeX > sense.worldWidth - wallMargin ||
          probeY > sense.worldHeight - wallMargin) {
        return true;
      }
    }

    // Multi-ray trail detection
    // Cast rays in multiple directions to detect trails early
    const rayAngles = [-0.4, -0.25, -0.1, 0, 0.1, 0.25, 0.4]; // More rays, wider spread
    const rayDistances = [120, 200, 280, 360]; // More distance checks
    const dangerRadius = 80; // Larger safety margin for earlier reaction

    for (const angleOffset of rayAngles) {
      const rayAngle = currentAngle + angleOffset;
      for (const distance of rayDistances) {
        const probeX = pos.x + Math.cos(rayAngle) * distance;
        const probeY = pos.y + Math.sin(rayAngle) * distance;

        // Check if this probe point is near any trail
        if (this.isPointNearTrail(probeX, probeY, dangerRadius, sense)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if a given point is near any trail in the game.
   * Used by panic detection and evasion pathfinding.
   */
  private isPointNearTrail(
    x: number,
    y: number,
    radius: number,
    sense: BotSense
  ): boolean {
    const self = this.player;
    const radiusSq = radius * radius;

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

  /**
   * Finds the safest direction to evade when in panic mode.
   * Samples multiple directions and scores them based on trail density.
   * Returns the angle (in radians) representing the safest escape route.
   */
  private findSafeEvasionDirection(pos: { x: number; y: number }, sense: BotSense): number {
    const self = this.player;
    const currentAngle = self.sperm.angle;

    // Sample directions: spread across -120 to +120 degrees from current heading
    const directions: Array<{ angle: number; score: number }> = [];
    const numSamples = 24; // More samples = better evasion
    const maxAngleOffset = Math.PI * 0.67; // 120 degrees

    for (let i = 0; i < numSamples; i++) {
      const offset = -maxAngleOffset + (2 * maxAngleOffset * i) / (numSamples - 1);
      const angle = currentAngle + offset;

      // Score this direction by checking for trails at multiple distances
      let score = 0;
      const checkDistances = [120, 200, 280, 360, 440];
      const dangerRadius = 75; // Trail detection radius

      for (const dist of checkDistances) {
        const probeX = pos.x + Math.cos(angle) * dist;
        const probeY = pos.y + Math.sin(angle) * dist;

        // Penalty for being near trails (exponential penalty for closer dangers)
        if (this.isPointNearTrail(probeX, probeY, dangerRadius, sense)) {
          // Much higher penalty for closer dangers
          const penalty = (600 - dist) * 1.5; // Stronger penalties
          score -= penalty;
        } else {
          // Bonus for clear path (increases with distance)
          score += 15;
        }

        // Stronger penalty for heading toward walls
        const wallMargin = 120;
        if (probeX < wallMargin || probeY < wallMargin ||
            probeX > sense.worldWidth - wallMargin ||
            probeY > sense.worldHeight - wallMargin) {
          score -= 300; // Increased wall penalty
        }
      }

      // Small bonus for maintaining general direction (prevents erratic behavior)
      const angleDiff = Math.abs(offset);
      score -= angleDiff * 30;

      directions.push({ angle, score });
    }

    // Sort by score (highest first) and return the best direction
    directions.sort((a, b) => b.score - a.score);
    return directions[0].angle;
  }
}