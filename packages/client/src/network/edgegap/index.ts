/**
 * EdgeGap Network Module
 *
 * Edge computing integration for global multiplayer.
 * https://edgegap.com/fr/
 *
 * @example
 * ```ts
 * import { createNetworkAdapter, getNetworkBackend } from './network/edgegap';
 *
 * const adapter = createNetworkAdapter({
 *   backend: getNetworkBackend(),
 *   edgegap: {
 *     env: getEdgeGapConfig(),
 *     session: DEFAULT_EDGE_GAP_SESSION,
 *     playerName: 'Player',
 *   },
 *   onGameState: (state) => {
 *     // Update game with server state
 *   },
 * });
 *
 * await adapter.connect();
 * ```
 */

// Configuration
export { getEdgeGapConfig, DEFAULT_EDGE_GAP_ENV, type EdgeGapEnvironment } from './EdgeGapConfig';
export { DEFAULT_EDGE_GAP_SESSION } from './EdgeGapAdapter';

// Client
export * from './EdgeGapClient';

// Adapter
export { EdgeGapAdapter as NetworkAdapter, type NetworkAdapterConfig, createNetworkAdapter } from './EdgeGapAdapter';

// React Hooks
export * from './useEdgeGap';
