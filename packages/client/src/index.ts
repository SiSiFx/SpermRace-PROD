// =================================================================================================
// CORE GAME TYPES
// =================================================================================================

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

/** Represents a player in the game. */
export interface Player {
  id: string; // Solana public key
  sperm: SpermState;
  trail: TrailPoint[];
  isAlive: boolean;
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
}

/** Represents the entry fee tiers in USD. */
export type EntryFeeTier = 1 | 5 | 25 | 100;

/** Game modes */
export type GameMode = 'practice' | 'tournament';

/** Represents a lobby where players wait for a game. */
export interface Lobby {
  lobbyId: string;
  players: string[]; // List of player IDs (public keys)
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

export type ClientToServerMessage =
  | AuthenticateMessage
  | JoinLobbyMessage
  | LeaveLobbyMessage
  | PlayerInputMessage
  | EntryFeeSignatureMessage;

// -------------------------------------------------------------------------------------------------
// Server -> Client Messages
// -------------------------------------------------------------------------------------------------

export interface AuthenticatedMessage {
  type: 'authenticated';
  payload: {
    playerId: string; // wallet public key base58
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
    players: Array<Pick<Player, 'id' | 'sperm' | 'isAlive'> & { trail: TrailPoint[] }>;
    world: { width: number; height: number };
    aliveCount: number;
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

export type ServerToClientMessage =
  | AuthenticatedMessage
  | LobbyStateMessage
  | GameStartingMessage
  | GameStateUpdateMessage
  | PlayerEliminatedMessage
  | RoundEndMessage
  | ErrorMessage
  | LobbyCountdownMessage
  | SiwsChallengeMessage
  | EntryFeeTransactionMessage
  | EntryFeeVerifiedMessage
  | { type: 'lobbyRefund'; payload: { reason: string; lamports: number; txSignature: string } }
  | { type: 'soloPlayerWarning'; payload: { secondsUntilRefund: number } };
// =================================================================================================
// RUNTIME SCHEMAS (zod)
// =================================================================================================
// Export runtime schema for client->server validation
export { clientToServerMessageSchema } from '../../shared/src/schemas';

