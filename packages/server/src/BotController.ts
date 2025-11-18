import { PlayerInput, GameItem } from 'shared';
import { PlayerEntity } from './Player.js';

type BotState = 'search' | 'hunt' | 'panic';

interface BotSense {
  items: GameItem[];
  players: PlayerEntity[];
  worldWidth: number;
  worldHeight: number;
}

/**
 * BotController drives a PlayerEntity using a tiny state machine:
 * SEARCH → HUNT → PANIC. All movement is server-authoritative.
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

    if (panicDetected) {
      this.state = 'panic';
      this.panicTimer = Math.max(this.panicTimer, 0.5); // stay in panic briefly
    } else if (this.panicTimer <= 0) {
      if (nearestEnemy && nearestEnemy.dist < 300) this.state = 'hunt';
      else this.state = 'search';
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
      case 'hunt':
        input = this.buildHuntInput(pos, nearestEnemy, sense);
        break;
      case 'search':
      default:
        input = this.buildSearchInput(pos, nearestDNA, sense);
        break;
    }

    // Aim smoothing: ease toward desired direction so bots don't snap 180° in a frame
    const desiredAngle = Math.atan2(input.target.y - pos.y, input.target.x - pos.x);
    let diff = desiredAngle - this.aimAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const MAX_INPUT_TURN_RAD_PER_S = Math.PI * 1.8; // ~103°/s input steering for bots
    const maxTurn = MAX_INPUT_TURN_RAD_PER_S * deltaTime;
    const clamped = Math.max(-maxTurn, Math.min(maxTurn, diff));
    this.aimAngle += clamped;

    const aimDistance = 900;
    const smoothedTarget = {
      x: pos.x + Math.cos(this.aimAngle) * aimDistance,
      y: pos.y + Math.sin(this.aimAngle) * aimDistance,
    };
    input.target = smoothedTarget;

    // Apply input to underlying player
    this.player.setInput(input);

    // Trigger lunge when hunting with enough energy
    if (input.boost && this.player.canLunge(50)) {
      this.player.tryActivateBoost();
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

  private buildSearchInput(pos: { x: number; y: number }, nearestDNA: { item: GameItem; dist: number } | null, sense: BotSense): PlayerInput {
    const target = nearestDNA
      ? { x: nearestDNA.item.x, y: nearestDNA.item.y }
      : { x: sense.worldWidth / 2, y: sense.worldHeight / 2 };

    return {
      target,
      accelerate: true,
      boost: false,
      drift: false,
    };
  }

  private buildHuntInput(pos: { x: number; y: number }, nearestEnemy: { player: PlayerEntity; dist: number } | null, sense: BotSense): PlayerInput {
    if (!nearestEnemy) {
      return this.buildSearchInput(pos, null, sense);
    }

    const targetPlayer = nearestEnemy.player;
    const dist = nearestEnemy.dist;
    const leadTime = Math.min(0.9, dist / 600); // simple distance-based lead
    const predicted = {
      x: targetPlayer.sperm.position.x + targetPlayer.sperm.velocity.x * leadTime,
      y: targetPlayer.sperm.position.y + targetPlayer.sperm.velocity.y * leadTime,
    };

    const canBoost = this.player.getBoostEnergy() > 50 && this.player.canLunge(50);

    return {
      target: predicted,
      accelerate: true,
      boost: canBoost,
      drift: false,
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

  private detectPanic(sense: BotSense, _dt: number): boolean {
    const self = this.player;
    const pos = self.sperm.position;
    const dirX = Math.cos(self.sperm.angle);
    const dirY = Math.sin(self.sperm.angle);
    const lookAhead = 100;
    const probeX = pos.x + dirX * lookAhead;
    const probeY = pos.y + dirY * lookAhead;

    // Wall proximity
    const margin = 40;
    if (
      probeX < margin ||
      probeY < margin ||
      probeX > sense.worldWidth - margin ||
      probeY > sense.worldHeight - margin
    ) {
      return true;
    }

    // Approximate trail hazard: any trail point from other players within radius of probe
    const dangerRadius = 30;
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
