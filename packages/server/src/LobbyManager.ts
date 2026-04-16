import { Lobby, EntryFeeTier, GameMode } from 'shared';
import { v4 as uuidv4 } from 'uuid';
import { SmartContractService } from './SmartContractService.js';
import { DatabaseService } from './DatabaseService.js';

const BOT_NAMES = [
  'NitroCel','SwimX','VeloCell','ArcBot','PulseX','CellX','DriftBot','OmegaX',
  'ZeroG','VortexB','AlphaBot','NucleiX','TurboX','PhaseX','HexCell','IonBot',
  'ApexX','CellBot','FluxBot','SpikeX','CorvusX','NovaBio','QuasarX','GeneX',
];
const usedBotNames = new Set<string>();
function pickBotName(): string {
  const available = BOT_NAMES.filter(n => !usedBotNames.has(n));
  const pool = available.length > 0 ? available : BOT_NAMES;
  const name = pool[Math.floor(Math.random() * pool.length)];
  usedBotNames.add(name);
  if (usedBotNames.size > BOT_NAMES.length * 2) usedBotNames.clear();
  return name;
}

// =================================================================================================
// Constants
// =================================================================================================

const LOBBY_MAX_PLAYERS_DEFAULT = Math.max(2, parseInt(process.env.LOBBY_MAX_PLAYERS || '100', 10));
const LOBBY_MAX_PLAYERS_PRACTICE_DEFAULT = 10;  // 1 real + 9 bots
function getLobbyMaxPlayers(mode: GameMode): number {
  const key = mode === 'tournament' ? 'LOBBY_MAX_PLAYERS_TOURNAMENT' : 'LOBBY_MAX_PLAYERS_PRACTICE';
  const raw = process.env[key];
  if (raw && String(raw).trim()) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 2) return n;
  }
  if (mode === 'practice') return LOBBY_MAX_PLAYERS_PRACTICE_DEFAULT;
  return LOBBY_MAX_PLAYERS_DEFAULT;
}
const LOBBY_START_COUNTDOWN_DEFAULT = Math.max(5, parseInt(process.env.LOBBY_COUNTDOWN || '15', 10)); // seconds
// Practice lobbies fill with bots immediately — no reason to wait long.
const LOBBY_COUNTDOWN_PRACTICE_DEFAULT = 5;
function getLobbyCountdownSeconds(mode: GameMode): number {
  const key = mode === 'tournament' ? 'LOBBY_COUNTDOWN_TOURNAMENT' : 'LOBBY_COUNTDOWN_PRACTICE';
  const raw = process.env[key];
  if (raw && String(raw).trim()) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 3) return n;
  }
  if (mode === 'practice') return LOBBY_COUNTDOWN_PRACTICE_DEFAULT;
  return LOBBY_START_COUNTDOWN_DEFAULT;
}
const LOBBY_MIN_START = Math.max(2, parseInt(process.env.LOBBY_MIN_START || (process.env.SKIP_ENTRY_FEE === 'true' ? '1' : '4'), 10));
const LOBBY_MAX_WAIT_SEC = Math.max(LOBBY_START_COUNTDOWN_DEFAULT, parseInt(process.env.LOBBY_MAX_WAIT || '30', 10));

function isPracticeBotsEnabled(): boolean {
  const raw = (process.env.ENABLE_PRACTICE_BOTS ?? ((process.env.NODE_ENV || '').toLowerCase() === 'production' ? 'true' : 'false')).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}
function getPracticeBotsTarget(maxPlayers: number): number {
  const raw = process.env.PRACTICE_BOTS_TARGET ?? (((process.env.NODE_ENV || '').toLowerCase() === 'production') ? '8' : '0');
  const n = parseInt(String(raw || '0'), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.min(maxPlayers, n));
}

type SurgeRule = { afterSec: number; minPlayers: number };
function parseSurgeRules(input: string | undefined): SurgeRule[] {
  const raw = (input || '').trim();
  if (!raw) return [];
  return raw.split(',')
    .map(part => part.trim())
    .map(pair => {
      const [secStr, minStr] = pair.split(':');
      const s = Math.max(0, parseInt(secStr || '0', 10));
      const m = Math.max(1, parseInt(minStr || '2', 10));
      return { afterSec: s, minPlayers: m } as SurgeRule;
    })
    .filter(r => Number.isFinite(r.afterSec) && Number.isFinite(r.minPlayers))
    .sort((a, b) => a.afterSec - b.afterSec);
}

