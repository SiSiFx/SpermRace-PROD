/**
 * Main Game Entry Point
 * Integrates all systems and provides the game interface
 * PERFORMANCE: Optimized for mobile with reduced entity counts and effects
 */

import * as PIXI from 'pixi.js';
import { GameEngine, GameState } from './core/GameEngine';
import { EntityManager } from './core/EntityManager';
import { SystemManager } from './core/System';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { ZoneSystem, ZoneState } from './systems/ZoneSystem';
import { TrailSystem } from './systems/TrailSystem';
import { RenderSystem } from './systems/RenderSystem';
import { AbilitySystem } from './systems/AbilitySystem';
import { PowerupSystem } from './systems/PowerupSystem';
import { CollisionSystem } from './systems/CollisionSystem';
import { BotAISystem } from './systems/BotAISystem';
import { InputSystem, type PlayerInput } from './systems/InputSystem';
import { CameraSystem } from './systems/CameraSystem';
import { DeathEffectSystem } from './systems/DeathEffectSystem';
import { CombatFeedbackSystem } from './systems/CombatFeedbackSystem';
import { SoundSystem } from './systems/SoundSystem';
import { FloatingTextSystem } from './systems/FloatingTextSystem';
import { SlowMotionSystem } from './systems/SlowMotionSystem';
import type {
  Position,
  Velocity,
  Collision,
  Trail,
  Health,
  Abilities,
  Player,
  Boost,
  Renderable,
} from './components';
import { ComponentNames } from './components';
import { EntityType } from './components/Player';
import { getAbilityProgress } from './components/Abilities';
import {
  getDefaultZoom,
  BOT_AI_TUNING,
  COLLISION_CONFIG,
  MATCH_CONFIG,
  ARENA_CONFIG,
  SPAWN_CONFIG,
} from './config';
import type { Container } from 'pixi.js';
import { CollisionLayer, CollisionMask } from './components/Collision';
import { EntityFactory, type EntityFactoryConfig, type CreatePlayerOptions } from './factories';
import type { Position as PositionComponent } from './components/Position';
import { SpermClassType } from './components/SpermClass';

/**
 * Game configuration
 */
export interface GameConfig {
  /** Container element */
  container: HTMLElement;

  /** Is mobile device */
  isMobile?: boolean;

  /** World width (optional, defaults from config) */
  worldWidth?: number;

  /** World height (optional, defaults from config) */
  worldHeight?: number;

  /** Player name */
  playerName?: string;

  /** Player color */
  playerColor?: number;

  /** Bot count */
  botCount?: number;

  /** Enable ability system */
  enableAbilities?: boolean;

  /** Player class type (Balanced, Sprinter, Tank) */
  classType?: SpermClassType;
}

/**
 * Main game class
 * Integrates all ECS systems and provides the game interface
 */
export class Game {
  private readonly _config: Required<Pick<GameConfig, 'isMobile' | 'worldWidth' | 'worldHeight'>> & GameConfig;
  private readonly _engine: GameEngine;
  private readonly _entityManager: EntityManager;
  private readonly _systemManager: SystemManager;
  private readonly _entityFactory: EntityFactory;

  // PIXI
  private _app: PIXI.Application | null = null;
  private _worldContainer: PIXI.Container | null = null;
  private _uiContainer: PIXI.Container | null = null;

  // Systems
  private _input!: InputSystem;
  private _camera!: CameraSystem;
  private _physics!: PhysicsSystem;
  private _zone!: ZoneSystem;
  private _trails!: TrailSystem;
  private _render!: RenderSystem;
  private _abilities!: AbilitySystem;
  private _powerups!: PowerupSystem;
  private _collision!: any; // CollisionSystem
  private _botAI!: any; // BotAISystem
  private _deathEffects!: DeathEffectSystem;
  private _combatFeedback!: CombatFeedbackSystem;
  private _sound!: SoundSystem;
  private _floatingText!: FloatingTextSystem;
  private _slowMotion!: SlowMotionSystem;

