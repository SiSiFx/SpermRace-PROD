/**
 * WebSocket Wrapper with Reconnection, RTT Measurement, and Queue
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - RTT (Round-Trip Time) measurement and compensation
 * - Message queue for offline buffering
 * - Heartbeat/ping-pong for connection health
 * - Event-driven architecture
 */

/**
 * WebSocket states matching the WebSocket API
 */
export type WSReadyState =
  | 'CONNECTING'    // 0
  | 'OPEN'          // 1
  | 'CLOSING'       // 2
  | 'CLOSED';       // 3

/**
 * WebSocket connection state for our wrapper
 */
export type WSConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnecting';

/**
 * Configuration for WebSocket wrapper
 */
export interface WSConfig {
  /** WebSocket URL */
  url: string | (() => string);
  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number;
  /** Maximum reconnect attempts (default: Infinity) */
  maxReconnectAttempts?: number;
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  /** Heartbeat timeout in ms (default: 5000) */
  heartbeatTimeout?: number;
  /** Maximum number of messages to queue while disconnected (default: 100) */
  maxQueueSize?: number;
  /** Enable RTT measurement (default: true) */
  enableRTT?: boolean;
  /** Protocols for WebSocket (optional) */
  protocols?: string | string[];
}

/**
 * Message types for internal use
 */
interface QueuedMessage {
  data: string;
  timestamp: number;
  retries: number;
}

interface PingMessage {
  type: 'ping';
  timestamp: number;
  id?: number;
}

interface PongMessage {
  type: 'pong';
  timestamp: number;
  id?: number;
  serverTimestamp?: number;
}

/**
 * Event types for WebSocket events
 */
export type WSEventHandler = (event: Event | MessageEvent | CloseEvent | ErrorEvent) => void;

export interface WSEventHandlers {
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onReconnecting?: (attempt: number, delay: number) => void;
  onStateChange?: (state: WSConnectionState) => void;
  onRTTUpdate?: (rtt: number) => void;
}

/**
 * Statistics about the connection
 */
export interface WSStats {
  state: WSConnectionState;
  readyState: WSReadyState;
  connectTime: number | null;
  lastMessageTime: number | null;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  bytesReceived: number;
  currentRTT: number;
  averageRTT: number;
  minRTT: number;
  maxRTT: number;
}

/**
 * WebSocket wrapper class
 */
export class WebSocketWithReconnect {
  private config: Required<WSConfig>;
  private ws: WebSocket | null = null;
  private state: WSConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimer: number | null = null;
  private connectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private heartbeatTimeoutTimer: number | null = null;
  private messageQueue: QueuedMessage[] = [];
  private eventHandlers: WSEventHandlers = {};

  // RTT tracking
  private pingId: number = 0;
  private pingsInFlight: Map<number, number> = new Map(); // id -> sendTime
  private rttSamples: number[] = [];
  private readonly maxRttSamples = 10;
  private currentRTT: number = 0;

  // Statistics
  private stats: WSStats = {
    state: 'disconnected',
    readyState: 'CLOSED',
    connectTime: null,
    lastMessageTime: null,
    reconnectAttempts: 0,
    messagesSent: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    currentRTT: 0,
    averageRTT: 0,
    minRTT: Infinity,
    maxRTT: 0,
  };

