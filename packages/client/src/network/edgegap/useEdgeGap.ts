/**
 * React hooks for EdgeGap integration
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createNetworkAdapter,
  getNetworkBackend,
  getEdgeGapConfig,
  DEFAULT_EDGE_GAP_SESSION,
  type NetworkAdapter,
  type NetworkConnectionState,
  type NetworkInput,
} from './EdgeGapAdapter';
import type { GameEngine } from '../../game/engine/core/GameEngine';

/**
 * EdgeGap connection hook
 */
export interface UseEdgeGapOptions {
  /** Player name */
  playerName?: string;

  /** Player color */
  playerColor?: number;

  /** Called when connection state changes */
  onStateChange?: (state: NetworkConnectionState) => void;

  /** Called when game state is received */
  onGameState?: (state: any) => void;

  /** Called when player connects */
  onPlayerConnect?: (playerId: string, playerName: string) => void;

  /** Called when player disconnects */
  onPlayerDisconnect?: (playerId: string) => void;

  /** Called when error occurs */
  onError?: (error: Error) => void;

  /** Auto-connect on mount */
  autoConnect?: boolean;
}

/**
 * Hook for EdgeGap network connection
 */
export function useEdgeGap({
  playerName = 'Player',
  playerColor = 0x22d3ee,
  onStateChange,
  onGameState,
  onPlayerConnect,
  onPlayerDisconnect,
  onError,
  autoConnect = true,
}: UseEdgeGapOptions = {}) {
  const adapterRef = useRef<NetworkAdapter | null>(null);
  const [state, setState] = useState<NetworkConnectionState>('disconnected');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [latency, setLatency] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Track mounted state to prevent setState after unmount
  const isMountedRef = useRef<boolean>(true);

  // Safe state setters
  const setStateSafe = useCallback((newState: NetworkConnectionState) => {
    if (isMountedRef.current) setState(newState);
  }, []);

  const setIsConnectedSafe = useCallback((connected: boolean) => {
    if (isMountedRef.current) setIsConnected(connected);
  }, []);

  const setLatencySafe = useCallback((lat: number) => {
    if (isMountedRef.current) setLatency(lat);
  }, []);

  const setPlayerIdSafe = useCallback((id: string | null) => {
    if (isMountedRef.current) setPlayerId(id);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Create adapter on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const adapter = createNetworkAdapter({
      backend: getNetworkBackend(),
      edgegap: {
        env: getEdgeGapConfig(),
        session: DEFAULT_EDGE_GAP_SESSION,
        playerName,
        playerColor,
      },
      onStateChange: (newState) => {
        setStateSafe(newState);
        setIsConnectedSafe(newState === 'connected');
        onStateChange?.(newState);
      },
      onGameState,
      onPlayerConnect: (id, name) => {
        onPlayerConnect?.(id, name);
      },
      onPlayerDisconnect: (id) => {
        onPlayerDisconnect?.(id);
      },
      onError,
    });

    adapterRef.current = adapter;

    if (autoConnect) {
      adapter.connect().catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
        console.error('[EdgeGap] Failed to connect:', errorMsg);
        onError?.(new Error(errorMsg));
      });
    }

    return () => {
      try {
        adapter.disconnect();
      } catch (error) {
        console.error('[EdgeGap] Disconnect failed:', error);
      }
    };
    // Intentionally omitting callback deps - adapter should only be created once
  }, [setStateSafe, setIsConnectedSafe, playerName, playerColor, autoConnect, onStateChange, onGameState, onPlayerConnect, onPlayerDisconnect, onError]);

  // Update latency periodically
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      const adapter = adapterRef.current;
      if (adapter) {
        setLatencySafe(adapter.latency);
        setPlayerIdSafe(adapter.playerId);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  /**
   * Send input to server
   */
  const sendInput = useCallback((input: NetworkInput) => {
    try {
      adapterRef.current?.sendInput(input);
    } catch (error) {
      console.error('[EdgeGap] Failed to send input:', error);
    }
  }, []);

  /**
   * Send ability activation
   */
  const sendAbility = useCallback((abilityType: string) => {
    try {
      adapterRef.current?.sendAbility(abilityType);
    } catch (error) {
      console.error('[EdgeGap] Failed to send ability:', error);
    }
  }, []);

  /**
   * Request respawn
   */
  const sendRespawn = useCallback(() => {
    try {
      adapterRef.current?.sendRespawn();
    } catch (error) {
      console.error('[EdgeGap] Failed to send respawn:', error);
    }
  }, []);

  /**
   * Manual connect
   */
  const connect = useCallback(async () => {
    const adapter = adapterRef.current;
    if (adapter) {
      try {
        await adapter.connect();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Connection failed';
        console.error('[EdgeGap] Manual connect failed:', errorMsg);
        onError?.(new Error(errorMsg));
        throw error;
      }
    }
  }, [onError]);

  /**
   * Disconnect
   */
  const disconnect = useCallback(() => {
    try {
      adapterRef.current?.disconnect();
    } catch (error) {
      console.error('[EdgeGap] Disconnect failed:', error);
    }
  }, []);

  return {
    state,
    playerId,
    latency,
    isConnected,
    sendInput,
    sendAbility,
    sendRespawn,
    connect,
    disconnect,
  };
}

