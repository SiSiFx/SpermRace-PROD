import * as PIXI from 'pixi.js';
import { Car, ArenaBounds } from './types';
import { Physics } from './Physics';
import { InputHandler } from './InputHandler';
import { Camera } from './Camera';
import { Effects } from './Effects';
import { TrailSystem } from './TrailSystem';
import { Collision, CollisionResult } from './Collision';
import { GameWorld } from './GameWorld';
import { UISystem } from './UISystem';

export class SpermRaceGame {
  private app: PIXI.Application | null = null;
  private worldContainer!: PIXI.Container;
  private container: HTMLElement;

  // Game state
  private player: Car | null = null;
  private bots: Car[] = [];
  private arena: ArenaBounds = { width: 8000, height: 6000 };
  private gamePhase: 'waiting' | 'active' | 'finished' = 'waiting';

  // Systems
  private physics!: Physics;
  private input!: InputHandler;
  private camera!: Camera;
  private effects!: Effects;
  private trails!: TrailSystem;
  private collision!: Collision;
  private world!: GameWorld;
  private ui!: UISystem;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Create PIXI app
    this.app = new PIXI.Application();
    await this.app.init({
      width,
      height,
      backgroundColor: 0x1a1f2e,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true
    });

    const canvas = (this.app as any).canvas as HTMLCanvasElement;
    this.container.appendChild(canvas);
    canvas.style.outline = 'none';
    canvas.tabIndex = 0;
    canvas.focus();

    // Create world container
    this.worldContainer = new PIXI.Container();
    this.worldContainer.sortableChildren = true;
    this.app.stage.addChild(this.worldContainer);

    // Initialize systems
    this.physics = new Physics();
    this.input = new InputHandler();
    this.camera = new Camera();
    this.effects = new Effects(this.worldContainer);
    this.trails = new TrailSystem(this.worldContainer);
    this.collision = new Collision();
    this.world = new GameWorld(this.worldContainer, this.arena);
    this.ui = new UISystem(this.container);

    // Setup input
    this.input.setup(canvas);

    // Create player
    this.player = this.createCar(true);

    // Create bots
    for (let i = 0; i < 5; i++) {
      this.bots.push(this.createCar(false));
    }

    // Start game
    this.gamePhase = 'active';
    this.world.startZone();

