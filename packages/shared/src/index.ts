// =================================================================================================
// CORE GAME TYPES
// =================================================================================================

export { WORLD, PHYSICS, TRAIL, COLLISION, TICK, INPUT, BURST } from './constants';

/** Represents a 2D vector. */
export interface Vector2 {
  x: number;
  y: number;
}

/** Represents the input state from a player. */
export interface PlayerInput {
  target: Vector2;
  accelerate: boolean;
  /** Optional momentary boost input */
  boost?: boolean;
  /** Optional drift/brake input for tighter turning */
  drift?: boolean;
}

/** Represents the physical state of a spermatozoide. */
export interface SpermState {
  position: Vector2;
  velocity: Vector2;
  angle: number; // in radians
  angularVelocity: number;
  color: string;
}

/** A single point in a spermatozoide's trail with a timestamp. */
export interface TrailPoint extends Vector2 {
  expiresAt: number; // timestamp
  /** Optional creation timestamp for time-based collision fairness. */
  createdAt?: number;
}

/** A collectible item present in the game world. */
export interface GameItem {
  id: string;
  type: 'dna';
  x: number;
  y: number;
}

/** Match objective state (optional). */
export interface ExtractionObjectiveState {
  kind: 'extraction';
  keysRequired: number;
  // Egg is centered in world-space (0..width/height); client may re-center.
  egg: { x: number; y: number; radius: number; openAtMs: number; holdMs: number };
  holding?: { playerId: string; sinceMs: number };
  keysByPlayerId: Record<string, number>;
}

/** Represents a player in the game. */
export interface Player {
  id: string; // Solana public key
  sperm: SpermState;
  trail: TrailPoint[];
  isAlive: boolean;
  status?: { boosting: boolean; boostCooldownMs: number; boostMaxCooldownMs: number };
  input: PlayerInput;
}

// =================================================================================================
// GAME STATE & LOBBY
// =================================================================================================

/** Represents the state of a single game round. */
export interface GameState {
  roundId: string;
  status: 'waiting' | 'countdown' | 'in_progress' | 'finished';
  players: Record<string, Player>;
  winnerId?: string;
  world: {
    width: number;
    height: number;
  };
  items: Record<string, GameItem>;
  objective?: ExtractionObjectiveState;
}

/** Represents the entry fee tiers in USD. */
export type EntryFeeTier = 0 | 1 | 5 | 25 | 100;

/** Game modes */
export type GameMode = 'practice' | 'tournament';

/** Represents a lobby where players wait for a game. */
export interface Lobby {
  lobbyId: string;
  players: string[]; // List of player IDs (public keys)
  playerNames?: Record<string, string>; // Optional mapping of player IDs to display names
  maxPlayers: number;
  entryFee: EntryFeeTier;
  mode: GameMode;
  status: 'waiting' | 'starting';
}

// =================================================================================================
// WEBSOCKET COMMUNICATION PROTOCOL
// =================================================================================================

// -------------------------------------------------------------------------------------------------
// Client -> Server Messages
// -------------------------------------------------------------------------------------------------

export interface AuthenticateMessage {
  type: 'authenticate';
  payload: {
    publicKey: string;
    signedMessage: string; // Assuming SIWS provides a signed message
    nonce: string;
  };
}

export interface GuestLoginMessage {
  type: 'guestLogin';
  payload: {
    guestName: string;
    guestId?: string;
    resumeToken?: string;
  };
}

export interface JoinLobbyMessage {
  type: 'joinLobby';
  payload: {
    entryFeeTier: EntryFeeTier;
    mode?: GameMode;
  };
}

export interface LeaveLobbyMessage {
  type: 'leaveLobby';
  payload: {};
}

export interface PlayerInputMessage {
  type: 'playerInput';
  payload: PlayerInput;
}

export interface EntryFeeSignatureMessage {
  type: 'entryFeeSignature';
  payload: {
    signature: string; // signature of the submitted entry fee transaction
    paymentId?: string;
    sessionNonce?: string;
  };
}

export interface PongMessage {
  type: 'pong';
  payload: {
    pingId: number;
    timestamp: number;
  };
}

export type ClientToServerMessage =
  | AuthenticateMessage
  | GuestLoginMessage
  | JoinLobbyMessage
  | LeaveLobbyMessage
  | PlayerInputMessage
  | EntryFeeSignatureMessage
  | PongMessage;

// -------------------------------------------------------------------------------------------------
// Server -> Client Messages
// -------------------------------------------------------------------------------------------------

export interface AuthenticatedMessage {
  type: 'authenticated';
  payload: {
    playerId: string; // wallet public key base58
    resumeToken?: string; // guest resume token
  };
}

export interface LobbyStateMessage {
  type: 'lobbyState';
  payload: Lobby;
}

export interface GameStartingMessage {
  type: 'gameStarting';
  payload: {
    countdown: number; // seconds
    rules: string[];
  };
}

export interface LobbyCountdownMessage {
  type: 'lobbyCountdown';
  payload: {
    lobbyId: string;
    remaining: number;
  };
}

export interface SiwsChallengeMessage {
  type: 'siwsChallenge';
  payload: {
    message: string;
    nonce: string;
  };
}

export interface EntryFeeTransactionMessage {
  type: 'entryFeeTx';
  payload: {
    txBase64: string;
    lamports: number;
    recentBlockhash: string;
    prizePool: string; // base58
    entryFeeTier: EntryFeeTier;
    // Optional context identifiers for idempotency/verification
    paymentId?: string;
    sessionNonce?: string;
    // Legacy compatibility key sometimes used by clients
    transaction?: string;
  };
}

export interface EntryFeeVerifiedMessage {
  type: 'entryFeeVerified';
  payload: {
    ok: boolean;
    reason?: string;
  };
}

export interface GameStateUpdateMessage {
  type: 'gameStateUpdate';
  payload: {
    timestamp: number;
    // When present, the server will not advance physics/collisions until this time (server ms).
    // Clients can use it to align their pre-start countdown/zoom.
    goAtMs?: number;
    // Trails are intentionally optional here; newer servers send trails via `trailDelta`.
    players: Array<Pick<Player, 'id' | 'sperm' | 'isAlive' | 'status'> & { trail?: TrailPoint[] }>;
    world: { width: number; height: number };
    aliveCount: number;
    objective?: ExtractionObjectiveState;
  };
}

export interface TrailDeltaMessage {
  type: 'trailDelta';
  payload: {
    timestamp: number;
    deltas: Array<{ playerId: string; points: TrailPoint[] }>;
  };
}

export interface PlayerEliminatedMessage {
  type: 'playerEliminated';
  payload: {
    playerId: string;
    eliminatorId?: string; // Who caused the elimination
  };
}

export interface RoundEndMessage {
  type: 'roundEnd';
  payload: {
    winnerId: string;
    prizeAmount: number; // in SOL
    txSignature?: string;
  };
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    message: string;
  };
}

export interface PingMessage {
  type: 'ping';
  payload: {
    pingId: number;
    timestamp: number;
  };
}

export type ServerToClientMessage =
  | AuthenticatedMessage
  | LobbyStateMessage
  | GameStartingMessage
  | GameStateUpdateMessage
  | TrailDeltaMessage
  | PlayerEliminatedMessage
  | RoundEndMessage
  | ErrorMessage
  | LobbyCountdownMessage
  | SiwsChallengeMessage
  | EntryFeeTransactionMessage
  | EntryFeeVerifiedMessage
  | PingMessage;
// =================================================================================================
// RUNTIME SCHEMAS (zod)
// =================================================================================================
// Export runtime schema for client->server validation
export { clientToServerMessageSchema } from './schemas';
