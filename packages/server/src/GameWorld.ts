import { GameState, PlayerInput, EntryFeeTier, Player, GameItem, GameMode } from 'shared';
import { PlayerEntity } from './Player.js';
import { BotController } from './BotController.js';
import { CollisionSystem } from './CollisionSystem.js';
import { SmartContractService } from './SmartContractService.js';
import type { DatabaseService } from './DatabaseService.js';
import { WORLD as S_WORLD, TICK as S_TICK, COLLISION as S_COLLISION, PHYSICS as S_PHYSICS } from 'shared/dist/constants.js';
import { v4 as uuidv4 } from 'uuid';

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Constants
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

const TICK_RATE = S_TICK.RATE;
const TICK_INTERVAL = S_TICK.INTERVAL_MS;
const WORLD_WIDTH = S_WORLD.WIDTH; // SYNCED WITH CLIENT gameConstants.ts
const WORLD_HEIGHT = S_WORLD.HEIGHT; // SYNCED WITH CLIENT gameConstants.ts
const ARENA_SHRINK_START_S = S_WORLD.ARENA_SHRINK_START_S;
const ARENA_SHRINK_DURATION_S = S_WORLD.ARENA_SHRINK_DURATION_S;
const PHYSICS_CONSTANTS = { ...S_PHYSICS } as const;

function pickRoundWorldSize(playerCount: number, mode?: GameMode): { width: number; height: number } {
  if (!Number.isFinite(playerCount) || playerCount <= 0) return { width: WORLD_WIDTH, height: WORLD_HEIGHT };
  // Practice is about fast encounters; keep the arena tighter even for 32 players.
  if (mode === 'practice') {
    if (playerCount <= 4) return { width: 1500, height: 1000 };
    if (playerCount <= 8) return { width: 1900, height: 1300 };
    if (playerCount <= 12) return { width: 2300, height: 1600 };
    if (playerCount <= 20) return { width: 2600, height: 1800 };
    if (playerCount <= 32) return { width: 2600, height: 1800 };
    return { width: 3200, height: 2300 };
  }
  // Smaller matches need faster encounters; large lobbies keep the classic arena.
  if (playerCount <= 4) return { width: 1600, height: 1100 };
  if (playerCount <= 8) return { width: 2000, height: 1400 };
  if (playerCount <= 12) return { width: 2400, height: 1700 };
  if (playerCount <= 20) return { width: 3000, height: 2100 };
  return { width: WORLD_WIDTH, height: WORLD_HEIGHT };
}

function pickEggOpenDelayMs(playerCount: number, mode?: GameMode): number {
  if (!Number.isFinite(playerCount) || playerCount <= 0) return 18000;
  if (mode === 'tournament') {
    if (playerCount <= 8) return 13000;
    if (playerCount <= 16) return 16000;
    if (playerCount <= 32) return 18000;
    return 20000;
  }
  if (playerCount <= 4) return 9000;
  if (playerCount <= 8) return 12000;
  if (playerCount <= 12) return 15000;
  if (playerCount <= 20) return 18000;
  return 22000;
}