// Example format: "60:3,120:2" → after 60s require 3 players, after 120s require 2 players
// Default surge rules optimized for <30s queue times with 100+ players
const DEFAULT_SURGE_RULES = "10:2,20:3,30:4";
const SURGE_RULES: SurgeRule[] = parseSurgeRules(process.env.LOBBY_SURGE_RULES || DEFAULT_SURGE_RULES);

// Maximum ELO spread allowed in a lobby
const MAX_ELO_SPREAD = Math.max(0, parseInt(process.env.MAX_ELO_SPREAD || '500', 10));

// =================================================================================================
// LobbyManager Class
// =================================================================================================

type LobbyEventCallback = (lobby: Lobby) => void;
type LobbyCountdownCallback = (lobby: Lobby, remainingSeconds: number, startAtMs: number) => void;
type EloStore = Pick<DatabaseService, 'getPlayerElo' | 'getPlayersElo'>;

const fallbackEloStore: EloStore = {
  getPlayerElo: async () => 1200,
  getPlayersElo: async (walletAddresses: string[]) => {
    const out = new Map<string, number>();
    for (const wallet of walletAddresses) out.set(wallet, 1200);
    return out;
  },
};


export class LobbyManager {
  private lobbies: Map<string, Lobby> = new Map();
  private playerLobbyMap: Map<string, string> = new Map();
  private smartContractService: SmartContractService;
  private databaseService: EloStore;
  private lobbyDeadlineMs: Map<string, number> = new Map();
  private lobbyCountdownStartMs: Map<string, number> = new Map();
  private lobbyStartAtMs: Map<string, number> = new Map();
  private lobbyCountdownTick: Map<string, NodeJS.Timeout> = new Map();
  private lobbyStartTimeout: Map<string, NodeJS.Timeout> = new Map();

  public onLobbyUpdate: LobbyEventCallback | null = null;
  public onGameStart: LobbyEventCallback | null = null;
  public onLobbyCountdown: LobbyCountdownCallback | null = null;
  public onLobbyRefund: ((lobby: Lobby, playerId: string, lamports: number) => void) | null = null;

  constructor(smartContractService: SmartContractService, databaseService?: EloStore) {
    this.smartContractService = smartContractService;
    this.databaseService = databaseService ?? fallbackEloStore;
  }

  getLobbyForPlayer(playerId: string): Lobby | null {
    const lobbyId = this.playerLobbyMap.get(playerId);
    if (!lobbyId) return null;
    return this.lobbies.get(lobbyId) || null;
  }