  constructor(config: WSConfig) {
    this.config = {
      url: config.url,
      connectionTimeout: config.connectionTimeout ?? 10000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? Infinity,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      heartbeatTimeout: config.heartbeatTimeout ?? 5000,
      maxQueueSize: config.maxQueueSize ?? 100,
      enableRTT: config.enableRTT ?? true,
      protocols: config.protocols ?? [],
    };

    // Listen for online events to reconnect
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.state === 'disconnected') {
          this.connect();
        }
      });
    }
  }

  /**
   * Get current connection state
   */
  getState(): WSConnectionState {
    return this.state;
  }

  /**
   * Get WebSocket ready state
   */
  getReadyState(): WSReadyState {
    if (!this.ws) return 'CLOSED';
    const state = this.ws.readyState;
    switch (state) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'CLOSED';
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): WSStats {
    return { ...this.stats };
  }

  /**
   * Get current RTT in milliseconds
   */
  getRTT(): number {
    return this.currentRTT;
  }

  /**
   * Get server time offset (if supported by server)
   */
  getServerTimeOffset(): number {
    // This would be calculated from pong messages with serverTimestamp
    // For now, return 0
    return 0;
  }

  /**
   * Set event handlers
   */
  on(handlers: WSEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Remove event handlers
   */
  off(handlers: Partial<WSEventHandlers>): void {
    Object.keys(handlers).forEach(key => {
      delete this.eventHandlers[key as keyof WSEventHandlers];
    });
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    // If already connected or connecting, return existing promise
    if (this.state === 'connected' || this.state === 'connecting') {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.setState('connecting');

      try {
        const url = typeof this.config.url === 'function' ? this.config.url() : this.config.url;
        this.ws = new WebSocket(url, this.config.protocols);

        // Set connection timeout
        this.connectTimer = window.setTimeout(() => {
          if (this.state === 'connecting') {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, this.config.connectionTimeout);

        // Setup event handlers
        this.ws.onopen = (event) => {
          this.handleOpen(event);
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
        };

        this.ws.onerror = (event) => {
          this.handleError(event);
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        this.setState('disconnected');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.setState('disconnecting');
    this.clearReconnectTimer();
    this.clearHeartbeat();
    this.clearConnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Send data through WebSocket
   */
  send(data: string | ArrayBuffer | Blob): boolean {
    if (!this.isConnected()) {
      // Queue message for later
      return this.queueMessage(data);
    }

    try {
      this.ws!.send(data);
      this.stats.messagesSent++;
      return true;
    } catch (error) {
      console.error('[WS] Send error:', error);
      return false;
    }
  }

  /**
   * Send JSON data
   */
  sendJSON(obj: any): boolean {
    return this.send(JSON.stringify(obj));
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get the underlying WebSocket instance
   */
  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  /**
   * Handle open event
   */
  private handleOpen(event: Event): void {
    this.clearConnectTimer();
    this.reconnectAttempts = 0;
    this.setState('connected');
    this.stats.connectTime = Date.now();

    // Send queued messages
    this.flushQueue();

    // Start heartbeat
    this.startHeartbeat();

    // Start RTT measurement
    if (this.config.enableRTT) {
      this.sendPing();
    }

    this.eventHandlers.onOpen?.(event);
  }

  /**
   * Handle message event
   */
  private handleMessage(event: MessageEvent): void {
    this.stats.lastMessageTime = Date.now();
    this.stats.messagesReceived++;
    this.stats.bytesReceived += (event.data as string).length;

    // Check for pong message for RTT calculation
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === 'pong' || msg.type === 'pongMessage') {
        this.handlePong(msg);
        return; // Don't forward ping/pong messages to app
      }
      // Handle server-initiated ping
      if (msg.type === 'ping') {
        this.sendPong(msg);
        return;
      }
    } catch {
      // Not JSON, continue normally
    }

    this.eventHandlers.onMessage?.(event);
  }

  /**
   * Handle close event
   */
  private handleClose(event: CloseEvent): void {
    this.clearHeartbeat();
    this.clearConnectTimer();
    this.stats.connectTime = null;

    const wasClean = event.wasClean && event.code === 1000;

    if (wasClean) {
      // Normal close
      this.setState('disconnected');
    } else {
      // Abnormal close - attempt reconnect
      this.setState('disconnected');
      this.scheduleReconnect();
    }

    this.eventHandlers.onClose?.(event);
  }

  /**
   * Handle error event
   */
  private handleError(event: Event): void {
    this.eventHandlers.onError?.(event);
  }

  /**
   * Set connection state
   */
  private setState(newState: WSConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.stats.state = newState;
      this.stats.readyState = this.getReadyState();
      this.eventHandlers.onStateChange?.(newState);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      this.setState('disconnected');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.config.maxReconnectDelay
    );

    this.eventHandlers.onReconnecting?.(this.reconnectAttempts, delay);
    this.setState('reconnecting');

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WS] Reconnect failed:', error);
        this.scheduleReconnect();
      });
    }, delay);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Clear connect timer
   */
  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  /**
   * Start heartbeat/ping
   */
  private startHeartbeat(): void {
    this.clearHeartbeat();

    this.heartbeatTimer = window.setInterval(() => {
      if (this.isConnected()) {
        this.sendPing();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Clear heartbeat timers
   */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  /**
   * Send ping message
   */
  private sendPing(): void {
    if (!this.isConnected()) return;

    const id = ++this.pingId;
    const ping: PingMessage = {
      type: 'ping',
      timestamp: Date.now(),
      id,
    };

    this.pingsInFlight.set(id, ping.timestamp);
    this.sendJSON(ping);

    // Set timeout for pong response
    setTimeout(() => {
      if (this.pingsInFlight.has(id)) {
        this.pingsInFlight.delete(id);
        // Pong timeout - might indicate connection issues
      }
    }, this.config.heartbeatTimeout);
  }

  /**
   * Send pong response
   */
  private sendPong(ping: PingMessage): void {
    const pong: PongMessage = {
      type: 'pong',
      timestamp: ping.timestamp,
      id: ping.id,
      serverTimestamp: Date.now(),
    };
    this.sendJSON(pong);
  }

  /**
   * Handle pong message
   */
  private handlePong(pong: PongMessage): void {
    if (pong.id !== undefined) {
      const sendTime = this.pingsInFlight.get(pong.id);
      if (sendTime) {
        this.pingsInFlight.delete(pong.id);
        const rtt = Date.now() - sendTime;
        this.updateRTT(rtt);
      }
    }
  }

  /**
   * Update RTT statistics
   */
  private updateRTT(rtt: number): void {
    this.currentRTT = rtt;
    this.rttSamples.push(rtt);

    // Keep only the last N samples
    if (this.rttSamples.length > this.maxRttSamples) {
      this.rttSamples.shift();
    }

    // Calculate statistics
    const sum = this.rttSamples.reduce((a, b) => a + b, 0);
    this.stats.averageRTT = sum / this.rttSamples.length;
    this.stats.minRTT = Math.min(this.stats.minRTT, rtt);
    this.stats.maxRTT = Math.max(this.stats.maxRTT, rtt);
    this.stats.currentRTT = rtt;

    this.eventHandlers.onRTTUpdate?.(rtt);
  }

  /**
   * Queue a message for later sending
   */
  private queueMessage(data: string | ArrayBuffer | Blob): boolean {
    // Convert to string for storage
    const message: QueuedMessage = {
      data: typeof data === 'string' ? data : JSON.stringify(data),
      timestamp: Date.now(),
      retries: 0,
    };

    // Check queue size limit
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      // Remove oldest message
      this.messageQueue.shift();
    }

    this.messageQueue.push(message);
    return false;
  }

  /**
   * Flush queued messages
   */
  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          this.ws!.send(message.data);
          this.stats.messagesSent++;
        } catch (error) {
          // Re-queue message
          message.retries++;
          if (message.retries < 3) {
            this.messageQueue.unshift(message);
          }
          break;
        }
      }
    }
  }
}

/**
 * Factory function to create a WebSocket wrapper
 */
export function createWebSocket(config: WSConfig): WebSocketWithReconnect {
  return new WebSocketWithReconnect(config);
}
