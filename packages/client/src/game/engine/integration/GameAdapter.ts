/**
 * Game Adapter
 * Bridges the new ECS engine with the existing NewGameView API
 *
 * This adapter allows the new ECS engine to be used as a drop-in
 * replacement for the old SpermRaceGame class, maintaining backward
 * compatibility with existing UI and WebSocket code.
 */

import * as PIXI from 'pixi.js';
import { Game, createGame } from '../Game';
import { GameState } from '../core/GameEngine';
import { ZoneState } from '../systems/ZoneSystem';

/**
 * Adapter class that mimics the old SpermRaceGame interface
 * but uses the new ECS engine internally
 */
export class GameAdapter {
  private _game: Game | null = null;
  private _initialized = false;

  // Public properties (for compatibility with old code)
  public app: PIXI.Application | null = null;
  public arena: { width: number; height: number };
  public player: any = null; // Will be populated from ECS entity
  public serverPlayers: Map<string, any> = new Map();
  public bot: any = null;
  public extraBots: any[] = [];
  public pickups: any[] = [];
  public boostPads: any[] = [];
  public worldContainer!: PIXI.Container;
  public trailContainer!: PIXI.Container;
  public pickupsContainer!: PIXI.Container;
  public uiContainer!: HTMLDivElement;
  public gamePhase: 'waiting' | 'active' | 'finished' = 'waiting';
  public wsHud: any = null;
  public wsSendInput: ((target: { x: number; y: number }, accelerate: boolean, boost?: boolean) => void) | null = null;
  public keys: { [key: string]: boolean } = {};
  public mouse = { x: 0, y: 0 };
  public touch = { active: false, x: 0, y: 0 };
  public camera = {
    x: 0,
    y: 0,
    zoom: 1,
    shake: (intensity: number, isTournament: boolean) => {
      if (this._game) {
        const renderSystem = this._game.getEngine().getSystemManager().getSystem<any>('render');
        if (renderSystem) {
          renderSystem.addShake(intensity * 0.5);
        }
      }
    },
  };
  public radarPings: any[] = [];
  public alivePlayers: number = 0;
  public recentKills: Array<{ killer: string; victim: string; time: number }> = [];
  public kills: number = 0;
  public destroyed: boolean = false;
  public gameStartTime: number = Date.now();
  public zone = {
    centerX: 0,
    centerY: 0,
    startRadius: 0,
    endRadius: 140,
    startAtMs: 0,
    durationMs: 90000,
  };
  public debugCollisions: any[] = [];

  private _container: HTMLElement;
  private _onReplay?: () => void;
  private _onExit?: () => void;
  private _inputCallback: ((target: { x: number; y: number }, accelerate: boolean, boost: boolean) => void) | null = null;
  private _lastInputSent = 0;

  constructor(container: HTMLElement, onReplay?: () => void, onExit?: () => void) {
    this._container = container;
    this._onReplay = onReplay;
    this._onExit = onExit;

    // Initialize arena size
    const isPortraitMobile = typeof window !== 'undefined' && window.innerHeight > window.innerWidth && window.innerWidth < 768;
    this.arena = isPortraitMobile
      ? { width: 3500, height: 7700 }
      : { width: 8000, height: 6000 };
  }

  /**
   * Initialize the game
   */
  async init(): Promise<void> {
    if (this._initialized) return;

    // Check if online mode
    const isOnline = !!(this.wsHud?.active);

    // Create the game using new ECS engine
    this._game = await createGame({
      container: this._container,
      isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
      worldWidth: this.arena.width,
      worldHeight: this.arena.height,
      playerName: this.wsHud?.idToName?.[this.wsHud?.playerId ?? ''] || 'Player',
      playerColor: 0x22d3ee,
      botCount: isOnline ? 0 : 5, // No bots in online mode
      enableAbilities: true,
    });

    // Get PIXI app from render system
    const engine = this._game.getEngine();
    const renderSystem = engine.getSystemManager().getSystem<any>('render');
    if (renderSystem && renderSystem._config) {
      this.app = renderSystem._config.app;
      this.worldContainer = renderSystem._config.worldContainer;
    }

    // Create additional containers for compatibility
    this.trailContainer = new PIXI.Container();
    this.pickupsContainer = new PIXI.Container();
    this.worldContainer.addChild(this.trailContainer);
    this.worldContainer.addChild(this.pickupsContainer);

    // Create UI container
    this.uiContainer = document.createElement('div');
    this.uiContainer.className = 'game-ui';
    this.uiContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;
    this._container.appendChild(this.uiContainer);

    // Setup input callback
    this._inputCallback = this._createInputCallback();

    // Set up input handlers
    this._setupInputHandlers();

    // Sync player entity for compatibility
    const playerId = this._game.getPlayerId();
    if (playerId) {
      this.player = this._createCarCompat(playerId, true);
    }

    // Sync zone from ECS
    this._syncZone();

    // Start game loop
    this.gamePhase = 'active';

    this._initialized = true;
  }

  /**
   * Create input callback that sends to server if online
   */
  private _createInputCallback() {
    return (target: { x: number; y: number }, accelerate: boolean, boost: boolean) => {
      const now = Date.now();
      if (now - this._lastInputSent < 16) return; // Max 60fps input

      this._lastInputSent = now;

      if (this.wsSendInput) {
        this.wsSendInput(target, accelerate, boost);
      }
    };
  }