  async joinLobby(playerId: string, entryFee: EntryFeeTier, mode: GameMode = (process.env.SKIP_ENTRY_FEE === 'true' ? 'practice' : 'tournament')): Promise<void> {
    console.log(`[LOBBY] joinLobby called: player=${playerId.slice(0,6)}… entryFee=$${entryFee} mode=${mode}`);
    if (this.playerLobbyMap.has(playerId)) return;

    try {
      if (mode === 'tournament' && process.env.SKIP_ENTRY_FEE !== 'true') {
        await this.smartContractService.getEntryFeeInSol(entryFee);
      }
    } catch (error) {
      console.error(`❌ Could not process entry fee for ${playerId}:`, error);
      return;
    }

    // Get player's ELO rating for matchmaking
    const playerElo = await this.databaseService.getPlayerElo(playerId);
    console.log(`[LOBBY] Player ${playerId.slice(0,6)}… ELO: ${playerElo}`);

    let lobby = await this.findAvailableLobby(entryFee, mode, playerElo);
    if (!lobby) {
      lobby = this.createLobby(entryFee, mode);
      console.log(`[LOBBY] Created new lobby ${lobby.lobbyId} (mode=${mode}, fee=$${entryFee})`);
    }

    // Finalize: re-check status just before admitting player to avoid races
    const current = this.lobbies.get(lobby.lobbyId);
    if (!current || current.status !== 'waiting' || !(await this.isEloSpreadAcceptable(current, playerElo))) {
      // Find another waiting lobby or create a new one
      const alt = await this.findAvailableLobby(entryFee, mode, playerElo);
      lobby = alt ?? this.createLobby(entryFee, mode);
    }

    lobby.players.push(playerId);
    this.playerLobbyMap.set(playerId, lobby.lobbyId);
    console.log(`[LOBBY] Player added to ${lobby.lobbyId}; count=${lobby.players.length}/${lobby.maxPlayers}`);

    // For practice mode: inject bots immediately so the lobby roster is visible during the
    // entire countdown window — not deferred to game-start.
    if (lobby.mode === 'practice' && isPracticeBotsEnabled()) {
      this.injectPracticeBots(lobby);
      // injectPracticeBots broadcasts onLobbyUpdate internally — no separate call needed below.
    } else {
      this.onLobbyUpdate?.(lobby);
    }

    // Dev-only bot injection (legacy; guarded by ENABLE_DEV_BOTS=true).
    this.injectDevBots(lobby);

    // If a real player joins a lobby already counting down → reset so they get a full countdown
    const isRealPlayer = !String(playerId).startsWith('BOT_');
    if (lobby.status === 'starting' && isRealPlayer) {
      this.clearLobbyTimers(lobby.lobbyId);
      this.lobbyCountdownStartMs.delete(lobby.lobbyId);
      lobby.status = 'waiting';
      console.log(`[LOBBY] Real player joined mid-countdown — resetting countdown for ${lobby.lobbyId}`);
    } else if (lobby.status === 'starting') {
      // Bot join: just sync the existing countdown (no reset)
      const startAtMs = this.lobbyStartAtMs.get(lobby.lobbyId);
      if (startAtMs) {
        const remaining = Math.ceil((startAtMs - Date.now()) / 1000);
        this.onLobbyCountdown?.(lobby, remaining, startAtMs);
      }
    }

    // Practice requires at least 1 real player when bots fill remaining slots, otherwise 2 real players.
    const realPlayers = lobby.players.filter(p => !String(p).startsWith('BOT_'));
    const minRealToStart = (lobby.mode === 'practice' && isPracticeBotsEnabled()) ? 1 : 2;
    if (realPlayers.length < minRealToStart) {
      if (lobby.mode === 'practice') {
        console.log(`[LOBBY] Practice mode waiting for minimum ${minRealToStart} real player(s) (current: ${realPlayers.length})`);
        // Don't start countdown - wait for another player
      } else {
        const silentWaitMs = 10000; // 10 seconds silent (reduced from 30s for faster queue times)
        console.log(`[LOBBY] Solo tournament player - 10s silent wait before countdown`);
        setTimeout(() => {
          const currentLobby = this.lobbies.get(lobby.lobbyId);
          // Only start countdown if still solo and waiting
          if (currentLobby && currentLobby.players.length === 1 && currentLobby.status === 'waiting') {
            this.startLobbyCountdown(currentLobby);
          }
        }, silentWaitMs);
      }
    } else {
      // Enough real players (or 1 real + bots): start countdown
      this.startLobbyCountdown(lobby);
    }
  }