/**
 * Network stats hook
 */
export interface NetworkStats {
  /** Ping (ms) */
  ping: number;

  /** Jitter (ms) */
  jitter: number;

  /** Packet loss (%) */
  packetLoss: number;

  /** Bytes sent */
  bytesSent: number;

  /** Bytes received */
  bytesReceived: number;

  /** Send rate (bytes/sec) */
  sendRate: number;

  /** Receive rate (bytes/sec) */
  receiveRate: number;
}

export function useNetworkStats(adapter: NetworkAdapter | null) {
  const [stats, setStats] = useState<NetworkStats>({
    ping: 0,
    jitter: 0,
    packetLoss: 0,
    bytesSent: 0,
    bytesReceived: 0,
    sendRate: 0,
    receiveRate: 0,
  });

  const pingHistoryRef = useRef<number[]>([]);
  const lastBytesRef = useRef({ sent: 0, received: 0 });
  const lastUpdateRef = useRef<number>(Date.now());
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!adapter) return;

    const interval = setInterval(() => {
      if (!isMountedRef.current) return;

      const now = Date.now();
      const dt = (now - lastUpdateRef.current) / 1000;

      // Update ping
      const currentPing = adapter.latency;
      pingHistoryRef.current.push(currentPing);
      if (pingHistoryRef.current.length > 20) {
        pingHistoryRef.current.shift();
      }

      // Calculate jitter (variation in ping)
      const pings = pingHistoryRef.current;
      const avgPing = pings.length > 0
        ? pings.reduce((a, b) => a + b, 0) / pings.length
        : 0;
      const jitter = pings.length > 0
        ? pings.reduce((sum, ping) => sum + Math.abs(ping - avgPing), 0) / pings.length
        : 0;

      setStats((prev) => ({
        ...prev,
        ping: currentPing,
        jitter,
        sendRate: 0, // Would need actual byte tracking
        receiveRate: 0,
      }));

      lastUpdateRef.current = now;
    }, 1000);

    return () => clearInterval(interval);
  }, [adapter]);

  return stats;
}

/**
 * Connection quality indicator
 */
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor';

export function useConnectionQuality(ping: number, jitter: number): ConnectionQuality {
  // Derive quality directly from inputs instead of using state
  // This eliminates the need for useEffect and prevents stale state
  if (ping < 50 && jitter < 10) {
    return 'excellent';
  } else if (ping < 100 && jitter < 30) {
    return 'good';
  } else if (ping < 200 && jitter < 50) {
    return 'fair';
  } else {
    return 'poor';
  }
}

/**
 * Get connection quality color
 */
export function getConnectionQualityColor(quality: ConnectionQuality): string {
  switch (quality) {
    case 'excellent':
      return '#22d3ee'; // cyan
    case 'good':
      return '#10b981'; // green
    case 'fair':
      return '#f59e0b'; // amber
    case 'poor':
      return '#ef4444'; // red
  }
}

/**
 * Get connection quality label
 */
export function getConnectionQualityLabel(quality: ConnectionQuality): string {
  switch (quality) {
    case 'excellent':
      return 'EXCELLENT';
    case 'good':
      return 'GOOD';
    case 'fair':
      return 'FAIR';
    case 'poor':
      return 'POOR';
  }
}
