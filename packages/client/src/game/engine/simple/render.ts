import { Graphics } from 'pixi.js';
import type { Actor, Vec2 } from './types';

export function drawArena(arenaG: Graphics, width: number, height: number): void {
  arenaG.clear();
  arenaG.rect(0, 0, width, height).fill({ color: 0x070b14 });

  const cell = 200;
  for (let x = 0; x <= width; x += cell) {
    arenaG.moveTo(x, 0);
    arenaG.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += cell) {
    arenaG.moveTo(0, y);
    arenaG.lineTo(width, y);
  }
  arenaG.stroke({ color: 0x10192b, width: 1, alpha: 0.65 });
  arenaG.rect(0, 0, width, height).stroke({ color: 0x22d3ee, width: 3, alpha: 0.4 });
}

export function drawZone(zoneG: Graphics, center: Vec2, radius: number): void {
  zoneG.clear();
  zoneG.circle(center.x, center.y, radius).stroke({ color: 0xffcc33, width: 4, alpha: 0.9 });
}

export function drawActorBody(actor: Actor): void {
  const visualChanged = actor.visualAlive !== actor.alive || actor.visualBoosting !== actor.boosting;
  if (visualChanged) {
    actor.body.clear();
    actor.body.circle(0, 0, actor.radius).fill({ color: actor.color, alpha: actor.alive ? 0.95 : 0.25 });
    actor.body.circle(0, 0, actor.radius).stroke({ color: 0xf8fafc, width: 2, alpha: actor.alive ? 0.9 : 0.25 });

    if (actor.boosting && actor.alive) {
      actor.body.circle(0, 0, actor.radius + 6).stroke({ color: 0xffae00, width: 3, alpha: 0.9 });
    }
    actor.visualAlive = actor.alive;
    actor.visualBoosting = actor.boosting;
  }

  actor.body.x = actor.x;
  actor.body.y = actor.y;

  if (Math.abs(actor.vx) > 0.01 || Math.abs(actor.vy) > 0.01) {
    actor.body.rotation = Math.atan2(actor.vy, actor.vx);
  }
}

export function drawTrail(actor: Actor): void {
  actor.trailG.clear();
  
  if (actor.trail.length < 2) {
    actor.trailDirty = false;
    return;
  }

  // Draw trail as filled circles at each point (no caps, no lines)
  // This avoids all stroke cap issues
  const trailRadius = Math.max(3, actor.radius * 0.5);
  const alpha = actor.alive ? 0.7 : 0.25;
  
  for (let i = 0; i < actor.trail.length; i++) {
    const p = actor.trail[i];
    // Fade out toward tail end
    const t = i / actor.trail.length; // 0 at head, 1 at tail
    const pointAlpha = alpha * (1 - t * 0.5); // Fade to 50% at tail
    
    actor.trailG.circle(p.x, p.y, trailRadius).fill({ 
      color: actor.color, 
      alpha: pointAlpha 
    });
  }
  
  actor.trailDirty = false;
}

export function pickColor(i: number): number {
  const palette = [
    0xf43f5e,
    0xf97316,
    0xeab308,
    0x22c55e,
    0x14b8a6,
    0x3b82f6,
    0x8b5cf6,
    0xec4899,
  ];
  return palette[i % palette.length];
}
