/**
 * EdgeGap Client
 *
 * Handles communication with EdgeGap's edge computing platform.
 * Provides automatic region selection, session management, and WebRTC support.
 *
 * https://edgegap.com/fr/
 */

import type {
  EdgeGapEnvironment,
  EdgeGapSessionConfig,
} from './EdgeGapConfig';
import { fetchWithRetry } from '../fetchWithTimeoutAndRetry';

/**
 * EdgeGap session response
 */
export interface EdgeGapSession {
  /** Unique session ID */
  sessionId: string;

  /** Server endpoint (WebSocket or WebRTC) */
  serverUrl: string;

  /** Server region */
  region: string;

  /** Authentication token for this session */
  token: string;

  /** Maximum players */
  maxPlayers: number;

  /** Current player count */
  playerCount: number;

  /** Session expires at */
  expiresAt: number;
}

/**
 * EdgeGap server status
 */
export interface EdgeGapServerStatus {
  /** Server is healthy */
  healthy: boolean;

  /** Current player count */
  playerCount: number;

  /** CPU usage % */
  cpuUsage: number;

  /** Memory usage % */
  memoryUsage: number;

  /** Average latency (ms) */
  avgLatency: number;

  /** Server region */
  region: string;
}

/**
 * EdgeGap connection state
 */
export type EdgeGapConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

/**
 * EdgeGap client options
 */
export interface EdgeGapClientOptions {
  /** Environment configuration */
  env: EdgeGapEnvironment;

  /** Session configuration */
  session: EdgeGapSessionConfig;

  /** Player name */
  playerName: string;

  /** Player color */
  playerColor?: number;

  /** Called when connection state changes */
  onStateChange?: (state: EdgeGapConnectionState) => void;

  /** Called when player connects */
  onPlayerConnect?: (playerId: string, playerName: string) => void;

  /** Called when player disconnects */
  onPlayerDisconnect?: (playerId: string) => void;

  /** Called when game state is received */
  onGameState?: (state: any) => void;

  /** Called when error occurs */
  onError?: (error: Error) => void;
}

/**
 * EdgeGap client for multiplayer connectivity
 */
export class EdgeGapClient {
  private readonly _options: EdgeGapClientOptions;
  private _session: EdgeGapSession | null = null;
  private _ws: WebSocket | null = null;
  private _state: EdgeGapConnectionState = 'disconnected';
  private _heartbeatInterval: number | null = null;
  private _reconnectTimeout: number | null = null;
  private _connectionTimeout: number | null = null;
  private _playerId: string | null = null;
  private _latencyMs: number = 0;
  private _lastPingTime: number = 0;
  private _resolveConnection: ((value: void) => void) | null = null;
  private _rejectConnection: ((error: unknown) => void) | null = null;

  constructor(options: EdgeGapClientOptions) {
    this._options = options;
  }

  /**
   * Get current connection state
   */
  get state(): EdgeGapConnectionState {
    return this._state;
  }

  /**
   * Get current session
   */
  get session(): EdgeGapSession | null {
    return this._session;
  }

  /**
   * Get player ID
   */
  get playerId(): string | null {
    return this._playerId;
  }

  /**
   * Get current latency (ms)
   */
  get latency(): number {
    return this._latencyMs;
  }

  /**
   * Find best region based on latency
   */
  async findBestRegion(regions: string[]): Promise<string> {
    const latencies: Record<string, number> = {};

    // Ping each region's API endpoint
    const promises = regions.map(async (region) => {
      const start = performance.now();
      try {
        const response = await fetchWithRetry(`${this._options.env.apiUrl}/ping/${region}`, {
          timeout: 3000,
          maxRetries: 1,
          method: 'HEAD',
          headers: { 'cache': 'no-cache' },
        });
        if (response.status >= 200 && response.status < 300) {
          latencies[region] = performance.now() - start;
        }
      } catch {
        latencies[region] = Infinity;
      }
    });

    await Promise.all(promises);

    // Find region with lowest latency
    let bestRegion = regions[0];
    let bestLatency = Infinity;

    for (const [region, latency] of Object.entries(latencies)) {
      if (latency < bestLatency) {
        bestLatency = latency;
        bestRegion = region;
      }
    }

    return bestRegion;
  }

