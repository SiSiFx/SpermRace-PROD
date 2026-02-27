/**
 * EdgeGap Configuration
 *
 * EdgeGap is a global edge computing platform for multiplayer games.
 * https://edgegap.com/fr/
 *
 * This module prepares the configuration needed for EdgeGap integration.
 */

/**
 * EdgeGap environment configuration
 * Set these via environment variables or deployment config
 */
export interface EdgeGapEnvironment {
  /** EdgeGap API endpoint */
  apiUrl: string;

  /** EdgeGap application ID */
  appId: string;

  /** EdgeGap API key (kept server-side) */
  apiKey?: string;

  /** WebSocket relay endpoint for signaling */
  relayUrl?: string;

  /** Region preference (auto, or specific like 'us-east', 'eu-west') */
  region?: string;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * EdgeGap session configuration
 */
export interface EdgeGapSessionConfig {
  /** Maximum players per session */
  maxPlayers: number;

  /** Session timeout (ms) */
  sessionTimeout: number;

  /** Heartbeat interval (ms) */
  heartbeatInterval: number;

  /** Connection timeout (ms) */
  connectionTimeout: number;

  /** Enable WebRTC direct connections (p2p) */
  enableWebRTC?: boolean;

  /** STUN servers for WebRTC */
  stunServers?: string[];

  /** TURN servers for WebRTC fallback */
  turnServers?: string[];
}

/**
 * EdgeGap server configuration
 */
export interface EdgeGapServerConfig {
  /** Container image */
  image: string;

  /** CPU cores */
  cpu: number;

  /** Memory (MB) */
  memory: number;

  /** Bandwidth (Mbps) */
  bandwidth: number;

  /** Port range */
  portRange: { min: number; max: number };

  /** Auto-scaling configuration */
  autoScale?: {
    /** Minimum servers */
    minServers: number;

    /** Maximum servers */
    maxServers: number;

    /** Scale up threshold (CPU %) */
    scaleUpThreshold: number;

    /** Scale down threshold (CPU %) */
    scaleDownThreshold: number;

    /** Idle time before scale down (seconds) */
    idleTimeout: number;
  };
}

/**
 * Default EdgeGap configuration
 */
export const DEFAULT_EDGE_GAP_ENV: EdgeGapEnvironment = {
  apiUrl: 'https://api.edgegap.com/v1',
  appId: '',
  relayUrl: 'wss://relay.edgegap.com',
  region: 'auto', // Auto-select closest region
  debug: false,
};

export const DEFAULT_EDGE_GAP_SESSION: EdgeGapSessionConfig = {
  maxPlayers: 32,
  sessionTimeout: 300000, // 5 minutes
  heartbeatInterval: 10000, // 10 seconds
  connectionTimeout: 15000, // 15 seconds
  enableWebRTC: true,
  stunServers: [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
  ],
  turnServers: [], // Configure for production
};

export const DEFAULT_EDGE_GAP_SERVER: EdgeGapServerConfig = {
  image: 'spermrace/game-server:latest',
  cpu: 1,
  memory: 1024, // 1GB
  bandwidth: 100,
  portRange: { min: 8000, max: 9000 },
  autoScale: {
    minServers: 1,
    maxServers: 50,
    scaleUpThreshold: 70,
    scaleDownThreshold: 20,
    idleTimeout: 300,
  },
};

/**
 * Get EdgeGap configuration from environment
 */
export function getEdgeGapConfig(): EdgeGapEnvironment {
  return {
    apiUrl: import.meta.env.VITE_EDGE_GAP_API_URL || DEFAULT_EDGE_GAP_ENV.apiUrl,
    appId: import.meta.env.VITE_EDGE_GAP_APP_ID || DEFAULT_EDGE_GAP_ENV.appId,
    relayUrl: import.meta.env.VITE_EDGE_GAP_RELAY_URL || DEFAULT_EDGE_GAP_ENV.relayUrl,
    region: import.meta.env.VITE_EDGE_GAP_REGION || DEFAULT_EDGE_GAP_ENV.region,
    debug: import.meta.env.VITE_EDGE_GAP_DEBUG === 'true',
  };
}

/**
 * EdgeGap regions
 */
export const EDGE_GAP_REGIONS = [
  { id: 'us-east', name: 'US East', location: 'Virginia, USA' },
  { id: 'us-west', name: 'US West', location: 'California, USA' },
  { id: 'eu-west', name: 'Europe West', location: 'London, UK' },
  { id: 'eu-central', name: 'Europe Central', location: 'Frankfurt, Germany' },
  { id: 'asia-east', name: 'Asia East', location: 'Tokyo, Japan' },
  { id: 'asia-southeast', name: 'Asia Southeast', location: 'Singapore' },
  { id: 'south-america', name: 'South America', location: 'São Paulo, Brazil' },
  { id: 'australia', name: 'Australia', location: 'Sydney, Australia' },
] as const;

export type EdgeGapRegionId = typeof EDGE_GAP_REGIONS[number]['id'];
