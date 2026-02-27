/**
 * Network Adapter
 *
 * Abstraction layer for different network backends.
 * Supports: WebSocket, EdgeGap, and future providers.
 *
 * This allows the game to switch between:
 * - Direct WebSocket (development/testing)
 * - EdgeGap edge computing (production)
 * - Other providers (future)
 */

import type { EdgeGapClient, EdgeGapConnectionState } from './EdgeGapClient';
import type { GameEngine } from '../../game/engine/core/GameEngine';

/**
 * Network backend type
 */
export type NetworkBackend = 'websocket' | 'edgegap' | 'local';

/**
 * Network adapter configuration
 */
export interface NetworkAdapterConfig {
  /** Backend type */
  backend: NetworkBackend;

  /** WebSocket URL (for websocket backend) */
  wsUrl?: string;

  /** EdgeGap configuration (for edgegap backend) */
  edgegap?: {
    env: any;
    session: any;
    playerName: string;
    playerColor?: number;
  };

  /** Callbacks */
  onStateChange?: (state: NetworkConnectionState) => void;
  onPlayerConnect?: (playerId: string, playerName: string) => void;
  onPlayerDisconnect?: (playerId: string) => void;
  onGameState?: (state: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Network connection state
 */
export type NetworkConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * Player input for network transmission
 */
export interface NetworkInput {
  targetX: number;
  targetY: number;
  boosting: boolean;
  abilities?: Record<string, boolean>;
}

/**
 * Network adapter interface
 */
export type NetworkAdapter = INetworkAdapter;

export interface INetworkAdapter {
  /** Current connection state */
  readonly state: NetworkConnectionState;

  /** Local player ID */
  readonly playerId: string | null;

  /** Current latency (ms) */
  readonly latency: number;

  /** Connect to server */
  connect(): Promise<void>;

  /** Disconnect from server */
  disconnect(): void;

  /** Send player input */
  sendInput(input: NetworkInput): void;

  /** Send ability activation */
  sendAbility(abilityType: string): void;

  /** Request respawn */
  sendRespawn(): void;
}

/**
 * WebSocket adapter for direct connections
 */
export class WebSocketAdapter implements INetworkAdapter {
  private readonly _config: NetworkAdapterConfig;
  private _ws: WebSocket | null = null;
  private _state: NetworkConnectionState = 'disconnected';
  private _playerId: string | null = null;
  private _latencyMs: number = 0;

  constructor(config: NetworkAdapterConfig) {
    this._config = config;
  }

  get state(): NetworkConnectionState {
    return this._state;
  }

  get playerId(): string | null {
    return this._playerId;
  }

  get latency(): number {
    return this._latencyMs;
  }

  async connect(): Promise<void> {
    const wsUrl = this._config.wsUrl;
    if (!wsUrl) {
      throw new Error('WebSocket URL not configured');
    }

    this._setState('connecting');

    return new Promise((resolve, reject) => {
      try {
        this._ws = new WebSocket(wsUrl);

        this._ws.onopen = () => {
          this._setState('connected');
          resolve();
        };

        this._ws.onmessage = (event) => {
          this._handleMessage(event.data);
        };

        this._ws.onclose = () => {
          this._setState('disconnected');
        };

        this._ws.onerror = (error) => {
          this._setState('failed');
          const errorMsg = error instanceof Error ? error.message : 'WebSocket connection failed';
          this._config.onError?.(new Error(errorMsg));
          reject(new Error(errorMsg));
        };
      } catch (error) {
        this._setState('failed');
        const errorMsg = error instanceof Error ? error.message : 'Failed to create WebSocket';
        reject(new Error(errorMsg));
      }
    });
  }

  disconnect(): void {
    this._ws?.close();
    this._ws = null;
    this._playerId = null;
    this._setState('disconnected');
  }

  sendInput(input: NetworkInput): void {
    try {
      this._send({ type: 'input', data: input });
    } catch (error) {
      console.error('[WebSocketAdapter] Failed to send input:', error);
    }
  }

  sendAbility(abilityType: string): void {
    try {
      this._send({ type: 'ability', data: { ability: abilityType } });
    } catch (error) {
      console.error('[WebSocketAdapter] Failed to send ability:', error);
    }
  }

  sendRespawn(): void {
    try {
      this._send({ type: 'respawn', data: {} });
    } catch (error) {
      console.error('[WebSocketAdapter] Failed to send respawn:', error);
    }
  }

  private _send(message: any): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      try {
        this._ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WebSocketAdapter] Send failed:', error);
        throw error;
      }
    } else {
      console.warn('[WebSocketAdapter] Cannot send message: WebSocket is not open');
    }
  }

  private _handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'welcome':
          this._playerId = message.data.playerId;
          break;

        case 'player_joined':
          this._config.onPlayerConnect?.(message.data.playerId, message.data.playerName);
          break;

        case 'player_left':
          this._config.onPlayerDisconnect?.(message.data.playerId);
          break;

        case 'game_state':
          this._config.onGameState?.(message.data);
          break;
      }
    } catch {
      // Ignore parse errors
    }
  }

  private _setState(state: NetworkConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this._config.onStateChange?.(state);
    }
  }
}