  leaveLobby(playerId: string): void {
    const lobbyId = this.playerLobbyMap.get(playerId);
    if (!lobbyId) return;

    const lobby = this.lobbies.get(lobbyId);
    // Always clear the player -> lobby mapping even if the lobby vanished.
    this.playerLobbyMap.delete(playerId);
    if (!lobby) return;

    lobby.players = lobby.players.filter(p => p !== playerId);

    // If the lobby is now empty, fully clean up its timers/metadata.
    if (lobby.players.length === 0) {
      this.clearLobbyTimers(lobbyId);
      this.lobbies.delete(lobbyId);
      this.lobbyDeadlineMs.delete(lobbyId);
      this.lobbyCountdownStartMs.delete(lobbyId);
      this.lobbyStartAtMs.delete(lobbyId);
      return;
    }

    // Practice lobbies: if no real players remain, purge the lobby entirely.
    // Without this, the bot-only lobby sits in 'waiting' forever — a zombie that
    // accumulates in the Map across joins/leaves without ever being cleaned up.
    if (lobby.mode === 'practice') {
      const remainingReal = lobby.players.filter(p => !String(p).startsWith('BOT_'));
      if (remainingReal.length === 0) {
        console.log(`[LOBBY] Practice lobby ${lobbyId} has no real players left — purging bot-only lobby`);
        this.clearLobbyTimers(lobbyId);
        this.lobbies.delete(lobbyId);
        this.lobbyDeadlineMs.delete(lobbyId);
        this.lobbyCountdownStartMs.delete(lobbyId);
        this.lobbyStartAtMs.delete(lobbyId);
        return;
      }
    }

    // If a player leaves during countdown, reset the countdown to avoid "ghost slots" + stale start times.
    if (lobby.status === 'starting') {
      this.clearLobbyTimers(lobbyId);
      this.lobbyCountdownStartMs.delete(lobbyId);
      lobby.status = 'waiting';
    }

    this.onLobbyUpdate?.(lobby);

    // Re-evaluate countdown after a leave so remaining players don't get stuck in waiting forever.
    if (lobby.status === 'waiting') {
      const realPlayers = lobby.players.filter(p => !String(p).startsWith('BOT_'));
      const minRealToStart = (lobby.mode === 'practice' && isPracticeBotsEnabled()) ? 1 : 2;
      if (realPlayers.length < minRealToStart) {
        if (lobby.mode === 'practice') {
          // Not enough real players — hold for another player to join.
          return;
        } else {
          const silentWaitMs = 10000; // 10 seconds silent (reduced from 30s for faster queue times)
          setTimeout(() => {
            const currentLobby = this.lobbies.get(lobby.lobbyId);
            if (currentLobby && currentLobby.players.length === 1 && currentLobby.status === 'waiting') {
              this.startLobbyCountdown(currentLobby);
            }
          }, silentWaitMs);
        }
      } else {
        this.startLobbyCountdown(lobby);
      }
    }
  }

  private async findAvailableLobby(entryFee: EntryFeeTier, mode: GameMode, playerElo: number): Promise<Lobby | undefined> {
    for (const lobby of this.lobbies.values()) {
      if (lobby.entryFee === entryFee && lobby.mode === mode && (lobby.status === 'waiting' || lobby.status === 'starting') && lobby.players.length < lobby.maxPlayers) {
        // Check ELO spread for tournament mode
        if (mode === 'tournament' && !(await this.isEloSpreadAcceptable(lobby, playerElo))) {
          continue;
        }
        return lobby;
      }
    }
    return undefined;
  }

  /**
   * Checks if a player's ELO is within the acceptable range for the lobby.
   * Returns true if the player can join without exceeding MAX_ELO_SPREAD.
   */
  private async isEloSpreadAcceptable(lobby: Lobby, playerElo: number): Promise<boolean> {
    // Skip ELO check for practice mode or if lobby is empty
    if (lobby.mode === 'practice' || lobby.players.length === 0) {
      return true;
    }

    // Get ELOs of all real players in the lobby (skip bots)
    const realPlayers = lobby.players.filter(p => !String(p).startsWith('BOT_'));
    if (realPlayers.length === 0) {
      return true;
    }

    const playerElos = await this.databaseService.getPlayersElo(realPlayers);
    const eloValues = Array.from(playerElos.values());

    // Calculate min and max ELO in the lobby
    const minElo = Math.min(...eloValues);
    const maxElo = Math.max(...eloValues);

    // Check if adding this player would exceed the spread
    const newMinElo = Math.min(minElo, playerElo);
    const newMaxElo = Math.max(maxElo, playerElo);
    const newSpread = newMaxElo - newMinElo;

    const acceptable = newSpread <= MAX_ELO_SPREAD;

    if (!acceptable) {
      console.log(`[LOBBY] ELO spread check failed for lobby ${lobby.lobbyId}: current spread=${maxElo - minElo}, new spread would be=${newSpread}, max allowed=${MAX_ELO_SPREAD}`);
    }

    return acceptable;
  }