    // Start game loop
    this.app.ticker.add(() => this.gameLoop());
  }

  private createCar(isPlayer: boolean): Car {
    const spawn = this.world.getSpawnPoint();
    const color = isPlayer ? 0x22d3ee : 0xff00ff;

    const sprite = new PIXI.Container();
    const head = new PIXI.Graphics();
    head.circle(0, 0, 12).fill({ color });
    sprite.addChild(head);

    // Add boost glow effect (hidden by default)
    const boostGlow = new PIXI.Graphics();
    boostGlow.circle(0, 0, 20).fill({ color: 0x22d3ee, alpha: 0 });
    boostGlow.visible = false;
    sprite.addChild(boostGlow);

    sprite.x = spawn.x;
    sprite.y = spawn.y;
    sprite.rotation = spawn.angle;
    this.worldContainer.addChild(sprite);

    return {
      id: Math.random().toString(36).substr(2, 9),
      x: spawn.x,
      y: spawn.y,
      angle: spawn.angle,
      targetAngle: spawn.angle,
      speed: 200,
      baseSpeed: 200,
      boostSpeed: 300,
      targetSpeed: 200,
      speedTransitionRate: 3,
      driftFactor: 0,
      maxDriftFactor: 1.5,
      vx: 0,
      vy: 0,
      color,
      type: isPlayer ? 'player' : 'bot',
      name: isPlayer ? 'You' : `Bot${Math.floor(Math.random() * 100)}`,
      kills: 0,
      destroyed: false,
      respawnTimer: 0,
      isBoosting: false,
      boostTimer: 0,
      boostCooldown: 0,
      boostEnergy: 100,
      maxBoostEnergy: 100,
      boostRegenRate: 15,
      boostConsumptionRate: 25,
      minBoostEnergy: 20,
      trailPoints: [],
      trailGraphics: null,
      lastTrailTime: 0,
      turnTimer: 1,
      boostAITimer: 2,
      currentTrailId: null,
      sprite,
      headGraphics: head,
      boostGlow: boostGlow,
      burstUntil: undefined,
      wasTurning: false
    };
  }

  private gameLoop(): void {
    if (!this.app || this.gamePhase !== 'active') return;

    const deltaTime = 1 / 60;
    const screenW = this.app.screen.width;
    const screenH = this.app.screen.height;

    // Get input
    if (this.player && !this.player.destroyed) {
      const input = this.input.getInput(
        this.player.x, this.player.y,
        this.camera.x, this.camera.y,
        this.camera.zoom, screenW, screenH
      );

      // Apply input to player
      this.player.targetAngle = Math.atan2(
        input.targetY - this.player.y,
        input.targetX - this.player.x
      );
      if (input.boost && this.player.boostEnergy >= this.player.minBoostEnergy) {
        this.player.isBoosting = true;
      }
    }

    // Update physics
    if (this.player) {
      this.physics.updateCar(this.player, deltaTime, this.world.boostPads);
    }
    for (const bot of this.bots) {
      this.physics.updateBot(bot, deltaTime, this.world.boostPads);
    }

    // Update trails
    const allCars = [this.player, ...this.bots].filter(c => c && !c.destroyed) as Car[];
    for (const car of allCars) {
      this.trails.addPoint(car);
    }
    this.trails.update();

    // Check collisions
    const trails = this.trails.getTrails();
    const collisions = this.collision.checkTrailCollisions(allCars, trails);
    for (const col of collisions) {
      this.handleCollision(col);
    }

    // Update zone
    this.world.updateZone(allCars);

    // Update boost pad visuals
    this.world.updateBoostPads();

    // Update effects
    this.effects.update(deltaTime);

    // Update boost glow effects for all cars
    for (const car of allCars) {
      if (car.boostGlow) {
        if (car.isBoosting) {
          car.boostGlow.visible = true;
          // Pulse the glow
          const pulse = 0.3 + Math.sin(Date.now() / 50) * 0.15;
          car.boostGlow.clear();
          car.boostGlow.circle(0, 0, 18 + Math.sin(Date.now() / 80) * 3).fill({ color: 0x22d3ee, alpha: pulse });
        } else {
          car.boostGlow.visible = false;
        }
      }

      // Create boost exhaust for boosting cars
      if (car.isBoosting) {
        this.effects.createBoostExhaust(
          car.x,
          car.y,
          car.angle,
          car.color
        );
      }
    }

    // Update camera
    this.camera.update(this.player, this.worldContainer, screenW, screenH);

    // Update UI
    const aliveCount = allCars.filter(c => !c.destroyed).length;
    this.ui.updateAliveCount(aliveCount);
    this.ui.updateRadar(this.player, this.bots, this.arena, this.world.zone);
    if (this.player) {
      this.ui.updateBoostBar(this.player.boostEnergy, this.player.maxBoostEnergy, this.player.isBoosting);
    }

    // Check win/lose
    if (aliveCount <= 1) {
      this.gamePhase = 'finished';
    }
  }

  private handleCollision(col: CollisionResult): void {
    col.victim.destroyed = true;
    col.victim.sprite.visible = false;

    this.effects.createExplosion(col.hitPoint.x, col.hitPoint.y, col.victim.color);
    this.camera.shake(0.5);
    this.effects.triggerHaptic('heavy');

    if (col.killer) {
      col.killer.kills++;
      this.ui.addKill(col.killer.name, col.victim.name);
    }
  }

  destroy(): void {
    this.input.destroy();
    this.effects.destroy();
    this.trails.clear();
    this.world.destroy();
    this.ui.destroy();
    this.app?.destroy(true);
  }

  // Public API for testing
  getPlayer(): Car | null {
    return this.player;
  }

  getBots(): Car[] {
    return this.bots;
  }

  getGamePhase(): 'waiting' | 'active' | 'finished' {
    return this.gamePhase;
  }

  getArena(): ArenaBounds {
    return this.arena;
  }
}
