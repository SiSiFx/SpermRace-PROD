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

    const desiredAngle = Math.atan2(input.target.y - pos.y, input.target.x - pos.x);
    let diff = desiredAngle - this.aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    const MAX_INPUT_TURN_RAD_PER_S = Math.PI * 2.2; 
    const maxTurn = MAX_INPUT_TURN_RAD_PER_S * deltaTime;
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
    return {
      target: { x: sense.worldWidth / 2, y: sense.worldHeight / 2 },
      accelerate: true,
      boost: false,
      drift: true,
    };
  }

  private detectPanic(sense: BotSense, _dt: number): boolean {
    const self = this.player;
    const pos = self.sperm.position;
    const lookAhead = 150;
    const probeX = pos.x + Math.cos(self.sperm.angle) * lookAhead;
    const probeY = pos.y + Math.sin(self.sperm.angle) * lookAhead;
    if (probeX < 60 || probeY < 60 || probeX > sense.worldWidth - 60 || probeY > sense.worldHeight - 60) return true;
    const dangerRadius = 45;
    for (const p of sense.players) {
      if (!p.isAlive || p.id === self.id) continue;
      for (const point of p.trail) {
        if (Math.hypot(point.x - probeX, point.y - probeY) < dangerRadius) return true;
      }
    }
    return false;
  }
}