  private createLobby(entryFee: EntryFeeTier, mode: GameMode): Lobby {
    const maxPlayers = getLobbyMaxPlayers(mode);
    const newLobby: Lobby = {
      lobbyId: uuidv4(),
      players: [],
      maxPlayers,
      entryFee,
      mode,
      status: 'waiting',
    };
    this.lobbies.set(newLobby.lobbyId, newLobby);
    // Set a maximum wait deadline for this lobby
    this.lobbyDeadlineMs.set(newLobby.lobbyId, Date.now() + (LOBBY_MAX_WAIT_SEC * 1000));
    this.lobbyCountdownStartMs.delete(newLobby.lobbyId);
    return newLobby;
  }

  private startLobbyCountdown(lobby: Lobby): void {
    if (lobby.status !== 'waiting') return;
    const realPlayers = lobby.players.filter(p => !String(p).startsWith('BOT_'));
    const minRealToStart = (lobby.mode === 'practice' && isPracticeBotsEnabled()) ? 1 : 2;
    if (lobby.mode === 'practice' && realPlayers.length < minRealToStart) {
      // Not enough real players to start.
      return;
    }

    lobby.status = 'starting';
    this.onLobbyUpdate?.(lobby);

    // mark countdown start
    if (!this.lobbyCountdownStartMs.get(lobby.lobbyId)) {
      this.lobbyCountdownStartMs.set(lobby.lobbyId, Date.now());
    }

    const dynamicMinPlayers = (): number => {
      if (lobby.mode === 'practice') return isPracticeBotsEnabled() ? 1 : 2;
      const baseMin = process.env.SKIP_ENTRY_FEE === 'true' ? Math.max(1, LOBBY_MIN_START) : Math.max(2, LOBBY_MIN_START);
      const startedAt = this.lobbyCountdownStartMs.get(lobby.lobbyId) || Date.now();
      const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
      let minReq = baseMin;
      for (const rule of SURGE_RULES) {
        if (elapsedSec >= rule.afterSec) {
          minReq = Math.min(minReq, rule.minPlayers);
        }
      }
      if (process.env.SKIP_ENTRY_FEE === 'true') return 1;
      return Math.max(2, minReq);
    };

    const maybeStart = () => {
      const deadline = this.lobbyDeadlineMs.get(lobby.lobbyId) || (Date.now() + LOBBY_MAX_WAIT_SEC * 1000);
      // If lobby is full, start immediately — but let practice run its countdown so the lobby is visible
      if (lobby.players.length >= lobby.maxPlayers && lobby.mode !== 'practice') {
        this.clearLobbyTimers(lobby.lobbyId);
        this.onGameStart?.(lobby);
        this.lobbies.delete(lobby.lobbyId);
        lobby.players.forEach(p => this.playerLobbyMap.delete(p));
        return true;
      }
      // If deadline passed, start with whoever is here if at least 2 players
      const minPlayers = dynamicMinPlayers();
      if (Date.now() >= deadline && lobby.players.length >= 2) {
        if (lobby.mode === 'tournament' || lobby.mode === 'practice') {
          const realPlayers = lobby.players.filter(p => !String(p).startsWith('BOT_'));
          const minReal = (lobby.mode === 'practice' && isPracticeBotsEnabled()) ? 1 : 2;
          if (realPlayers.length < minReal) {
            console.log(`[LOBBY] Deadline reached but <${minReal} real players; keeping lobby waiting`);
            return false;
          }
        }
        console.log(`[LOBBY] Max wait reached; starting with ${lobby.players.length} players (min=${minPlayers})`);
        this.injectPracticeBots(lobby); // Safety net: no-op if bots were already injected at join time.
        this.clearLobbyTimers(lobby.lobbyId);
        this.onGameStart?.(lobby);
        this.lobbies.delete(lobby.lobbyId);
        lobby.players.forEach(p => this.playerLobbyMap.delete(p));
        return true;
      }
      return false;
    };

    if (maybeStart()) return;

    // Tournament solo players show countdown until refund deadline. Practice always uses game-start countdown.
    const deadline = this.lobbyDeadlineMs.get(lobby.lobbyId) || (Date.now() + LOBBY_MAX_WAIT_SEC * 1000);
    const isSolo = lobby.players.length === 1;
    const countdownSec = getLobbyCountdownSeconds(lobby.mode);
    const useSoloDeadline = isSolo && lobby.mode === 'tournament';
    const startAtMs = useSoloDeadline ? deadline : (Date.now() + countdownSec * 1000);
    this.lobbyStartAtMs.set(lobby.lobbyId, startAtMs);
    
    // Calculate timeout duration to match countdown
    const timeoutDuration = useSoloDeadline
      ? Math.max(0, deadline - Date.now()) 
      : (countdownSec * 1000);
    
    console.log(`[LOBBY] Countdown: solo=${isSolo}, duration=${Math.ceil(timeoutDuration/1000)}s`);
    
    // initial broadcast for determinism
    this.onLobbyCountdown?.(lobby, Math.ceil((startAtMs - Date.now()) / 1000), startAtMs);
    const tick = setInterval(() => {
      const remaining = Math.ceil((startAtMs - Date.now()) / 1000);
      if (remaining >= 0) this.onLobbyCountdown?.(lobby, remaining, startAtMs);
      if (remaining <= 0) clearInterval(tick);
    }, 1000);
    try { this.lobbyCountdownTick.set(lobby.lobbyId, tick as unknown as NodeJS.Timeout); } catch {}

    const startTimeout = setTimeout(() => {
      // Lock lobby: no late joins here; start if minimal players else revert and requeue
      const minPlayers = dynamicMinPlayers();
      const deadline = this.lobbyDeadlineMs.get(lobby.lobbyId) || (Date.now() + LOBBY_MAX_WAIT_SEC * 1000);
      const realPlayers = lobby.players.filter(p => !String(p).startsWith('BOT_'));
      const minRealRequired = (lobby.mode === 'practice' && isPracticeBotsEnabled()) ? 1 : 2;
      const minOk =
        lobby.mode === 'practice'
          ? (realPlayers.length >= minRealRequired)
          : (lobby.players.length >= minPlayers);
      const deadlineOk =
        Date.now() >= deadline && (
          lobby.mode === 'practice'
            ? (realPlayers.length >= minRealRequired)
            : (lobby.players.length >= 2)
        );
      if (minOk || deadlineOk) {
        // Safety net: no-op if bots were already injected at join time (idempotency guard inside).
        this.injectPracticeBots(lobby);
        this.clearLobbyTimers(lobby.lobbyId);
        this.onGameStart?.(lobby);
        this.lobbies.delete(lobby.lobbyId);
        lobby.players.forEach(p => this.playerLobbyMap.delete(p));
      } else if (lobby.mode === 'tournament' && lobby.players.length === 1 && Date.now() >= deadline) {
        // Solo player after deadline → issue refund
        const soloPlayer = lobby.players[0];
        console.log(`[LOBBY] Solo player ${soloPlayer} in lobby ${lobby.lobbyId} after deadline - issuing refund`);
        
        // Trigger refund callback - pass 0, actual amount will be calculated by index.ts using expectedLamportsByPlayerId
        this.onLobbyRefund?.(lobby, soloPlayer, 0);
        
        // Clean up lobby
        this.clearLobbyTimers(lobby.lobbyId);
        this.lobbies.delete(lobby.lobbyId);
        this.playerLobbyMap.delete(soloPlayer);
        
        console.log(`[LOBBY] ✅ Solo player refund initiated for ${soloPlayer}`);
      } else {
        // Revert to waiting if not enough players
        lobby.status = 'waiting';
        this.onLobbyUpdate?.(lobby);
        // Retry countdown attempt in a few seconds until deadline reached
        const now = Date.now();
        const maxWaitMs = this.lobbyDeadlineMs.get(lobby.lobbyId) || (now + LOBBY_MAX_WAIT_SEC * 1000);
        if (now < maxWaitMs) {
          this.clearLobbyTimers(lobby.lobbyId);
          setTimeout(() => this.startLobbyCountdown(lobby), 5000);
        }
      }
    }, timeoutDuration) as unknown as NodeJS.Timeout;
    try { this.lobbyStartTimeout.set(lobby.lobbyId, startTimeout); } catch {}
  }