  // Entity IDs
  private _playerId: string | null = null;
  private readonly _botIds: string[] = [];
  private _playerSpawn: { x: number; y: number } | null = null;

  // State
  private _initialized = false;
  private _running = false;

  // Cleanup handlers (prevents memory leaks)
  private _boundOnResize: (() => void) | null = null;
  private _resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: GameConfig) {
    this._config = {
      isMobile: config.isMobile ?? false,
      worldWidth: config.worldWidth ?? ARENA_CONFIG.DESKTOP_WIDTH,
      worldHeight: config.worldHeight ?? ARENA_CONFIG.DESKTOP_HEIGHT,
      ...config,
    };

    // Create engine
    this._engine = new GameEngine({
      worldWidth: this._config.worldWidth,
      worldHeight: this._config.worldHeight,
      autoStart: false,
    });

    this._entityManager = this._engine.getEntityManager();
    this._systemManager = this._engine.getSystemManager();

    // Set engine reference on system manager so systems can access it
    this._systemManager.setEngine(this._engine);

    // Create entity factory
    this._entityFactory = new EntityFactory({
      entityManager: this._entityManager,
      worldWidth: this._config.worldWidth,
      worldHeight: this._config.worldHeight,
      enableAbilities: this._config.enableAbilities ?? false,
    } as EntityFactoryConfig);
  }

  /**
   * Initialize the game
   */
  async init(): Promise<void> {
    if (this._initialized) return;

    // Initialize PIXI
    await this._initPixi();

    // Create systems
    this._createSystems();

    // Generate spread spawn points for all entities at once
    const totalEntities = 1 + (this._config.botCount ?? 5);
    const spawnPoints = this._generateSpawnPoints(totalEntities);

    // Create player
    this._createPlayer(spawnPoints[0]);

    // Create bots
    for (let i = 0; i < (this._config.botCount ?? 5); i++) {
      this._createBot(i, spawnPoints[i + 1]);
    }

    // Start zone
    this._zone.start();

    // Start engine
    this._engine.start();
    this._running = true;

    this._initialized = true;
  }

  /**
   * Get the true visual viewport dimensions.
   * iOS Safari: visualViewport gives the actual visible area (excludes URL bar);
   * window.innerWidth/Height is a reliable fallback for all other browsers.
   */
  private _getViewportSize(): { width: number; height: number } {
    const vvp = window.visualViewport;
    return {
      width: Math.round(vvp ? vvp.width : window.innerWidth),
      height: Math.round(vvp ? vvp.height : window.innerHeight),
    };
  }

  /**
   * Initialize PIXI
   * PERFORMANCE: Lower resolution on mobile, no antialias on low-end devices
   */
  private async _initPixi(): Promise<void> {
    const container = this._config.container;

    // Use visualViewport for accurate iOS Safari sizing (URL bar appears/hides).
    // Falls back to window.innerWidth/Height which also match the visual viewport
    // on modern browsers.
    const { width, height } = this._getViewportSize();

    // PERFORMANCE: Reduce resolution on mobile for better FPS
    const isMobile = this._config.isMobile || window.innerWidth <= 768;
    const maxResolution = isMobile ? 1.5 : 2;
    const resolution = Math.min(window.devicePixelRatio || 1, maxResolution);

    this._app = new PIXI.Application();
    // Dev-only: keep draw buffer for deterministic canvas captures in the
    // local Playwright harness (avoids intermittent black frames in screenshots).
    const preserveDrawingBuffer = !!(import.meta as any).env?.DEV;
    await this._app.init({
      width,
      height,
      backgroundColor: 0x1a1f2e,
      // PERFORMANCE: Disable antialias on mobile for better performance
      antialias: !isMobile,
      resolution,
      autoDensity: true,
      // PERFORMANCE: Disable power preference on mobile to save battery
      powerPreference: isMobile ? 'low-power' : 'high-performance',
      preserveDrawingBuffer,
    });

    const canvas = this._app.canvas as HTMLCanvasElement;
    container.appendChild(canvas);
    canvas.style.outline = 'none';
    // Explicit pixel dimensions so the canvas never gets CSS-stretched when
    // the visualViewport changes between init and the next resize event.
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.display = 'block';
    canvas.tabIndex = 0;

    // Create containers
    this._worldContainer = new PIXI.Container();
    this._uiContainer = new PIXI.Container();

    this._app.stage.addChild(this._worldContainer);
    this._app.stage.addChild(this._uiContainer);

    // Handle resize — listen to both window resize AND visualViewport resize so
    // that iOS Safari URL-bar show/hide is caught reliably.
    this._boundOnResize = () => this._onResize();
    window.addEventListener('resize', this._boundOnResize);
    window.visualViewport?.addEventListener('resize', this._boundOnResize);
    window.visualViewport?.addEventListener('scroll', this._boundOnResize);

    // Force a resize after a short delay in case the viewport settles slightly
    // after the PIXI init (common on iOS Safari during page load).
    this._resizeTimeout = setTimeout(() => {
      if (this._app) this._onResize();
    }, 150);

    // Setup WebGL context loss handling
    this._setupContextLossHandlers();
  }

  /**
   * Create game systems
   */
  private _createSystems(): void {
    const spatialGrid = this._engine.getSpatialGrid();

    // Input system (highest priority)
    this._input = new InputSystem();
    this._systemManager.addSystem(this._input, 'input');

    // Camera system (runs before physics)
    this._camera = new CameraSystem({
      initialZoom: getDefaultZoom(this._config.isMobile),
      smoothFactor: 0.1,
    });
    this._systemManager.addSystem(this._camera, 'camera');

    // Physics system
    this._physics = new PhysicsSystem({
      worldWidth: this._config.worldWidth,
      worldHeight: this._config.worldHeight,
    });
    this._systemManager.addSystem(this._physics, 'physics');

    // Zone system
    this._zone = new ZoneSystem({
      centerX: this._config.worldWidth / 2,
      centerY: this._config.worldHeight / 2,
      // Game-first pacing: players should engage before zone pressure starts.
      startDelayMs: MATCH_CONFIG.ZONE_START_DELAY_MS,
      warningDurationMs: MATCH_CONFIG.ZONE_WARNING_DURATION_MS,
      shrinkDurationMs: MATCH_CONFIG.ZONE_SHRINK_DURATION_MS,
      minSize: MATCH_CONFIG.ZONE_MIN_SIZE,
      shrinkSpeed: MATCH_CONFIG.ZONE_SHRINK_RATE,
    });
    this._systemManager.addSystem(this._zone, 'zone');

    // Trail system
    this._trails = new TrailSystem({
      spatialGrid,
      enabled: true,
    });
    this._systemManager.addSystem(this._trails, 'trails');

    // Powerup system
    this._powerups = new PowerupSystem(spatialGrid);
    this._systemManager.addSystem(this._powerups, 'powerups');

    // Ability system
    this._abilities = new AbilitySystem();
    this._systemManager.addSystem(this._abilities, 'abilities');

    // Collision system
    this._collision = new CollisionSystem(spatialGrid);
    this._systemManager.addSystem(this._collision, 'collision');

    // Bot AI system
    this._botAI = new BotAISystem(spatialGrid, {
      reactionDelay: BOT_AI_TUNING.REACTION_DELAY_MS,
      accuracy: BOT_AI_TUNING.ACCURACY,
      aggression: BOT_AI_TUNING.AGGRESSION,
      abilityUsageChance: BOT_AI_TUNING.ABILITY_USAGE_CHANCE,
      predictionDistance: BOT_AI_TUNING.PREDICTION_DISTANCE,
    });
    this._systemManager.addSystem(this._botAI, 'botAI');

    // Sound system (must be initialized before systems that use it)
    this._sound = new SoundSystem({ masterVolume: 0.5 });
    // Initialize audio context (will be resumed on interaction)
    this._sound.init();
    this._systemManager.addSystem(this._sound, 'sound');

    // Floating text system
    this._floatingText = new FloatingTextSystem();
    this._systemManager.addSystem(this._floatingText, 'floatingText');

    // Slow motion system (for dramatic kills)
    this._slowMotion = new SlowMotionSystem();
    this._systemManager.addSystem(this._slowMotion, 'slowMotion');

    // Death effect system (must be after AI, before render)
    this._deathEffects = new DeathEffectSystem(
      this._camera,
      null, // RenderSystem will be set after creation
      this._collision,
      this._sound, // AudioManager
      this._floatingText
    );
    this._deathEffects.setSlowMotionSystem(this._slowMotion);
    this._systemManager.addSystem(this._deathEffects, 'deathEffects');

    // Combat feedback system (juice: screenshake, sounds, kill streaks)
    this._combatFeedback = new CombatFeedbackSystem({
      enableSound: true,
      enableScreenshake: true,
      enableKillStreaks: true,
      killShakeIntensity: 5,
      deathShakeIntensity: 8,
    });
    this._systemManager.addSystem(this._combatFeedback, 'combatFeedback');
    this._combatFeedback.setSlowMotionSystem(this._slowMotion);

    // Render system (must be last)
    if (this._app && this._worldContainer && this._uiContainer) {
      this._render = new RenderSystem({
        app: this._app,
        worldContainer: this._worldContainer,
        uiContainer: this._config.container, // DOM container for nameplates
        cameraSystem: this._camera,
      });
      this._systemManager.addSystem(this._render, 'render');

      // Pass render system to death effects (for particle effects)
      this._deathEffects._renderer = this._render;

      // Set container for floating text
      this._floatingText.setContainer(this._worldContainer);
    }
  }

  /**
   * Generate spawn points scattered independently across 60% of the arena.
   * No entity is the center of the universe — everyone drops at a random position
   * with a minimum separation gap so they don't instantly collide.
   */
  private _generateSpawnPoints(count: number): Array<{ x: number; y: number }> {
    const { worldWidth, worldHeight } = this._config;
    const pad = SPAWN_CONFIG.EDGE_PADDING;
    const minSep = 600; // minimum px between any two spawns
    const usableW = worldWidth * 0.6;
    const usableH = worldHeight * 0.6;
    const offsetX = (worldWidth - usableW) / 2;
    const offsetY = (worldHeight - usableH) / 2;

    const points: Array<{ x: number; y: number }> = [];
    const maxAttempts = 80;

    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const x = Math.max(pad, Math.min(worldWidth - pad,
          offsetX + Math.random() * usableW));
        const y = Math.max(pad, Math.min(worldHeight - pad,
          offsetY + Math.random() * usableH));

        // Reject if too close to any existing spawn
        let tooClose = false;
        for (const p of points) {
          const dx = p.x - x;
          const dy = p.y - y;
          if (dx * dx + dy * dy < minSep * minSep) { tooClose = true; break; }
        }
        if (!tooClose) { points.push({ x, y }); placed = true; break; }
      }
      // Fallback: place anywhere valid if separation can't be satisfied
      if (!placed) {
        points.push({
          x: Math.max(pad, Math.min(worldWidth - pad, offsetX + Math.random() * usableW)),
          y: Math.max(pad, Math.min(worldHeight - pad, offsetY + Math.random() * usableH)),
        });
      }
    }

    return points;
  }

  /**
   * Create player entity
   */
  private _createPlayer(spawnPos: { x: number; y: number }): void {
    const playerOptions: CreatePlayerOptions = {
      name: this._config.playerName ?? 'Player',
      color: this._config.playerColor ?? 0x22d3ee,
      isLocal: true,
      x: spawnPos.x,
      y: spawnPos.y,
      classType: this._config.classType ?? SpermClassType.BALANCED,
    };

    const playerId = this._entityFactory.createPlayer(playerOptions);
    this._playerId = playerId;

    const player = this._entityManager.getEntity(playerId);
    if (player) {
      const position = player.getComponent<PositionComponent>(ComponentNames.POSITION);
      const collision = player.getComponent<Collision>(ComponentNames.COLLISION);
      if (position) {
        this._playerSpawn = { x: position.x, y: position.y };
        this._engine.getSpatialGrid().addEntity(
          playerId,
          position.x,
          position.y,
          collision?.radius ?? COLLISION_CONFIG.CAR_RADIUS
        );
        this._camera.setPosition(position.x, position.y);
        this._camera.setTarget(playerId);
      }
    }
  }

  /**
   * Create bot entity
   */
  private _createBot(index: number, spawnPos: { x: number; y: number }): void {
    const botId = this._entityFactory.createBot({ index, x: spawnPos.x, y: spawnPos.y });
    this._botIds.push(botId);

    const bot = this._entityManager.getEntity(botId);
    if (bot) {
      const position = bot.getComponent<PositionComponent>(ComponentNames.POSITION);
      const collision = bot.getComponent<Collision>(ComponentNames.COLLISION);
      if (position) {
        this._engine.getSpatialGrid().addEntity(
          botId,
          position.x,
          position.y,
          collision?.radius ?? COLLISION_CONFIG.CAR_RADIUS
        );
      }
    }
  }

  /**
   * Handle window resize
   */
  private _onResize(): void {
    if (!this._app) return;

    const { width, height } = this._getViewportSize();
    const canvas = this._app.canvas as HTMLCanvasElement;

    // Keep canvas CSS pixel-exact to avoid CSS stretching on iOS
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    this._app.renderer.resize(width, height);
    this._engine.onResize(width, height);
  }

  /**
   * Set player input (called from InputHandler)
   */
  setInput(input: PlayerInput): void {
    this._input.setInput(input);
  }

  /**
   * Activate an ability
   */
  activateAbility(abilityType: string): boolean {
    if (!this._playerId) return false;
    return this._abilities.activateAbility(this._playerId, abilityType as any);
  }

  /**
   * Get ability progress for UI display
   * Returns cooldown progress (0-1, where 1 = ready) and active progress (0-1)
   */
  getAbilityProgress(abilityType: string): { cooldown: number; active: number } {
    if (!this._playerId) return { cooldown: 0, active: 0 };

    const player = this._entityManager.getEntity(this._playerId);
    if (!player) return { cooldown: 0, active: 0 };

    const abilities = player.getComponent<any>('Abilities');
    if (!abilities) return { cooldown: 0, active: 0 };

    return getAbilityProgress(abilities, abilityType as any);
  }

  /**
   * Get boost energy for UI display
   */
  getBoostEnergy(): { current: number; max: number } {
    if (!this._playerId) return { current: 0, max: 100 };

    const player = this._entityManager.getEntity(this._playerId);
    if (!player) return { current: 0, max: 100 };

    const boost = player.getComponent<any>('Boost');
    if (!boost) return { current: 0, max: 100 };

    return { current: boost.energy, max: boost.maxEnergy };
  }

  /**
   * Get player health state
   */
  getPlayerHealth(): { isAlive: boolean; state: string } | null {
    if (!this._playerId) return null;

    const player = this._entityManager.getEntity(this._playerId);
    if (!player) return null;

    const health = player.getComponent<any>('Health');
    if (!health) return null;

    return { isAlive: health.isAlive, state: health.state };
  }

  /**
   * Get game engine
   */
  getEngine(): GameEngine {
    return this._engine;
  }

  /**
   * Advance simulation by explicit milliseconds.
   * Useful for deterministic testing hooks.
   */
  advanceTime(ms: number): void {
    this._engine.advanceTime(ms);
  }

  /**
   * Render current game state to concise JSON for automation/debugging.
   */
  getTextSnapshot(maxOpponents: number = 12): string {
    try {
      const entities = this._entityManager.getActiveEntities();
      const zoneCenter = this._zone?.getCenter() ?? { x: this._config.worldWidth / 2, y: this._config.worldHeight / 2 };
      const zoneRadius = this._zone?.getCurrentRadius() ?? Math.max(this._config.worldWidth, this._config.worldHeight) / 2;
      const zoneState = this._zone?.getState?.() ?? 'idle';

      let local: {
        id: string;
        name: string;
        x: number;
        y: number;
        angle: number;
        speed: number;
        alive: boolean;
        kills: number;
      } | null = null;

      let aliveCount = 0;
      const opponents: Array<{
        id: string;
        name: string;
        type: string;
        x: number;
        y: number;
        alive: boolean;
        kills: number;
        distance: number;
      }> = [];

      for (const entity of entities) {
        const player = entity.getComponent<Player>(ComponentNames.PLAYER);
        const pos = entity.getComponent<Position>(ComponentNames.POSITION);
        const vel = entity.getComponent<Velocity>(ComponentNames.VELOCITY);
        const health = entity.getComponent<Health>(ComponentNames.HEALTH);
        if (!player || !pos || !vel || !health) continue;

        if (health.isAlive) aliveCount += 1;

        const isLocal = entity.id === this._playerId || player.isLocal;
        if (isLocal) {
          local = {
            id: entity.id,
            name: player.name,
            x: pos.x,
            y: pos.y,
            angle: vel.angle,
            speed: vel.speed,
            alive: health.isAlive,
            kills: health.kills,
          };
          continue;
        }

        const dist = local ? Math.hypot(pos.x - local.x, pos.y - local.y) : 0;
        opponents.push({
          id: entity.id,
          name: player.name,
          type: player.type,
          x: pos.x,
          y: pos.y,
          alive: health.isAlive,
          kills: health.kills,
          distance: Math.round(dist),
        });
      }

      if (local) {
        for (const opp of opponents) {
          opp.distance = Math.round(Math.hypot(opp.x - local.x, opp.y - local.y));
        }
        opponents.sort((a, b) => a.distance - b.distance);
      }

      const boostEnergy = this.getBoostEnergy();
      const payload = {
        mode: 'ecs_pixi',
        coordinateSystem: 'origin_top_left_x_right_y_down',
        world: { width: this._config.worldWidth, height: this._config.worldHeight },
        camera: this._camera
          ? {
              x: Number(this._camera.getCameraConfig().x.toFixed(2)),
              y: Number(this._camera.getCameraConfig().y.toFixed(2)),
              zoom: Number(this._camera.getCameraConfig().zoom.toFixed(3)),
              targetZoom: Number(this._camera.getCameraConfig().targetZoom.toFixed(3)),
              shakeIntensity: Number(this._camera.getCameraConfig().shakeIntensity.toFixed(4)),
            }
          : null,
        render: this._render ? this._render.getDebugSnapshot() : null,
        match: {
          status: this._engine.getState(),
          elapsedSec: Number(this._engine.getTimeStats().totalTime.toFixed(2)),
          aliveCount,
        },
        zone: {
          state: zoneState,
          center: zoneCenter,
          radius: Math.round(zoneRadius),
          timeToNextPhaseMs: this._zone?.getTimeUntilNextPhase?.() ?? 0,
        },
        player: local
          ? {
              ...local,
              boost: {
                current: Number(boostEnergy.current.toFixed(2)),
                max: Number(boostEnergy.max.toFixed(2)),
              },
            }
          : null,
        opponents: opponents.slice(0, Math.max(0, maxOpponents)),
      };

      return JSON.stringify(payload);
    } catch (error) {
      return JSON.stringify({
        mode: 'ecs_pixi',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get render system for camera control
   */
  getRenderSystem(): RenderSystem | null {
    return this._render ?? null;
  }

  /**
   * Get player entity ID
   */
  getPlayerId(): string | null {
    return this._playerId;
  }

  /**
   * Check if game is initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Check if game is running
   */
  isGameRunning(): boolean {
    return this._running;
  }

  /**
   * Get combat feedback system
   */
  getCombatFeedbackSystem(): CombatFeedbackSystem | null {
    return this._combatFeedback ?? null;
  }

  /**
   * Get floating text system
   */
  getFloatingTextSystem(): FloatingTextSystem | null {
    return this._floatingText ?? null;
  }

  getZoneInfo(): { state: ZoneState; distanceFromPlayer: number; timeUntilNextPhaseMs: number; center: { x: number; y: number }; radius: number } | null {
    if (!this._zone || !this._playerId) return null;
    const playerEntity = this._entityManager.getEntity(this._playerId);
    const pos = playerEntity?.getComponent<PositionComponent>(ComponentNames.POSITION);
    if (!pos) return null;
    return {
      state: this._zone.getState(),
      distanceFromPlayer: this._zone.getDistanceFromZone(pos.x, pos.y),
      timeUntilNextPhaseMs: this._zone.getTimeUntilNextPhase(),
      center: this._zone.getCenter(),
      radius: this._zone.getCurrentRadius(),
    };
  }

  getSoundSystem(): SoundSystem | null {
    return this._sound ?? null;
  }

  /** Resume audio context — call this inside a user gesture */
  async resumeAudio(): Promise<void> {
    await this._sound?.resume();
  }

  /**
   * Destroy the game
   * PERFORMANCE: Properly cleans up all event listeners and timeouts
   */
  async destroy(): Promise<void> {
    this._running = false;

    // Clean up resize listeners (window + visualViewport)
    if (this._boundOnResize) {
      window.removeEventListener('resize', this._boundOnResize);
      window.visualViewport?.removeEventListener('resize', this._boundOnResize);
      window.visualViewport?.removeEventListener('scroll', this._boundOnResize);
      this._boundOnResize = null;
    }

    // Clean up resize timeout
    if (this._resizeTimeout !== null) {
      clearTimeout(this._resizeTimeout);
      this._resizeTimeout = null;
    }

    // Clean up WebGL context loss handlers
    this._removeContextLossHandlers();

    await this._engine.stop();

    if (this._app) {
      this._app.destroy(true, { children: true, texture: true });
      this._app = null;
    }

    this._worldContainer = null;
    this._uiContainer = null;
  }

  // WebGL context handling
  private _contextLostHandler: ((event: Event) => void) | null = null;
  private _contextRestoredHandler: ((event: Event) => void) | null = null;

  /**
   * Setup WebGL context loss/recovery handlers
   * IMPORTANT: Handles browser WebGL context loss events (e.g., on mobile tab switching)
   */
  private _setupContextLossHandlers(): void {
    if (!this._app) return;

    const canvas = this._app.canvas as HTMLCanvasElement;
    if (!canvas) return;

    // Store bound handlers for cleanup
    this._contextLostHandler = (event: Event) => {
      event.preventDefault();
      this._running = false;
      console.warn('[Game] WebGL context lost, pausing game...');
    };

    this._contextRestoredHandler = () => {
      console.warn('[Game] WebGL context restored, restarting...');
      // Context will be restored by PIXI automatically
      this._running = true;
    };

    canvas.addEventListener('webglcontextlost', this._contextLostHandler);
    canvas.addEventListener('webglcontextrestored', this._contextRestoredHandler);
  }

  /**
   * Remove WebGL context loss handlers
   */
  private _removeContextLossHandlers(): void {
    if (!this._app) return;

    const canvas = this._app.canvas as HTMLCanvasElement;
    if (!canvas) return;

    if (this._contextLostHandler) {
      canvas.removeEventListener('webglcontextlost', this._contextLostHandler);
      this._contextLostHandler = null;
    }

    if (this._contextRestoredHandler) {
      canvas.removeEventListener('webglcontextrestored', this._contextRestoredHandler);
      this._contextRestoredHandler = null;
    }
  }
}

/**
 * Create a new game instance
 */
export async function createGame(config: GameConfig): Promise<Game> {
  const game = new Game(config);
  await game.init();
  return game;
}