  /**
   * Create a new game session
   */
  async createSession(region?: string): Promise<EdgeGapSession> {
    this._setState('connecting');

    const preferredRegion = region || this._options.env.region;

    try {
      // Request session from EdgeGap API
      const result = await fetchWithRetry<EdgeGapSession>(`${this._options.env.apiUrl}/sessions`, {
        timeout: 10000,
        maxRetries: 2,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this._options.env.apiKey || ''}`,
        },
        body: JSON.stringify({
          appId: this._options.env.appId,
          region: preferredRegion === 'auto' ? undefined : preferredRegion,
          maxPlayers: this._options.session.maxPlayers,
          config: {
            enableWebRTC: this._options.session.enableWebRTC,
          },
        }),
      });

      this._session = result.data;

      return result.data;
    } catch (error) {
      this._setState('failed');
      this._options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Join an existing session
   */
  async joinSession(sessionId: string): Promise<void> {
    this._setState('connecting');

    try {
      // Get session info from EdgeGap API
      const result = await fetchWithRetry<EdgeGapSession>(`${this._options.env.apiUrl}/sessions/${sessionId}`, {
        timeout: 8000,
        maxRetries: 2,
        headers: {
          'Authorization': `Bearer ${this._options.env.apiKey || ''}`,
        },
      });

      this._session = result.data;

      // Connect to server
      await this.connect(result.data.serverUrl);
    } catch (error) {
      this._setState('failed');
      this._options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Connect to game server via WebSocket
   */
  async connect(serverUrl: string): Promise<void> {
    // Clear any existing connection timeout
    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }

    return new Promise((resolve, reject) => {
      this._resolveConnection = resolve;
      this._rejectConnection = reject;

      try {
        this._ws = new WebSocket(serverUrl);

        this._ws.onopen = () => {
          // Clear timeout since connection succeeded
          if (this._connectionTimeout) {
            clearTimeout(this._connectionTimeout);
            this._connectionTimeout = null;
          }
          this._setState('connected');
          this._startHeartbeat();
          resolve();
        };

        this._ws.onmessage = (event) => {
          this._handleMessage(event.data);
        };

        this._ws.onclose = (event) => {
          // Clear timeout on close
          if (this._connectionTimeout) {
            clearTimeout(this._connectionTimeout);
            this._connectionTimeout = null;
          }
          this._handleClose(event.code, event.reason);
        };

        this._ws.onerror = (error) => {
          // Clear timeout on error
          if (this._connectionTimeout) {
            clearTimeout(this._connectionTimeout);
            this._connectionTimeout = null;
          }
          this._setState('failed');
          this._options.onError?.(new Error(`WebSocket error: ${error}`));
          reject(error);
        };

        // Connection timeout - store reference for cleanup
        this._connectionTimeout = window.setTimeout(() => {
          if (this._state === 'connecting' || this._state === 'disconnected') {
            this._ws?.close();
            this._connectionTimeout = null;
            reject(new Error('Connection timeout'));
          }
        }, this._options.session.connectionTimeout);
      } catch (error) {
        this._setState('failed');
        reject(error);
      }
    });
  }

  /**
   * Send player input to server
   */
  sendInput(input: {
    targetX: number;
    targetY: number;
    boosting: boolean;
    abilities?: Record<string, boolean>;
  }): void {
    if (!this._ws || this._state !== 'connected') return;

    this._send({
      type: 'input',
      data: input,
    });
  }

  /**
   * Send ability activation
   */
  sendAbility(abilityType: string): void {
    if (!this._ws || this._state !== 'connected') return;

    this._send({
      type: 'ability',
      data: { ability: abilityType },
    });
  }

  /**
   * Request respawn
   */
  sendRespawn(): void {
    if (!this._ws || this._state !== 'connected') return;

    this._send({
      type: 'respawn',
      data: {},
    });
  }

  /**
   * Get server status
   */
  async getServerStatus(): Promise<EdgeGapServerStatus | null> {
    if (!this._session) return null;

    try {
      const result = await fetchWithRetry<EdgeGapServerStatus>(
        `${this._options.env.apiUrl}/sessions/${this._session.sessionId}/status`,
        {
          timeout: 5000,
          maxRetries: 1,
          headers: {
            'Authorization': `Bearer ${this._options.env.apiKey || ''}`,
          },
        }
      );

      return result.data;
    } catch {
      return null;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this._stopHeartbeat();
    this._clearReconnect();

    // Clear connection timeout if exists
    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }

    if (this._ws) {
      this._ws.close(1000, 'Client disconnect');
      this._ws = null;
    }

    this._session = null;
    this._playerId = null;
    this._resolveConnection = null;
    this._rejectConnection = null;
    this._setState('disconnected');
  }

  /**
   * Handle incoming message from server
   */
  private _handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'welcome':
          this._playerId = message.data.playerId;
          break;

        case 'player_joined':
          this._options.onPlayerConnect?.(
            message.data.playerId,
            message.data.playerName
          );
          break;

        case 'player_left':
          this._options.onPlayerDisconnect?.(message.data.playerId);
          break;

        case 'game_state':
          this._options.onGameState?.(message.data);
          break;

        case 'ping':
          // Respond to server ping
          this._send({
            type: 'pong',
            data: { timestamp: message.data.timestamp },
          });
          break;

        case 'pong':
          // Calculate latency
          this._latencyMs = performance.now() - this._lastPingTime;
          break;

        default:
          // Unknown message type
      }
    } catch (error) {
      console.error('[EdgeGap] Failed to parse message:', data);
    }
  }

  /**
   * Handle WebSocket close
   */
  private _handleClose(code: number, reason: string): void {
    this._stopHeartbeat();

    if (code === 1000) {
      // Normal close
      this._setState('disconnected');
    } else {
      // Abnormal close - attempt reconnect
      this._setState('reconnecting');
      this._scheduleReconnect();
    }
  }

  /**
   * Send message to server
   */
  private _send(message: { type: string; data: any }): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private _startHeartbeat(): void {
    this._heartbeatInterval = window.setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._lastPingTime = performance.now();
        this._send({
          type: 'ping',
          data: { timestamp: this._lastPingTime },
        });
      }
    }, this._options.session.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private _stopHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private _scheduleReconnect(): void {
    this._clearReconnect();

    const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts()), 30000);

    this._reconnectTimeout = window.setTimeout(async () => {
      if (this._session) {
        try {
          await this.connect(this._session.serverUrl);
        } catch (error) {
          this._scheduleReconnect();
        }
      }
    }, delay);
  }

  /**
   * Clear reconnect timeout
   */
  private _clearReconnect(): void {
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
  }

  /**
   * Get current reconnect attempt number
   */
  private _reconnectAttempts(): number {
    // Simple counter - could be stored as instance variable
    return 1;
  }

  /**
   * Set connection state and notify listeners
   */
  private _setState(state: EdgeGapConnectionState): void {
    if (this._state !== state) {
      this._state = state;
      this._options.onStateChange?.(state);
    }
  }
}

/**
 * Factory function to create EdgeGap client
 */
export function createEdgeGapClient(options: EdgeGapClientOptions): EdgeGapClient {
  return new EdgeGapClient(options);
}