  /**
   * Setup input handlers
   */
  private _setupInputHandlers(): void {
    const canvas = this.app?.canvas;
    if (!canvas) return;

    // Mouse move
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;

      // Convert to world coordinates and update player target
      if (this.player && this._game) {
        const renderSystem = this._game.getEngine().getSystemManager().getSystem<any>('render');
        if (renderSystem) {
          const worldPos = renderSystem.screenToWorld(this.mouse.x, this.mouse.y);
          this.player.targetAngle = Math.atan2(worldPos.y - this.player.y, worldPos.x - this.player.x);
          this._inputCallback?.(worldPos, true, this.player.isBoosting);
        }
      }
    });

    // Keyboard for abilities
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Ability activations
      if (this._game) {
        switch (e.code) {
          case 'KeyQ':
            this._game.activateAbility('dash');
            break;
          case 'KeyE':
            this._game.activateAbility('shield');
            break;
          case 'KeyF':
            this._game.activateAbility('trap');
            break;
          case 'ShiftLeft':
          case 'ShiftRight':
            if (e.ctrlKey || e.metaKey) { // Ctrl+Shift or Cmd+Shift
              this._game.activateAbility('overdrive');
            }
            break;
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  /**
   * Create car object compatible with old code
   */
  private _createCarCompat(entityId: string, isPlayer: boolean): any {
    const entity = this._game?.getEngine().getEntityManager().getEntity(entityId);
    if (!entity) return null;

    const position = entity.getComponent<any>('Position');
    const velocity = entity.getComponent<any>('Velocity');
    const health = entity.getComponent<any>('Health');
    const player = entity.getComponent<any>('Player');
    const boost = entity.getComponent<any>('Boost');

    if (!position || !velocity || !player) return null;

    return {
      id: entityId,
      x: position.x,
      y: position.y,
      angle: velocity.angle,
      targetAngle: velocity.angle,
      speed: velocity.speed,
      baseSpeed: 250,
      boostSpeed: 350,
      isBoosting: boost?.isBoosting ?? false,
      boostEnergy: boost?.energy ?? 100,
      maxBoostEnergy: boost?.maxEnergy ?? 100,
      color: player.color,
      name: player.name,
      type: isPlayer ? 'player' : 'bot',
      kills: health?.kills ?? 0,
      destroyed: !health?.isAlive ?? false,
      trailPoints: [],
      // Methods
      getKill: (victimName: string) => {
        if (health) {
          health.kills++;
          this.recentKills.push({
            killer: player.name,
            victim: victimName,
            time: Date.now(),
          });
        }
      },
    };
  }

  /**
   * Sync zone state from ECS
   */
  private _syncZone(): void {
    if (!this._game) return;

    const engine = this._game.getEngine();
    const zoneSystem = engine.getSystemManager().getSystem<any>('zone');
    if (zoneSystem) {
      const zoneInfo = zoneSystem.getDebugInfo();
      this.zone.centerX = zoneInfo.center.x;
      this.zone.centerY = zoneInfo.center.y;
      this.zone.startRadius = zoneInfo.currentRadius;
      this.zone.endRadius = 600; // From config
    }
  }

  /**
   * Apply server world state
   */
  applyServerWorld(world: { width: number; height: number }): void {
    if (!world || !world.width || !world.height) return;
    this.arena = { width: world.width, height: world.height };

    if (this._game) {
      const engine = this._game.getEngine();
      const zoneSystem = engine.getSystemManager().getSystem<any>('zone');
      if (zoneSystem) {
        zoneSystem.setArenaSize(world.width, world.height);
      }
      const physicsSystem = engine.getSystemManager().getSystem<any>('physics');
      if (physicsSystem) {
        physicsSystem.setWorldBounds(world.width, world.height);
      }
    }
  }

  /**
   * Sync server players (for online mode)
   */
  syncServerPlayers(players: any[]): void {
    if (!players) return;
    const myId = this.wsHud?.playerId;

    for (const p of players) {
      if (myId && p.id === myId) continue;

      let car = this.serverPlayers.get(p.id);
      if (!car) {
        // Create new server player entity
        car = {
          id: p.id,
          x: p.sperm.position.x,
          y: p.sperm.position.y,
          angle: p.sperm.angle,
          targetAngle: p.sperm.angle,
          speed: 200,
          baseSpeed: 200,
          boostSpeed: 300,
          isBoosting: p.status?.boosting || false,
          color: parseInt(p.sperm.color?.replace('#', '') || 'ff00ff', 16),
          name: this.wsHud?.idToName?.[p.id] || p.id.slice(0, 8),
          type: 'remote_player',
          kills: 0,
          destroyed: !p.isAlive,
          trailPoints: p.trail || [],
        };
        this.serverPlayers.set(p.id, car);
      } else {
        // Update existing
        car.x = p.sperm.position.x;
        car.y = p.sperm.position.y;
        car.angle = p.sperm.angle;
        car.isBoosting = p.status?.boosting || false;
        car.destroyed = !p.isAlive;
        if (p.trail) car.trailPoints = p.trail;
      }
    }

    // Update alive count
    this.alivePlayers = players.filter(p => p.isAlive).length;
  }

  /**
   * Trigger haptic feedback
   */
  triggerHaptic(type: 'light' | 'medium' | 'heavy'): void {
    try {
      const pattern = type === 'light' ? 10 : type === 'medium' ? 30 : [50, 30, 50];
      navigator.vibrate?.(pattern);
    } catch {}
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    this.destroyed = true;

    if (this._game) {
      await this._game.destroy();
      this._game = null;
    }

    if (this.uiContainer?.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
    }

    this._initialized = false;
  }

  /**
   * Get game instance (for debug/inspection)
   */
  getGame(): Game | null {
    return this._game;
  }
}

/**
 * Factory function to create game adapter
 */
export function createGameAdapter(
  container: HTMLElement,
  onReplay?: () => void,
  onExit?: () => void
): GameAdapter {
  return new GameAdapter(container, onReplay, onExit);
}
