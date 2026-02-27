/**
 * Player component
 * Distinguishes between human players, bots, and stores player metadata
 */

import { PLAYER_VISUAL_CONFIG } from '../config/GameConstants';

/**
 * Entity type enum
 */
export enum EntityType {
  /** Human-controlled player (local) */
  PLAYER = 'player',

  /** Human-controlled player (remote) */
  REMOTE_PLAYER = 'remote_player',

  /** AI-controlled bot */
  BOT = 'bot',
}

/**
 * Player component
 */
export interface Player {
  /** Entity type */
  type: EntityType;

  /** Display name */
  name: string;

  /** Unique player ID (matches server ID if online) */
  playerId: string;

  /** Color for rendering (hex number) */
  color: number;

  /** Is this the local player? */
  isLocal: boolean;

  /** Player avatar URL (optional) */
  avatar?: string;

  /** Player rank/level (for future use) */
  level?: number;
}

/** Component name for type-safe access */
export const PLAYER_COMPONENT = 'Player';

/**
 * Create a player component
 */
export function createPlayer(config: Partial<Player> & { type: EntityType }): Player {
  return {
    name: config.name || 'Player',
    playerId: config.playerId || generatePlayerId(),
    color: config.color || PLAYER_VISUAL_CONFIG.DEFAULT_COLOR,
    type: config.type,
    isLocal: config.type === EntityType.PLAYER,
  };
}

/**
 * Generate a random player ID
 */
export function generatePlayerId(): string {
  return `player_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if entity is a local player
 */
export function isLocalPlayer(player: Player): boolean {
  return player.type === EntityType.PLAYER;
}

/**
 * Check if entity is a remote player
 */
export function isRemotePlayer(player: Player): boolean {
  return player.type === EntityType.REMOTE_PLAYER;
}

/**
 * Check if entity is a bot
 */
export function isBot(player: Player): boolean {
  return player.type === EntityType.BOT;
}

/**
 * Check if entity is human (local or remote)
 */
export function isHuman(player: Player): boolean {
  return player.type === EntityType.PLAYER || player.type === EntityType.REMOTE_PLAYER;
}
