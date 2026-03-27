import { Container, Graphics, type Application } from 'pixi.js';
import type { Actor, Runtime } from './types';
import { drawActorBody, drawArena, drawZone, pickColor } from './render';
import { TRAIL_MIN_POINTS } from './constants';

export function createActor(
  world: Container,
  id: string,
  name: string,
  color: number,
  isPlayer: boolean,
  x: number,
  y: number,
): Actor {
  const trailG = new Graphics();
  const body = new Graphics();
  world.addChild(trailG);
  world.addChild(body);

  const actor: Actor = {
    id,
    name,
    isPlayer,
    color,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: isPlayer ? 16 : 14,
    alive: true,
    kills: 0,
    boostEnergy: 100,
    boosting: false,
    trail: [{ x, y }],
    trailAccumulator: 0,
    trailMaxLength: TRAIL_MIN_POINTS,
    zoneExposure: 0,
    aiDecisionTimer: 0,
    aiTargetAngle: Math.random() * Math.PI * 2,
    lastHitBy: null,
    trailDirty: true,
    visualAlive: false,
    visualBoosting: true,
    body,
    trailG,
  };

  drawActorBody(actor);
  return actor;
}

export function buildRuntime(
  app: Application,
  worldWidth: number,
  worldHeight: number,
  playerName: string,
  playerColor: number,
  botCount: number,
): Runtime {
  const world = new Container();
  app.stage.addChild(world);

  const arenaG = new Graphics();
  world.addChild(arenaG);
  drawArena(arenaG, worldWidth, worldHeight);

  const zoneG = new Graphics();
  world.addChild(zoneG);

  const zoneCenter = { x: worldWidth * 0.5, y: worldHeight * 0.5 };
  const initialZoneRadius = Math.min(worldWidth, worldHeight) * 0.46;

  const player = createActor(world, 'player', playerName, playerColor, true, zoneCenter.x, zoneCenter.y);
  const actors: Actor[] = [player];

  for (let i = 0; i < botCount; i += 1) {
    const a = (i / Math.max(1, botCount)) * Math.PI * 2;
    const r = 320 + (i % 3) * 110;
    const x = zoneCenter.x + Math.cos(a) * r;
    const y = zoneCenter.y + Math.sin(a) * r;
    actors.push(createActor(world, `bot-${i + 1}`, `BOT ${i + 1}`, pickColor(i), false, x, y));
  }

  drawZone(zoneG, zoneCenter, initialZoneRadius);

  return {
    app,
    world,
    actors,
    player,
    arenaG,
    zoneG,
    worldWidth,
    worldHeight,
    zoneCenter,
    zoneRadius: initialZoneRadius,
    minZoneRadius: Math.min(worldWidth, worldHeight) * 0.18,
    elapsed: 0,
    camera: { x: player.x, y: player.y },
    finished: false,
    playerDistance: 0,
    aliveCount: actors.length,
    lastUiPush: 0,
    lastZoneDrawRadius: initialZoneRadius,
  };
}

export function getAliveActors(runtime: Runtime): Actor[] {
  return runtime.actors.filter((a) => a.alive);
}

export function killActor(victim: Actor, killer: Actor | null): void {
  if (!victim.alive) return;
  victim.alive = false;
  victim.boosting = false;
  victim.vx *= 0.2;
  victim.vy *= 0.2;
  victim.lastHitBy = killer?.name ?? null;
  victim.trailDirty = true;
  if (killer && killer !== victim) killer.kills += 1;
  drawActorBody(victim);
}