/**
 * EdgeGap adapter for edge computing
 */
export class EdgeGapAdapter implements INetworkAdapter {
  private readonly _client: any; // EdgeGapClient

  constructor(config: NetworkAdapterConfig) {
    const { createEdgeGapClient } = require('./EdgeGapClient');

    this._client = createEdgeGapClient({
      env: config.edgegap!.env,
      session: config.edgegap!.session,
      playerName: config.edgegap!.playerName,
      playerColor: config.edgegap!.playerColor,
      onStateChange: (state: EdgeGapConnectionState) => {
        config.onStateChange?.(state as NetworkConnectionState);
      },
      onPlayerConnect: config.onPlayerConnect,
      onPlayerDisconnect: config.onPlayerDisconnect,
      onGameState: config.onGameState,
      onError: config.onError,
    });
  }

  get state(): NetworkConnectionState {
    return this._client.state;
  }

  get playerId(): string | null {
    return this._client.playerId;
  }

  get latency(): number {
    return this._client.latency;
  }

  async connect(): Promise<void> {
    // Create session and connect via EdgeGap
    try {
      const session = await this._client.createSession();
      await this._client.connect(session.serverUrl);
    } catch (error) {
      console.error('[EdgeGapAdapter] Connection failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to connect to EdgeGap server');
    }
  }

  disconnect(): void {
    try {
      this._client.disconnect();
    } catch (error) {
      console.error('[EdgeGapAdapter] Disconnect failed:', error);
    }
  }

  sendInput(input: NetworkInput): void {
    try {
      this._client.sendInput(input);
    } catch (error) {
      console.error('[EdgeGapAdapter] Failed to send input:', error);
    }
  }

  sendAbility(abilityType: string): void {
    try {
      this._client.sendAbility(abilityType);
    } catch (error) {
      console.error('[EdgeGapAdapter] Failed to send ability:', error);
    }
  }

  sendRespawn(): void {
    try {
      this._client.sendRespawn();
    } catch (error) {
      console.error('[EdgeGapAdapter] Failed to send respawn:', error);
    }
  }
}

/**
 * Local adapter for offline practice
 */
class LocalAdapter implements INetworkAdapter {
  private _playerId: string;
  private _state: NetworkConnectionState = 'connected';

  constructor() {
    this._playerId = 'local-player';
  }

  get state(): NetworkConnectionState {
    return this._state;
  }

  get playerId(): string | null {
    return this._playerId;
  }

  get latency(): number {
    return 0;
  }

  async connect(): Promise<void> {
    // No connection needed for local
  }

  disconnect(): void {
    this._state = 'disconnected';
  }

  sendInput(): void {
    // Input handled directly by game engine
  }

  sendAbility(): void {
    // Abilities handled directly by game engine
  }

  sendRespawn(): void {
    // Respawn handled directly by game engine
  }
}

/**
 * Network adapter factory
 */
export function createNetworkAdapter(config: NetworkAdapterConfig): INetworkAdapter {
  switch (config.backend) {
    case 'websocket':
      return new WebSocketAdapter(config);

    case 'edgegap':
      return new EdgeGapAdapter(config);

    case 'local':
      return new LocalAdapter();

    default:
      throw new Error(`Unknown network backend: ${config.backend}`);
  }
}

/**
 * Get network backend from environment
 */
export function getNetworkBackend(): NetworkBackend {
  const backend = import.meta.env.VITE_NETWORK_BACKEND;

  if (backend === 'websocket' || backend === 'edgegap' || backend === 'local') {
    return backend;
  }

  // Default to local for development
  return 'local';
}

/**
 * Get WebSocket URL from environment
 */
export function getWebSocketUrl(): string {
  return (
    import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  );
}

/**
 * Get EdgeGap configuration from environment variables.
 * Configuration is retrieved from VITE_EDGE_GAP_API_URL and VITE_EDGE_GAP_API_KEY.
 * Returns empty strings for missing values, allowing the caller to handle unconfigured state.
 */
export function getEdgeGapConfig() {
  return {
    apiUrl: import.meta.env.VITE_EDGE_GAP_API_URL || '',
    apiKey: import.meta.env.VITE_EDGE_GAP_API_KEY || '',
  };
}

/**
 * Default EdgeGap session configuration.
 * These defaults are used when creating a new EdgeGap session.
 */
export const DEFAULT_EDGE_GAP_SESSION = {
  mode: 'practice',
  region: 'us-east',
};
