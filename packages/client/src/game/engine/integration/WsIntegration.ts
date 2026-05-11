/**
 * WebSocket Integration for ECS Engine
 * Connects the new ECS engine with the existing WsProvider
 */

import { Game } from '../Game';
import { AbilityType } from '../config';

/**
 * Server game state message
 */
export interface ServerGameState {
  timestamp: number;
  goAtMs?: number;
  players: Array<ServerPlayerState>;
  world: { width: number; height: number };
  aliveCount: number;
}

/**
 * Server player state
 */
export interface ServerPlayerState {
  id: string;
  isAlive: boolean;
  sperm: {
    position: { x: number; y: number };
    angle: number;
    color: string;
  };
  trail?: Array<{ x: number; y: number }>;
  status?: {
    boosting: boolean;
  };
  abilities?: {
    dash: { ready: boolean; cooldownUntil: number };
    shield: { ready: boolean; cooldownUntil: number; activeUntil: number };
    trap: { ready: boolean; cooldownUntil: number };
    overdrive: { ready: boolean; cooldownUntil: number; activeUntil: number };
  };
}

/**
 * WebSocket integration config
 */
export interface WsIntegrationConfig {
  /** Game instance */
  game: Game;

  /** Local player ID */
  localPlayerId?: string;

  /** Callback for input sending */
  onSendInput?: (input: { targetX: number; targetY: number }, boost: boolean) => void;

  /** Callback for player elimination */
  onPlayerEliminated?: (victimId: string, killerId?: string) => void;
}

/**
 * WebSocket integration class
 * Handles bidirectional communication between game engine and server
 */
export class WsIntegration {
  private readonly _game: Game;
  private readonly _onSendInput: (input: { targetX: number; targetY: number }, boost: boolean) => void;
  private readonly _onPlayerEliminated?: (victimId: string, killerId?: string) => void;

  private _localPlayerId: string | null = null;
  private _remotePlayers: Map<string, RemotePlayer> = new Map();
  private _lastInputState: { targetX: number; targetY: number } | null = null;

  // Trail sync optimization
  private _trailSyncBuffer: Map<string, Array<{ x: number; y: number; timestamp: number }>> = new Map();
  private _lastTrailSync: number = 0;
  private readonly _trailSyncInterval = 100; // Sync trails every 100ms

  constructor(config: WsIntegrationConfig) {
    this._game = config.game;
    this._onSendInput = config.onSendInput ?? (() => {});
    this._onPlayerEliminated = config.onPlayerEliminated;
    this._localPlayerId = config.localPlayerId ?? null;
  }

  /**
   * Set local player ID
   */
  setLocalPlayerId(playerId: string): void {
    this._localPlayerId = playerId;
  }

  /**
   * Get local player ID
   */
  getLocalPlayerId(): string | null {
    return this._localPlayerId;
  }

  /**
   * Process server game state
   */
  processGameState(state: ServerGameState): void {
    // Process each player
    for (const serverPlayer of state.players) {
      const isLocal = serverPlayer.id === this._localPlayerId;

      if (isLocal) {
        // Reconcile local player state
        this._reconcileLocalPlayer(serverPlayer);
      } else {
        // Update remote player
        this._updateRemotePlayer(serverPlayer);
      }
    }

    // Clean up disconnected players
    this._cleanupDisconnectedPlayers(state.players);

    // Sync trails periodically
    const now = Date.now();
    if (now - this._lastTrailSync >= this._trailSyncInterval) {
      this._syncTrails(state.players);
      this._lastTrailSync = now;
    }
  }

  /**
   * Reconcile local player state from server
   */
  private _reconcileLocalPlayer(serverPlayer: ServerPlayerState): void {
    const engine = this._game.getEngine();
    const entityManager = engine.getEntityManager();
    const playerId = this._game.getPlayerId();

    if (!playerId) return;

    const entity = entityManager.getEntity(playerId);
    if (!entity) return;

    const position = entity.getComponent<any>('Position');
    const velocity = entity.getComponent<any>('Velocity');
    const health = entity.getComponent<any>('Health');
    const abilities = entity.getComponent<any>('Abilities');

    if (!position || !velocity || !health) return;

    // Only reconcile if alive (server is authoritative for death)
    if (serverPlayer.isAlive && !health.isAlive) {
      // Server says we're alive but we think we're dead - respawn
      health.isAlive = true;
      health.state = 'alive';
    } else if (!serverPlayer.isAlive && health.isAlive) {
      // Server says we're dead - kill
      health.isAlive = false;
      health.state = 'dead';
      this._onPlayerEliminated?.(serverPlayer.id);
    }

    // Sync abilities from server
    if (abilities && serverPlayer.abilities) {
      this._syncAbilities(abilities, serverPlayer.abilities);
    }
  }