  private clearLobbyTimers(lobbyId: string): void {
    try {
      const t = this.lobbyCountdownTick.get(lobbyId);
      if (t) { clearInterval(t); this.lobbyCountdownTick.delete(lobbyId); }
    } catch {}
    try {
      const s = this.lobbyStartTimeout.get(lobbyId);
      if (s) { clearTimeout(s); this.lobbyStartTimeout.delete(lobbyId); }
    } catch {}
    this.lobbyStartAtMs.delete(lobbyId);
    this.lobbyCountdownStartMs.delete(lobbyId);
  }

  private injectPracticeBots(lobby: Lobby): void {
    try {
      console.log(`[PRACTICE-BOT] injectPracticeBots called for lobby ${lobby.lobbyId}:`);
      console.log(`[PRACTICE-BOT] - ENABLE_PRACTICE_BOTS=${process.env.ENABLE_PRACTICE_BOTS}`);
      console.log(`[PRACTICE-BOT] - PRACTICE_BOTS_TARGET=${process.env.PRACTICE_BOTS_TARGET}`);
      console.log(`[PRACTICE-BOT] - lobby.mode=${lobby.mode}`);
      console.log(`[PRACTICE-BOT] - Current players: ${lobby.players.length}`);

      if (lobby.mode !== 'practice') return;
      if (!isPracticeBotsEnabled()) {
        console.log(`[PRACTICE-BOT] ❌ Practice bot injection disabled`);
        return;
      }
      const target = getPracticeBotsTarget(lobby.maxPlayers);
      console.log(`[PRACTICE-BOT] ✅ Practice bots enabled, target: ${target}`);
      if (target <= 0) return;
      if (lobby.players.length >= target) return;

      const before = lobby.players.length;
      while (lobby.players.length < target) {
        const botId = `BOT_${Math.random().toString(36).slice(2, 10)}`;
        lobby.players.push(botId);
      }
      const added = lobby.players.length - before;
      console.log(`[PRACTICE-BOT] ✅ Injected ${added} practice bots`);
      if (added > 0) this.onLobbyUpdate?.(lobby);
    } catch (err) {
      console.error('[PRACTICE-BOT] injectPracticeBots failed:', err);
    }
  }

