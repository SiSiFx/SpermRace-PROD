import {
  BOOST_MULTIPLIER,
  PLAYER_BASE_SPEED,
  TRAIL_MAX_POINTS,
  ZONE_DAMAGE_DELAY,
  ZONE_DELAY_SECONDS,
  ZONE_SHRINK_PER_SEC,
} from './constants';
import { angleTo, clamp, distSq, len, lerpAngle, normalize } from './math';
import { drawActorBody, drawTrail, drawZone } from './render';
import type { Actor, Runtime, Vec2 } from './types';
import { getAliveActors, killActor } from './world';

export type RuntimeInput = {
  move: Vec2;
  boost: boolean;
};

function updatePlayerMotion(actor: Actor, input: Vec2, boostPressed: boolean, dt: number): void {
  const dir = normalize(input);
  const wantsMove = Math.abs(dir.x) > 0.001 || Math.abs(dir.y) > 0.001;

  actor.boosting = wantsMove && boostPressed && actor.boostEnergy > 5;
  if (actor.boosting) actor.boostEnergy = clamp(actor.boostEnergy - dt * 34, 0, 100);
  else actor.boostEnergy = clamp(actor.boostEnergy + dt * 18, 0, 100);

  const topSpeed = PLAYER_BASE_SPEED * (actor.boosting ? BOOST_MULTIPLIER : 1);

  const targetVx = wantsMove ? dir.x * topSpeed : 0;
  const targetVy = wantsMove ? dir.y * topSpeed : 0;

  const accel = wantsMove ? 9.5 : 5.4;
  const t = clamp(dt * accel, 0, 1);
  actor.vx += (targetVx - actor.vx) * t;
  actor.vy += (targetVy - actor.vy) * t;
}

function updateBotMotion(runtime: Runtime, actor: Actor, dt: number): void {
  actor.aiDecisionTimer -= dt;
  if (actor.aiDecisionTimer <= 0) {
    const player = runtime.player;
    const towardPlayer = angleTo({ x: actor.x, y: actor.y }, { x: player.x, y: player.y });
    const jitter = (Math.random() - 0.5) * 0.9;
    actor.aiTargetAngle = towardPlayer + jitter;
    actor.aiDecisionTimer = 0.18 + Math.random() * 0.42;
  }

  const fromCenter = { x: actor.x - runtime.zoneCenter.x, y: actor.y - runtime.zoneCenter.y };
  const distToCenter = len(fromCenter.x, fromCenter.y);
  if (distToCenter > runtime.zoneRadius * 0.86) {
    const centerAngle = Math.atan2(-fromCenter.y, -fromCenter.x);
    actor.aiTargetAngle = centerAngle;
  }

  const currentAngle = Math.atan2(actor.vy || Math.sin(actor.aiTargetAngle), actor.vx || Math.cos(actor.aiTargetAngle));
  const steer = lerpAngle(currentAngle, actor.aiTargetAngle, clamp(dt * 2.2, 0, 1));

  actor.boosting = actor.boostEnergy > 18 && Math.random() < 0.02;
  if (actor.boosting) actor.boostEnergy = clamp(actor.boostEnergy - dt * 25, 0, 100);
  else actor.boostEnergy = clamp(actor.boostEnergy + dt * 12, 0, 100);

  const speed = (PLAYER_BASE_SPEED - 18) * (actor.boosting ? 1.3 : 1);
  const targetVx = Math.cos(steer) * speed;
  const targetVy = Math.sin(steer) * speed;
  const t = clamp(dt * 4.4, 0, 1);

  actor.vx += (targetVx - actor.vx) * t;
  actor.vy += (targetVy - actor.vy) * t;
}

function updateActorPosition(runtime: Runtime, actor: Actor, dt: number): void {
  const prevX = actor.x;
  const prevY = actor.y;

  actor.x += actor.vx * dt;
  actor.y += actor.vy * dt;

  const r = actor.radius;
  if (actor.x < r) {
    actor.x = r;
    actor.vx *= -0.2;
  } else if (actor.x > runtime.worldWidth - r) {
    actor.x = runtime.worldWidth - r;
    actor.vx *= -0.2;
  }

  if (actor.y < r) {
    actor.y = r;
    actor.vy *= -0.2;
  } else if (actor.y > runtime.worldHeight - r) {
    actor.y = runtime.worldHeight - r;
    actor.vy *= -0.2;
  }

  if (actor.isPlayer && actor.alive) {
    runtime.playerDistance += len(actor.x - prevX, actor.y - prevY);
  }
}