function parseNumberEnv(name: string): number | null {
  const raw = process.env[name];
  if (!raw || !String(raw).trim()) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Apex Predator DNA fragment settings
const MAX_DNA_ON_MAP = 20;
const DNA_RESPAWN_RATE_MS = 2000;
const DNA_WALL_MARGIN = 200;
const SPERM_COLLISION_RADIUS = S_COLLISION.SPERM_COLLISION_RADIUS;
const DNA_ITEM_RADIUS = 10;
const DNA_PICKUP_RADIUS = SPERM_COLLISION_RADIUS + DNA_ITEM_RADIUS;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// GameWorld Class
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

export class GameWorld {
  public gameState: GameState;
  private collisionSystem: CollisionSystem;
  private smartContractService: SmartContractService;
  private db: DatabaseService | null = null;
  private gameLoop: NodeJS.Timeout | null = null;
  private accumulatorMs: number = 0;
  private lastUpdateAtMs: number = 0;
  private currentLobby: { entryFee: EntryFeeTier, players: string[]; mode: GameMode } | null = null;
  private players: Map<string, PlayerEntity> = new Map();
  private bots: Map<string, BotController> = new Map();
  private disconnectedAtByPlayerId: Map<string, number> = new Map();
  private roundStartedAtMs: number | null = null;
  private shrinkFactor: number = 1; // 1..0.5
  private baseWorldWidth: number = WORLD_WIDTH;
  private baseWorldHeight: number = WORLD_HEIGHT;
  private lastDevAliveLogMs: number = 0;
  private items: Map<string, GameItem> = new Map();
  private lastItemSpawnTime: number = 0;
  private arenaShrinkStartS: number = ARENA_SHRINK_START_S;
  private arenaShrinkDurationS: number = ARENA_SHRINK_DURATION_S;
  public onPlayerEliminated: ((playerId: string) => void) | null = null;
  public onRoundEnd: ((winnerId: string, prizeAmountSol: number, payoutSignature?: string) => void) | null = null;
  public onAuditEvent: ((type: string, payload?: any) => void) | null = null;
  private lastWinReason: 'last_alive' | 'extraction' | 'draw' | null = null;

  constructor(smartContractService: SmartContractService, db?: DatabaseService) {
    this.collisionSystem = new CollisionSystem(WORLD_WIDTH, WORLD_HEIGHT);
    this.smartContractService = smartContractService;
    this.db = db || null;
    this.gameState = this.createInitialGameState();
  }

  private createInitialGameState(): GameState {
    return {
      roundId: uuidv4(),
      status: 'waiting',
      players: {},
      world: {
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
      },
      items: {},
    };
  }

  start(): void {
    if (this.gameLoop) return;
    this.lastUpdateAtMs = Date.now();
    // Drive the accumulator at ~60Hz; simulate at exact TICK_INTERVAL steps
    this.gameLoop = setInterval(() => {
      const now = Date.now();
      let dt = now - this.lastUpdateAtMs;
      this.lastUpdateAtMs = now;
      // clamp dt to avoid huge catch-up on hiccups
      if (dt > 100) dt = 100;
      if (dt < 0) dt = 0;
      this.accumulatorMs += dt;
      while (this.accumulatorMs >= TICK_INTERVAL) {
        this.update();
        this.accumulatorMs -= TICK_INTERVAL;
      }
    }, 16);
  }

  stop(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
  }

  startRound(players: string[], entryFee: EntryFeeTier, mode: GameMode = 'practice'): void {
    this.players.clear();
    this.bots.clear();
    this.disconnectedAtByPlayerId.clear();
    this.items.clear();
    this.lastItemSpawnTime = 0;
    this.currentLobby = { players, entryFee, mode };

    // Reset arena sizing for this round based on expected player count.
    const roundSize = pickRoundWorldSize(players.length, mode);
    this.baseWorldWidth = roundSize.width;
    this.baseWorldHeight = roundSize.height;
    this.shrinkFactor = 1;
    // Mode-aware shrink pacing (can be overridden via env vars)
    if (mode === 'tournament') {
      this.arenaShrinkStartS = Math.max(0, parseNumberEnv('ARENA_SHRINK_START_S_TOURNAMENT') ?? parseNumberEnv('ARENA_SHRINK_START_S') ?? 12);
      this.arenaShrinkDurationS = Math.max(5, parseNumberEnv('ARENA_SHRINK_DURATION_S_TOURNAMENT') ?? parseNumberEnv('ARENA_SHRINK_DURATION_S') ?? 45);
    } else {
      this.arenaShrinkStartS = Math.max(0, parseNumberEnv('ARENA_SHRINK_START_S_PRACTICE') ?? parseNumberEnv('ARENA_SHRINK_START_S') ?? 8);
      this.arenaShrinkDurationS = Math.max(5, parseNumberEnv('ARENA_SHRINK_DURATION_S_PRACTICE') ?? parseNumberEnv('ARENA_SHRINK_DURATION_S') ?? 30);
    }
    this.collisionSystem.setWorldBounds(this.baseWorldWidth, this.baseWorldHeight);
    this.gameState.world.width = this.baseWorldWidth;
    this.gameState.world.height = this.baseWorldHeight;

    // Pure battle royale: last alive wins (no extraction objective).
    delete (this.gameState as any).objective;

    // Spawn players with a deterministic "face-off" layout so they see each other immediately.
    this.spawnInitialPlayers(players, mode);
    // Spawn an initial batch of DNA fragments to seed the map
    for (let i = 0; i < 10 && this.items.size < MAX_DNA_ON_MAP; i++) {
      this.spawnDNA();
    }
    this.lastItemSpawnTime = Date.now();
    this.gameState.status = 'in_progress';
    this.syncGameState();
    this.lastWinReason = null;
    try {
      this.onAuditEvent?.('round_start', {
        roundId: this.gameState.roundId,
        entryFee,
        mode,
        players,
        world: { ...this.gameState.world },
      });
    } catch { }
    console.log(`🏁 Fertilization race started with ${players.length} spermatozoa. Entry fee: ${entryFee} USD.`);
    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
      try {
        const masked = players.map(p => p.startsWith('BOT_') ? p : `${p.slice(0,6)}…${p.slice(-4)}`);
        console.debug(`[DEV][ROUND_START] players (${players.length}):`, masked);
      } catch {}
    }
    this.roundStartedAtMs = Date.now();
  }

  private async endRound(winnerId: string): Promise<void> {
    this.gameState.status = 'finished';
    this.gameState.winnerId = winnerId;
    console.log(`Round ended. Winner: ${winnerId}`);
    try {
      this.onAuditEvent?.('round_end', {
        roundId: this.gameState.roundId,
        winnerId,
        reason: this.lastWinReason,
      });
    } catch { }
    
    // --- Payout Logic ---
    if (this.currentLobby && winnerId !== 'draw') {
      try {
        const roundId = this.gameState.roundId;
        const { players, entryFee, mode } = this.currentLobby;
        const isMoneyMatch = mode === 'tournament' && Number(entryFee) > 0;
        const platformFeeBps = 1500;

        // Only attempt on-chain payouts for real money matches.
        if (!isMoneyMatch) {
          this.onRoundEnd?.(winnerId, 0, undefined);
          return;
        }

        const lamportsPerPlayer = await this.smartContractService.getEntryFeeInLamports(entryFee);
        const totalLamports = Math.max(0, lamportsPerPlayer * players.length);
        const winnerPrizeLamports = Math.max(0, Math.floor(totalLamports * 0.85));
        const winnerPrizeSol = winnerPrizeLamports / 1_000_000_000;
        if (winnerPrizeLamports <= 0) {
          try { this.onAuditEvent?.('payout_skipped', { roundId, winnerId, reason: 'no_prize' }); } catch { }
          this.onRoundEnd?.(winnerId, 0, undefined);
          return;
        }

        // Idempotency: if we already paid this round, never pay again.
        try {
          const existing = this.db?.getPayoutByRoundId(roundId) || null;
          if (existing && existing.status === 'sent' && existing.tx_signature) {
            try { this.onAuditEvent?.('payout_skipped', { roundId, winnerId, reason: 'already_sent', txSig: existing.tx_signature }); } catch { }
            this.onRoundEnd?.(winnerId, winnerPrizeSol, existing.tx_signature);
            return;
          }
        } catch { }

        try {
          this.onAuditEvent?.('payout_planned', {
            roundId,
            winnerId,
            entryFee,
            mode,
            players,
            lamportsPerPlayer,
            totalLamports,
            winnerPrizeLamports,
            platformFeeBps,
          });
        } catch { }

        try {
          this.db?.recordPayoutPlanned({
            roundId,
            winnerWallet: winnerId,
            prizeLamports: winnerPrizeLamports,
            platformFeeBps,
          });
        } catch { }
        // Payout 85% to winner, 15% routed to platform within service
        // Only payout if winnerId appears to be a real wallet (not a bot)
        let txSig: string | undefined = undefined;
        const isBotWinner = typeof winnerId === 'string' && (winnerId.startsWith('BOT_') || winnerId.startsWith('Guest_') || winnerId.startsWith('PLAYER_'));
        if (isBotWinner) {
          console.log('[PAYOUT] Skipping payout: winner is a dev bot');
          try { this.onAuditEvent?.('payout_skipped', { roundId, winnerId, reason: 'bot_winner' }); } catch { }
          try { this.db?.recordPayoutSkipped(roundId, 'bot_winner'); } catch { }
        } else {
          try {
            const { PublicKey } = await import('@solana/web3.js');
            const winnerPk = new PublicKey(winnerId); // will throw if invalid base58
            txSig = await this.smartContractService.payoutPrizeLamports(winnerPk, winnerPrizeLamports, platformFeeBps);
            try { this.onAuditEvent?.('payout_sent', { roundId, winnerId, winnerPrizeLamports, txSig }); } catch { }
            try { if (txSig) this.db?.recordPayoutSent(roundId, txSig); } catch { }
          } catch (e) {
            console.warn('[PAYOUT] Skipping payout (invalid winner pubkey or configuration error):', e);
            const err = String((e as any)?.message || e);
            try { this.onAuditEvent?.('payout_failed', { roundId, winnerId, error: err }); } catch { }
            try { this.db?.recordPayoutFailed(roundId, err); } catch { }
          }
        }
        this.onRoundEnd?.(winnerId, winnerPrizeSol, txSig);
      } catch (error) {
        console.error('❌ Payout failed:', error);
        const err = String((error as any)?.message || error);
        try { this.onAuditEvent?.('payout_failed', { roundId: this.gameState.roundId, winnerId, error: err }); } catch { }
        try { this.db?.recordPayoutFailed(this.gameState.roundId, err); } catch { }
      }
    }
    
    this.currentLobby = null;

    // Start a new round after a delay
    setTimeout(() => {
      this.gameState = this.createInitialGameState();
      this.players.clear();
    }, 5000); // 5-second delay
  }
  
  private update(): void {
    if (this.gameState.status !== 'in_progress') return;

    const deltaTime = TICK_INTERVAL / 1000; // in seconds

    const playersArray = Array.from(this.players.values());

    // -1. Drive bot AI before physics so inputs are ready for the tick
    if (this.bots.size > 0) {
      const itemsArray = Array.from(this.items.values());
      const worldWidth = this.gameState.world.width || WORLD_WIDTH;
      const worldHeight = this.gameState.world.height || WORLD_HEIGHT;
      this.bots.forEach(bot => {
        try {
          bot.update(deltaTime, {
            items: itemsArray,
            players: playersArray,
            worldWidth,
            worldHeight,
          });
        } catch (e) {
          try { console.warn('[BOT] update error for', bot.id, e); } catch {}
        }
      });
    }

    // 0. Schooling (flocking buff) - compute per-player speed multipliers before physics
    const count = playersArray.length;
    const SCHOOL_RADIUS = 300;
    const SCHOOL_RADIUS_SQ = SCHOOL_RADIUS * SCHOOL_RADIUS;
    const ANGLE_THRESHOLD = 0.5; // radians
    const neighborCounts: number[] = new Array(count).fill(0);

    for (let i = 0; i < count; i++) {
      const p1 = playersArray[i];
      if (!p1.isAlive) continue;
      const pos1 = p1.sperm.position;
      const angle1 = p1.sperm.angle;
      for (let j = i + 1; j < count; j++) {
        const p2 = playersArray[j];
        if (!p2.isAlive) continue;
        const pos2 = p2.sperm.position;
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > SCHOOL_RADIUS_SQ) continue;
        const angle2 = p2.sperm.angle;
        const rawDiff = angle1 - angle2;
        const angleDiff = Math.abs(Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff)));
        if (angleDiff < ANGLE_THRESHOLD) {
          neighborCounts[i]++;
          neighborCounts[j]++;
        }
      }
    }

    for (let i = 0; i < count; i++) {
      const p = playersArray[i];
      const neighbors = neighborCounts[i];
      const bonusSteps = Math.min(neighbors, 4); // max +20%
      const multiplier = 1 + bonusSteps * 0.05;
      p.setSpeedMultiplier(multiplier);
    }

    // 1. Update all players (pass shrink factor for trail lifetime logic)
    this.players.forEach(player => {
      player.update(deltaTime, this.shrinkFactor);
      player.cleanExpiredTrails();
    });

    // 1.5. Resolve player-vs-player collisions (bump/bounce logic)
    this.collisionSystem.checkPlayerCollisions(this.players);

    // 2. Detect collisions (walls & trails)
    const eliminated = this.collisionSystem.update(this.players);
    eliminated.forEach(({ victimId, killerId, debug }) => {
      if (this.players.has(victimId)) {
        if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
          try { console.debug(`[DEV][ELIM] victim=${victimId.startsWith('BOT_')?victimId:`${victimId.slice(0,6)}…${victimId.slice(-4)}`} killer=${killerId? (killerId.startsWith('BOT_')?killerId:`${killerId.slice(0,6)}…${killerId.slice(-4)}`) : 'arena/self/trail'}`); } catch {}
        }
        this.players.get(victimId)!.eliminate();
        try {
          // Broadcast through handler that can include eliminatorId
          const idx = (this as any).onPlayerEliminatedExt;
          if (typeof idx === 'function') idx(victimId, killerId, debug);
          else this.onPlayerEliminated?.(victimId);
        } catch {
          this.onPlayerEliminated?.(victimId);
        }
      }
    });

    // 3. Check for a winner
    const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
    if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
      const now = Date.now();
      if (now - this.lastDevAliveLogMs > 1000) {
        try { console.debug(`[DEV][ALIVE] ${alivePlayers.length}/${this.players.size}`); } catch {}
        this.lastDevAliveLogMs = now;
      }
    }
    if (this.players.size > 1 && alivePlayers.length === 1) {
      if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
        try {
          const id = alivePlayers[0].id;
          console.debug(`[DEV][WIN] single survivor → ${id.startsWith('BOT_')?id:`${id.slice(0,6)}…${id.slice(-4)}`}`);
        } catch {}
      }
      this.lastWinReason = 'last_alive';
      this.endRound(alivePlayers[0].id);
    } else if (this.players.size > 0 && alivePlayers.length === 0) {
      // Handle case where all players are eliminated simultaneously (draw)
      if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
        try { console.debug('[DEV][WIN] draw → all eliminated'); } catch {}
      }
      this.lastWinReason = 'draw';
      this.endRound('draw');
    }

    // 4. Shrinking arena logic
    if (this.roundStartedAtMs) {
      const elapsedS = (Date.now() - this.roundStartedAtMs) / 1000;
      if (elapsedS > this.arenaShrinkStartS) {
        const t = Math.min(1, (elapsedS - this.arenaShrinkStartS) / this.arenaShrinkDurationS);
        this.shrinkFactor = 1 - 0.5 * t; // shrink to 50%
        const newW = Math.max(800, Math.floor(this.baseWorldWidth * this.shrinkFactor));
        const newH = Math.max(600, Math.floor(this.baseWorldHeight * this.shrinkFactor));
        this.collisionSystem.setWorldBounds(newW, newH);
        this.gameState.world.width = newW;
        this.gameState.world.height = newH;
      }
    }

    // 5. Apex Predator DNA spawning (server-authoritative)
    const nowMs = Date.now();
    if (nowMs - this.lastItemSpawnTime >= DNA_RESPAWN_RATE_MS && this.items.size < MAX_DNA_ON_MAP) {
      this.spawnDNA();
      this.lastItemSpawnTime = nowMs;
    }

    // 6. DNA pickup detection
    if (this.items.size > 0) {
      const pickupRadiusSq = DNA_PICKUP_RADIUS * DNA_PICKUP_RADIUS;
      this.players.forEach(player => {
        if (!player.isAlive) return;
        const px = player.sperm.position.x;
        const py = player.sperm.position.y;
        for (const [id, item] of this.items) {
          const dx = px - item.x;
          const dy = py - item.y;
          if ((dx * dx + dy * dy) <= pickupRadiusSq) {
            player.absorbDNA();
            this.items.delete(id);
            break;
          }
        }
      });
    }

    // 7. Sync game state for broadcasting
    this.syncGameState();
  }

  addPlayer(playerId: string): void {
    if (this.players.has(playerId)) return;
    this.spawnPlayer(playerId);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
     this.bots.delete(playerId);
    this.disconnectedAtByPlayerId.delete(playerId);
    this.syncGameState();
  }

  handlePlayerDisconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p) return;
    this.disconnectedAtByPlayerId.set(playerId, Date.now());
    try {
      // Stop applying thrust/boost while disconnected; player remains vulnerable in-world.
      p.setInput({ target: { x: p.sperm.position.x, y: p.sperm.position.y }, accelerate: false, boost: false });
    } catch { }
  }

  handlePlayerReconnect(playerId: string): void {
    this.disconnectedAtByPlayerId.delete(playerId);
  }

  eliminateForDisconnect(playerId: string): void {
    const p = this.players.get(playerId);
    if (!p || !p.isAlive) return;
    try { p.eliminate(); } catch { return; }
    try {
      const idx = (this as any).onPlayerEliminatedExt;
      if (typeof idx === 'function') idx(playerId, undefined, { reason: 'disconnect' });
      else this.onPlayerEliminated?.(playerId);
    } catch {
      this.onPlayerEliminated?.(playerId);
    }
    try { this.onAuditEvent?.('player_disconnect_elim', { roundId: this.gameState.roundId, playerId }); } catch { }
    this.syncGameState();
  }

  handlePlayerInput(playerId: string, input: PlayerInput): void {
    const player = this.players.get(playerId);
    if (player && player.isAlive) {
      // Sanity-check pointer target: ignore obviously invalid coordinates that would break physics.
      const sanitized: PlayerInput = {
        target: { ...input.target },
        accelerate: !!input.accelerate,
        boost: !!input.boost,
        drift: !!(input as any).drift,
      };

      const worldWidth = this.gameState.world.width || WORLD_WIDTH;
      const worldHeight = this.gameState.world.height || WORLD_HEIGHT;
      const maxDelta = Math.max(worldWidth, worldHeight) * 4; // generous bound for mouse movement
      const dx = sanitized.target.x - player.sperm.position.x;
      const dy = sanitized.target.y - player.sperm.position.y;
      const dist = Math.hypot(dx, dy);
      if (!Number.isFinite(dist) || dist > maxDelta) {
        // Ignore impossible target - keep aiming roughly forward from current angle
        const forwardX = Math.cos(player.sperm.angle);
        const forwardY = Math.sin(player.sperm.angle);
        const safeLen = PHYSICS_CONSTANTS.MAX_SPEED * 1.5;
        sanitized.target.x = player.sperm.position.x + forwardX * safeLen;
        sanitized.target.y = player.sperm.position.y + forwardY * safeLen;
      }

      player.setInput(sanitized);
      const boost = (input as any)?.boost as boolean | undefined;
      if (boost) player.tryActivateBoost();
    }
  }

  /** Spawn a single DNA fragment somewhere within the current world bounds. */
  private spawnDNA(): void {
    if (this.items.size >= MAX_DNA_ON_MAP) return;

    const width = this.gameState.world.width || WORLD_WIDTH;
    const height = this.gameState.world.height || WORLD_HEIGHT;
    const margin = DNA_WALL_MARGIN;
    // Bias spawns toward the middle to create natural meeting points.
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.max(0, Math.min(width, height) * 0.42);
    const theta = Math.random() * Math.PI * 2;
    const r = maxR * Math.pow(Math.random(), 0.65); // more density near center
    const rawX = cx + Math.cos(theta) * r;
    const rawY = cy + Math.sin(theta) * r;
    const x = Math.max(margin, Math.min(width - margin, rawX));
    const y = Math.max(margin, Math.min(height - margin, rawY));
    const id = uuidv4();

    const item: GameItem = {
      id,
      type: 'dna',
      x,
      y,
    };

    this.items.set(id, item);
  }

  private spawnPlayer(playerId: string): void {
    const width = this.gameState.world.width || this.baseWorldWidth || WORLD_WIDTH;
    const height = this.gameState.world.height || this.baseWorldHeight || WORLD_HEIGHT;

    // Smaller matches should start closer for faster encounters.
    const spawnPopulation = this.currentLobby?.players.length ?? (this.players.size + 1);
    const lobbyMode: GameMode = this.currentLobby?.mode || 'practice';
    const spawnMode: 'cluster' | 'mid' | 'spread' =
      lobbyMode === 'practice'
        ? (spawnPopulation <= 32 ? 'cluster' : 'mid')
        : (spawnPopulation <= 8 ? 'cluster' : spawnPopulation <= 16 ? 'mid' : 'spread');

    const minDim = Math.min(width, height);
    const WALL_MARGIN = Math.min(240, Math.max(120, Math.floor(minDim * 0.08))); // keep away from walls
    const requestedMinSpawnDist = spawnMode === 'cluster' ? 420 : spawnMode === 'mid' ? 750 : 1100;
    const maxInside = Math.max(200, Math.floor(minDim - 2 * WALL_MARGIN));
    const MIN_SPAWN_DIST = Math.min(requestedMinSpawnDist, Math.floor(maxInside * 0.75));

    const center = { x: width / 2, y: height / 2 };
    const clusterRadius =
      spawnMode === 'cluster'
        ? Math.max(320, Math.floor(minDim * 0.20))
        : Math.max(520, Math.floor(minDim * 0.38));

    const sampleCandidate = (): { x: number; y: number } => {
      if (spawnMode === 'spread') {
        return {
          x: WALL_MARGIN + Math.random() * (width - 2 * WALL_MARGIN),
          y: WALL_MARGIN + Math.random() * (height - 2 * WALL_MARGIN),
        };
      }
      const theta = Math.random() * Math.PI * 2;
      const r = clusterRadius * Math.sqrt(Math.random());
      const x = center.x + Math.cos(theta) * r;
      const y = center.y + Math.sin(theta) * r;
      return {
        x: Math.max(WALL_MARGIN, Math.min(width - WALL_MARGIN, x)),
        y: Math.max(WALL_MARGIN, Math.min(height - WALL_MARGIN, y)),
      };
    };

    let spawnPosition: { x: number; y: number } = { x: 0, y: 0 };
    for (let tries = 0; tries < 60; tries++) {
      const cand = sampleCandidate();
      let ok = true;
      for (const p of this.players.values()) {
        const dx = cand.x - p.sperm.position.x;
        const dy = cand.y - p.sperm.position.y;
        if ((dx * dx + dy * dy) < MIN_SPAWN_DIST * MIN_SPAWN_DIST) { ok = false; break; }
      }
      if (ok) { spawnPosition = cand; break; }
      spawnPosition = cand; // fallback to last candidate
    }
    const player = new PlayerEntity(playerId, spawnPosition);
    this.players.set(playerId, player);

    // Wrap bots with AI controllers (identified by BOT_ prefix)
    if (typeof playerId === 'string' && playerId.startsWith('BOT_')) {
      this.bots.set(playerId, new BotController(player));
    }
  }

  private spawnInitialPlayers(playerIds: string[], mode: GameMode): void {
    const width = this.gameState.world.width || this.baseWorldWidth || WORLD_WIDTH;
    const height = this.gameState.world.height || this.baseWorldHeight || WORLD_HEIGHT;
    const minDim = Math.min(width, height);
    const wallMargin = Math.min(240, Math.max(120, Math.floor(minDim * 0.08)));
    const center = { x: width / 2, y: height / 2 };
    const insideMaxR = Math.max(180, Math.floor(minDim / 2 - wallMargin));

    const n = Array.isArray(playerIds) ? playerIds.length : 0;
    if (n <= 0) return;

    // Ring count scales with lobby size so spacing stays sane even in compact practice arenas.
    const ringCount = n <= 12 ? 1 : n <= 24 ? 2 : 3;
    const baseRadii =
      ringCount === 1
        ? [Math.floor(insideMaxR * 0.42)]
        : ringCount === 2
          ? [Math.floor(insideMaxR * 0.30), Math.floor(insideMaxR * 0.55)]
          : [Math.floor(insideMaxR * 0.24), Math.floor(insideMaxR * 0.44), Math.floor(insideMaxR * 0.64)];

    const radii = baseRadii.map(r => Math.max(220, Math.min(insideMaxR, r)));
    const rotation = Math.random() * Math.PI * 2;

    // Distribute player ids across rings (outer rings slightly larger capacity).
    const ringBuckets: string[][] = Array.from({ length: ringCount }, () => []);
    for (let i = 0; i < n; i++) {
      const ringIdx = ringCount === 1 ? 0 : ringCount === 2 ? (i % 2) : (i % 3);
      ringBuckets[ringIdx].push(playerIds[i]);
    }

    for (let rIdx = 0; rIdx < ringBuckets.length; rIdx++) {
      const ids = ringBuckets[rIdx];
      if (!ids.length) continue;
      const r = radii[Math.min(rIdx, radii.length - 1)];
      const step = (Math.PI * 2) / ids.length;
      const ringRot = rotation + (rIdx * step * 0.5);

      for (let j = 0; j < ids.length; j++) {
        const theta = ringRot + j * step;
        const x = Math.max(wallMargin, Math.min(width - wallMargin, center.x + Math.cos(theta) * r));
        const y = Math.max(wallMargin, Math.min(height - wallMargin, center.y + Math.sin(theta) * r));
        const angleTowardCenter = Math.atan2(center.y - y, center.x - x);

        const player = new PlayerEntity(ids[j], { x, y }, angleTowardCenter);
        this.players.set(ids[j], player);

        if (typeof ids[j] === 'string' && ids[j].startsWith('BOT_')) {
          this.bots.set(ids[j], new BotController(player));
        }
      }
    }
  }

  private syncGameState(): void {
    const newPlayersState: Record<string, Player> = {};
    this.players.forEach((player, id) => {
      newPlayersState[id] = {
        id: player.id,
        sperm: player.sperm,
        trail: player.trail,
        isAlive: player.isAlive,
        input: player.input,
        status: player.status,
      };
    });
    this.gameState.players = newPlayersState;

    const itemsState: Record<string, GameItem> = {};
    this.items.forEach((item, id) => {
      itemsState[id] = item;
    });
    this.gameState.items = itemsState;
  }
}