  /**
   * Injects development bots into the lobby to reach a target player count quickly.
   * Enabled only when ENABLE_DEV_BOTS=true (never on production).
   */
  private injectDevBots(lobby: Lobby): void {
    console.log(`[BOT] injectDevBots called for lobby ${lobby.lobbyId}:`);
    console.log(`[BOT] - ENABLE_DEV_BOTS=${process.env.ENABLE_DEV_BOTS}`);
    console.log(`[BOT] - DEV_BOTS_TARGET=${process.env.DEV_BOTS_TARGET}`);
    console.log(`[BOT] - Current players: ${lobby.players.length}`);
    
    if (process.env.ENABLE_DEV_BOTS !== 'true') {
      console.log(`[BOT] ❌ Bot injection disabled (ENABLE_DEV_BOTS != 'true')`);
      return;
    }

    // In dev skip-fee mode, allow opting into exact-match lobbies (no bots)
    const isDevLike = (process.env.NODE_ENV || '').toLowerCase() !== 'production';
    const skipFee = (process.env.SKIP_ENTRY_FEE || '').toLowerCase() === 'true';
    const matchReal = (process.env.DEV_MATCH_REAL_PLAYERS || 'true').toLowerCase() === 'true';
    if (isDevLike && skipFee && matchReal) {
      console.log(`[BOT] 🔧 Dev match-real-players mode → not injecting bots (players=${lobby.players.length})`);
      return;
    }

    const target = Math.max(1, Math.min(lobby.maxPlayers, parseInt(process.env.DEV_BOTS_TARGET || '8', 10)));
    console.log(`[BOT] - Calculated target: ${target}`);
    
    if (lobby.players.length >= target) {
      console.log(`[BOT] ❌ Already at target player count (${lobby.players.length}/${target})`);
      return;
    }

    const before = lobby.players.length;
    while (lobby.players.length < target) {
      const botId = `BOT_${Math.random().toString(36).slice(2, 10)}`;
      lobby.players.push(botId);
      console.log(`[BOT] + Added bot: ${botId}`);
      // Do not add bots to playerLobbyMap to avoid socket-related cleanup needs
    }
    const added = lobby.players.length - before;
    if (added > 0) {
      console.log(`🤖 Injected ${added} dev bots into lobby ${lobby.lobbyId} (target=${target})`);
    }
    this.onLobbyUpdate?.(lobby);
  }
}
