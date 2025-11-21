import { GameState, PlayerInput, EntryFeeTier, Player, GameItem } from 'shared';
import { PlayerEntity } from './Player.js';
import { BotController } from './BotController.js';
import { CollisionSystem } from './CollisionSystem.js';
import { SmartContractService } from './SmartContractService.js';
import { WORLD as S_WORLD, TICK as S_TICK, COLLISION as S_COLLISION, PHYSICS as S_PHYSICS } from 'shared/dist/constants.js';
import { v4 as uuidv4 } from 'uuid';

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Constants
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=

const TICK_RATE = S_TICK.RATE;
const TICK_INTERVAL = S_TICK.INTERVAL_MS;
const WORLD_WIDTH = S_WORLD.WIDTH; // SYNCED WITH CLIENT gameConstants.ts
const WORLD_HEIGHT = S_WORLD.HEIGHT; // SYNCED WITH CLIENT gameConstants.ts
const ARENA_SHRINK_START_S = S_WORLD.ARENA_SHRINK_START_S; // start shrink near mid-game per plan pacing
const ARENA_SHRINK_DURATION_S = S_WORLD.ARENA_SHRINK_DURATION_S; // shrink over 90s to 50%
const PHYSICS_CONSTANTS = { ...S_PHYSICS } as const;

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
  private gameLoop: NodeJS.Timeout | null = null;
  private accumulatorMs: number = 0;
  private lastUpdateAtMs: number = 0;
  private currentLobby: { entryFee: EntryFeeTier, players: string[] } | null = null;
  private players: Map<string, PlayerEntity> = new Map();
  private bots: Map<string, BotController> = new Map();
  private roundStartedAtMs: number | null = null;
  private shrinkFactor: number = 1; // 1..0.5
  private lastDevAliveLogMs: number = 0;
  private items: Map<string, GameItem> = new Map();
  private lastItemSpawnTime: number = 0;
  public onPlayerEliminated: ((playerId: string) => void) | null = null;
  public onRoundEnd: ((winnerId: string, prizeAmountSol: number, payoutSignature?: string) => void) | null = null;

  constructor(smartContractService: SmartContractService) {
    this.collisionSystem = new CollisionSystem(WORLD_WIDTH, WORLD_HEIGHT);
    this.smartContractService = smartContractService;
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

  startRound(players: string[], entryFee: EntryFeeTier): void {
    this.players.clear();
    this.bots.clear();
    this.items.clear();
    this.lastItemSpawnTime = 0;
    this.currentLobby = { players, entryFee };
    players.forEach(playerId => this.spawnPlayer(playerId));
    // Spawn an initial batch of DNA fragments to seed the map
    for (let i = 0; i < 10 && this.items.size < MAX_DNA_ON_MAP; i++) {
      this.spawnDNA();
    }
    this.lastItemSpawnTime = Date.now();
    this.gameState.status = 'in_progress';
    this.syncGameState();
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
    
    // --- Payout Logic ---
    if (this.currentLobby && winnerId !== 'draw') {
      try {
        const { players, entryFee } = this.currentLobby;
        const lamportsPerPlayer = await this.smartContractService.getEntryFeeInLamports(entryFee);
        const totalLamports = lamportsPerPlayer * players.length;
        const winnerPrizeLamports = Math.floor(totalLamports * 0.85);
        const winnerPrizeSol = winnerPrizeLamports / 1_000_000_000;
        // Payout 85% to winner, 15% routed to platform within service
        // Only payout if winnerId appears to be a real wallet (not a bot)
        let txSig: string | undefined = undefined;
        const isBotWinner = typeof winnerId === 'string' && winnerId.startsWith('BOT_');
        if (isBotWinner) {
          console.log('[PAYOUT] Skipping payout: winner is a dev bot');
        } else {
          try {
            const { PublicKey } = await import('@solana/web3.js');
            const winnerPk = new PublicKey(winnerId); // will throw if invalid base58
            txSig = await this.smartContractService.payoutPrizeLamports(winnerPk, winnerPrizeLamports, 1500);
          } catch (e) {
            console.warn('[PAYOUT] Skipping payout (invalid winner pubkey or configuration error):', e);
          }
        }
        this.onRoundEnd?.(winnerId, winnerPrizeSol, txSig);
      } catch (error) {
        console.error('❌ Payout failed:', error);
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
      this.endRound(alivePlayers[0].id);
    } else if (this.players.size > 0 && alivePlayers.length === 0) {
      // Handle case where all players are eliminated simultaneously (draw)
      if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
        try { console.debug('[DEV][WIN] draw → all eliminated'); } catch {}
      }
      this.endRound('draw');
    }

    // 4. Shrinking arena logic
    if (this.roundStartedAtMs) {
      const elapsedS = (Date.now() - this.roundStartedAtMs) / 1000;
      if (elapsedS > ARENA_SHRINK_START_S) {
        const t = Math.min(1, (elapsedS - ARENA_SHRINK_START_S) / ARENA_SHRINK_DURATION_S);
        this.shrinkFactor = 1 - 0.5 * t; // shrink to 50%
        const newW = Math.max(800, Math.floor(WORLD_WIDTH * this.shrinkFactor));
        const newH = Math.max(600, Math.floor(WORLD_HEIGHT * this.shrinkFactor));
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
    const x = margin + Math.random() * Math.max(0, width - margin * 2);
    const y = margin + Math.random() * Math.max(0, height - margin * 2);
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
    // Spawn farther apart by sampling until a minimum distance from existing spawns
    const MIN_SPAWN_DIST = 1100; // increased for ultrafast speeds
    const WALL_MARGIN = 240; // keep away from walls to avoid instant bounces
    let spawnPosition: { x: number; y: number } = { x: 0, y: 0 };
    for (let tries = 0; tries < 40; tries++) {
      const cand = { x: WALL_MARGIN + Math.random() * (WORLD_WIDTH - 2 * WALL_MARGIN), y: WALL_MARGIN + Math.random() * (WORLD_HEIGHT - 2 * WALL_MARGIN) };
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

  private syncGameState(): void {
    const newPlayersState: Record<string, Player> = {};
    this.players.forEach((player, id) => {
      newPlayersState[id] = {
        id: player.id,
        sperm: player.sperm,
        trail: player.trail,
        isAlive: player.isAlive,
        input: player.input,
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