function updateTrail(actor: Actor, dt: number): void {
  if (!actor.alive) return;

  actor.trailAccumulator += dt;
  if (actor.trailAccumulator >= 0.032) {
    actor.trailAccumulator = 0;
    const last = actor.trail[actor.trail.length - 1];
    const dx = actor.x - last.x;
    const dy = actor.y - last.y;
    if (dx * dx + dy * dy >= 42) {
      actor.trail.push({ x: actor.x, y: actor.y });
      if (actor.trail.length > TRAIL_MAX_POINTS) actor.trail.shift();
      actor.trailDirty = true;
    }
  }
}

function runCollisions(runtime: Runtime, dt: number): void {
  const alive = getAliveActors(runtime);

  for (let i = 0; i < alive.length; i += 1) {
    const a = alive[i];
    const aPos = { x: a.x, y: a.y };

    const centerDist = len(a.x - runtime.zoneCenter.x, a.y - runtime.zoneCenter.y);
    if (centerDist > runtime.zoneRadius - a.radius) {
      a.zoneExposure += dt;
      if (a.zoneExposure > ZONE_DAMAGE_DELAY) {
        killActor(a, null);
        continue;
      }
    } else {
      a.zoneExposure = 0;
    }

    for (let j = 0; j < alive.length; j += 1) {
      const b = alive[j];
      if (a === b) continue;
      if (b.trail.length < 16) continue;

      const hitRadiusSq = (a.radius * 0.8) * (a.radius * 0.8);
      for (let k = 0; k < b.trail.length - 10; k += 2) {
        if (distSq(aPos, b.trail[k]) <= hitRadiusSq) {
          killActor(a, b);
          break;
        }
      }
      if (!a.alive) break;
    }
  }

  const stillAlive = getAliveActors(runtime);

  for (let i = 0; i < stillAlive.length; i += 1) {
    for (let j = i + 1; j < stillAlive.length; j += 1) {
      const a = stillAlive[i];
      const b = stillAlive[j];
      const d2 = distSq({ x: a.x, y: a.y }, { x: b.x, y: b.y });
      const minDist = (a.radius + b.radius) * 0.92;
      if (d2 > minDist * minDist) continue;

      if (a.boosting && !b.boosting) {
        killActor(b, a);
      } else if (b.boosting && !a.boosting) {
        killActor(a, b);
      } else {
        const n = normalize({ x: b.x - a.x, y: b.y - a.y });
        a.vx -= n.x * 120;
        a.vy -= n.y * 120;
        b.vx += n.x * 120;
        b.vy += n.y * 120;
      }
    }
  }

  runtime.aliveCount = getAliveActors(runtime).length;
}

function updateCamera(runtime: Runtime): void {
  const screenW = runtime.app.screen.width;
  const screenH = runtime.app.screen.height;
  const follow = runtime.player;

  runtime.camera.x += (follow.x - runtime.camera.x) * 0.12;
  runtime.camera.y += (follow.y - runtime.camera.y) * 0.12;

  const targetX = screenW * 0.5 - runtime.camera.x;
  const targetY = screenH * 0.5 - runtime.camera.y;

  const minX = screenW - runtime.worldWidth;
  const minY = screenH - runtime.worldHeight;

  runtime.world.x = clamp(targetX, minX, 0);
  runtime.world.y = clamp(targetY, minY, 0);
}

function renderRuntime(runtime: Runtime): void {
  for (let i = 0; i < runtime.actors.length; i += 1) {
    drawActorBody(runtime.actors[i]);
    drawTrail(runtime.actors[i]);
  }

  if (Math.abs(runtime.zoneRadius - runtime.lastZoneDrawRadius) > 0.5) {
    drawZone(runtime.zoneG, runtime.zoneCenter, runtime.zoneRadius);
    runtime.lastZoneDrawRadius = runtime.zoneRadius;
  }
}

export function stepSimulation(runtime: Runtime, input: RuntimeInput, dt: number): void {
  runtime.elapsed += dt;

  if (runtime.elapsed > ZONE_DELAY_SECONDS) {
    runtime.zoneRadius = Math.max(runtime.minZoneRadius, runtime.zoneRadius - ZONE_SHRINK_PER_SEC * dt);
  }

  if (runtime.player.alive) {
    updatePlayerMotion(runtime.player, input.move, input.boost, dt);
  }

  for (let i = 0; i < runtime.actors.length; i += 1) {
    const actor = runtime.actors[i];
    if (!actor.alive) continue;

    if (!actor.isPlayer) updateBotMotion(runtime, actor, dt);

    updateActorPosition(runtime, actor, dt);
    updateTrail(actor, dt);
  }

  runCollisions(runtime, dt);
  renderRuntime(runtime);
  updateCamera(runtime);
}