  /**
   * Update remote player
   */
  private _updateRemotePlayer(serverPlayer: ServerPlayerState): void {
    let remote = this._remotePlayers.get(serverPlayer.id);

    if (!remote) {
      // Create new remote player entity
      remote = this._createRemotePlayer(serverPlayer);
      this._remotePlayers.set(serverPlayer.id, remote);
    }

    // Update state
    remote.targetX = serverPlayer.sperm.position.x;
    remote.targetY = serverPlayer.sperm.position.y;
    remote.targetAngle = serverPlayer.sperm.angle;
    remote.isAlive = serverPlayer.isAlive;
    remote.isBoosting = serverPlayer.status?.boosting ?? false;

    // Update trail
    if (serverPlayer.trail) {
      remote.trail = serverPlayer.trail;
    }

    // Update abilities
    if (serverPlayer.abilities) {
      remote.abilities = serverPlayer.abilities;
    }
  }

  /**
   * Create remote player entity
   */
  private _createRemotePlayer(serverPlayer: ServerPlayerState): RemotePlayer {
    // We create a lightweight entity for remote players
    // The actual rendering is handled by the existing code

    return {
      id: serverPlayer.id,
      x: serverPlayer.sperm.position.x,
      y: serverPlayer.sperm.position.y,
      angle: serverPlayer.sperm.angle,
      targetX: serverPlayer.sperm.position.x,
      targetY: serverPlayer.sperm.position.y,
      targetAngle: serverPlayer.sperm.angle,
      isAlive: serverPlayer.isAlive,
      isBoosting: false,
      color: parseInt(serverPlayer.sperm.color.replace('#', ''), 16),
      trail: serverPlayer.trail || [],
      abilities: serverPlayer.abilities,
    };
  }

  /**
   * Clean up players that are no longer in the game
   */
  private _cleanupDisconnectedPlayers(serverPlayers: ServerPlayerState[]): void {
    const serverIds = new Set(serverPlayers.map(p => p.id));

    for (const [id] of this._remotePlayers) {
      if (!serverIds.has(id)) {
        this._remotePlayers.delete(id);
      }
    }
  }

  /**
   * Sync abilities from server
   */
  private _syncAbilities(entityAbilities: any, serverAbilities: any): void {
    const now = Date.now();

    // Update each ability state
    for (const type of Object.values(AbilityType)) {
      if (serverAbilities[type]) {
        const serverAbility = serverAbilities[type];
        entityAbilities[type].ready = serverAbility.ready;
        entityAbilities[type].cooldownUntil = serverAbility.cooldownUntil;

        if (serverAbility.activeUntil) {
          entityAbilities[type].activeUntil = serverAbility.activeUntil;

          if (now < serverAbility.activeUntil) {
            entityAbilities.active.add(type);
          } else {
            entityAbilities.active.delete(type);
          }
        }
      }
    }
  }

  /**
   * Sync trails from server
   */
  private _syncTrails(serverPlayers: ServerPlayerState[]): void {
    for (const serverPlayer of serverPlayers) {
      if (serverPlayer.id === this._localPlayerId) continue;
      if (!serverPlayer.trail) continue;

      const remote = this._remotePlayers.get(serverPlayer.id);
      if (remote) {
        remote.trail = serverPlayer.trail;
      }
    }
  }

  /**
   * Send input to server
   */
  sendInput(targetX: number, targetY: number, boost: boolean): void {
    this._lastInputState = { targetX, targetY };
    this._onSendInput({ targetX, targetY }, boost);
  }

  /**
   * Get interpolated state of a remote player
   */
  getRemotePlayerState(playerId: string): RemotePlayer | null {
    return this._remotePlayers.get(playerId) || null;
  }

  /**
   * Get all remote players
   */
  getAllRemotePlayers(): Map<string, RemotePlayer> {
    return this._remotePlayers;
  }

  /**
   * Get last input state
   */
  getLastInputState(): { targetX: number; targetY: number } | null {
    return this._lastInputState;
  }

  /**
   * Clear all remote players
   */
  clear(): void {
    this._remotePlayers.clear();
    this._trailSyncBuffer.clear();
    this._lastInputState = null;
  }
}

/**
 * Remote player state
 */
export interface RemotePlayer {
  id: string;
  x: number;
  y: number;
  angle: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  isAlive: boolean;
  isBoosting: boolean;
  color: number;
  trail: Array<{ x: number; y: number }>;
  abilities?: any;
}

/**
 * Factory function
 */
export function createWsIntegration(config: WsIntegrationConfig): WsIntegration {
  return new WsIntegration(config);
}
