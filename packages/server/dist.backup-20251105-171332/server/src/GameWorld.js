import { PlayerEntity } from './Player.js';
import { CollisionSystem } from './CollisionSystem.js';
import { WORLD as S_WORLD, TICK as S_TICK } from 'shared/dist/constants.js';
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
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// GameWorld Class
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
export class GameWorld {
    gameState;
    collisionSystem;
    smartContractService;
    gameLoop = null;
    accumulatorMs = 0;
    lastUpdateAtMs = 0;
    currentLobby = null;
    players = new Map();
    roundStartedAtMs = null;
    shrinkFactor = 1; // 1..0.5
    lastDevAliveLogMs = 0;
    onPlayerEliminated = null;
    onRoundEnd = null;
    constructor(smartContractService) {
        this.collisionSystem = new CollisionSystem(WORLD_WIDTH, WORLD_HEIGHT);
        this.smartContractService = smartContractService;
        this.gameState = this.createInitialGameState();
    }
    createInitialGameState() {
        return {
            roundId: uuidv4(),
            status: 'waiting',
            players: {},
            world: {
                width: WORLD_WIDTH,
                height: WORLD_HEIGHT,
            },
        };
    }
    start() {
        if (this.gameLoop)
            return;
        this.lastUpdateAtMs = Date.now();
        // Drive the accumulator at ~60Hz; simulate at exact TICK_INTERVAL steps
        this.gameLoop = setInterval(() => {
            const now = Date.now();
            let dt = now - this.lastUpdateAtMs;
            this.lastUpdateAtMs = now;
            // clamp dt to avoid huge catch-up on hiccups
            if (dt > 100)
                dt = 100;
            if (dt < 0)
                dt = 0;
            this.accumulatorMs += dt;
            while (this.accumulatorMs >= TICK_INTERVAL) {
                this.update();
                this.accumulatorMs -= TICK_INTERVAL;
            }
        }, 16);
    }
    stop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }
    startRound(players, entryFee) {
        this.players.clear();
        this.currentLobby = { players, entryFee };
        players.forEach(playerId => this.spawnPlayer(playerId));
        this.gameState.status = 'in_progress';
        this.syncGameState();
        console.log(`🏁 Fertilization race started with ${players.length} spermatozoa. Entry fee: ${entryFee} USD.`);
        if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
            try {
                const masked = players.map(p => p.startsWith('BOT_') ? p : `${p.slice(0, 6)}…${p.slice(-4)}`);
                console.debug(`[DEV][ROUND_START] players (${players.length}):`, masked);
            }
            catch { }
        }
        this.roundStartedAtMs = Date.now();
    }
    async endRound(winnerId) {
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
                let txSig = undefined;
                const isBotWinner = typeof winnerId === 'string' && winnerId.startsWith('BOT_');
                if (isBotWinner) {
                    console.log('[PAYOUT] Skipping payout: winner is a dev bot');
                }
                else {
                    try {
                        const { PublicKey } = await import('@solana/web3.js');
                        const winnerPk = new PublicKey(winnerId); // will throw if invalid base58
                        txSig = await this.smartContractService.payoutPrizeLamports(winnerPk, winnerPrizeLamports, 1500);
                    }
                    catch (e) {
                        console.warn('[PAYOUT] Skipping payout (invalid winner pubkey or configuration error):', e);
                    }
                }
                this.onRoundEnd?.(winnerId, winnerPrizeSol, txSig);
            }
            catch (error) {
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
    update() {
        if (this.gameState.status !== 'in_progress')
            return;
        const deltaTime = TICK_INTERVAL / 1000; // in seconds
        // 1. Update all players (pass shrink factor for trail lifetime logic)
        this.players.forEach(player => {
            player.update(deltaTime, this.shrinkFactor);
            player.cleanExpiredTrails();
        });
        // 2. Detect collisions
        const eliminated = this.collisionSystem.update(this.players);
        eliminated.forEach(({ victimId, killerId, debug }) => {
            if (this.players.has(victimId)) {
                if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
                    try {
                        console.debug(`[DEV][ELIM] victim=${victimId.startsWith('BOT_') ? victimId : `${victimId.slice(0, 6)}…${victimId.slice(-4)}`} killer=${killerId ? (killerId.startsWith('BOT_') ? killerId : `${killerId.slice(0, 6)}…${killerId.slice(-4)}`) : 'arena/self/trail'}`);
                    }
                    catch { }
                }
                this.players.get(victimId).eliminate();
                try {
                    // Broadcast through handler that can include eliminatorId
                    const idx = this.onPlayerEliminatedExt;
                    if (typeof idx === 'function')
                        idx(victimId, killerId, debug);
                    else
                        this.onPlayerEliminated?.(victimId);
                }
                catch {
                    this.onPlayerEliminated?.(victimId);
                }
            }
        });
        // 3. Check for a winner
        const alivePlayers = Array.from(this.players.values()).filter(p => p.isAlive);
        if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
            const now = Date.now();
            if (now - this.lastDevAliveLogMs > 1000) {
                try {
                    console.debug(`[DEV][ALIVE] ${alivePlayers.length}/${this.players.size}`);
                }
                catch { }
                this.lastDevAliveLogMs = now;
            }
        }
        if (this.players.size > 1 && alivePlayers.length === 1) {
            if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
                try {
                    const id = alivePlayers[0].id;
                    console.debug(`[DEV][WIN] single survivor → ${id.startsWith('BOT_') ? id : `${id.slice(0, 6)}…${id.slice(-4)}`}`);
                }
                catch { }
            }
            this.endRound(alivePlayers[0].id);
        }
        else if (this.players.size > 0 && alivePlayers.length === 0) {
            // Handle case where all players are eliminated simultaneously (draw)
            if ((process.env.NODE_ENV || '').toLowerCase() !== 'production') {
                try {
                    console.debug('[DEV][WIN] draw → all eliminated');
                }
                catch { }
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
        // 5. Sync game state for broadcasting
        this.syncGameState();
    }
    addPlayer(playerId) {
        if (this.players.has(playerId))
            return;
        this.spawnPlayer(playerId);
    }
    removePlayer(playerId) {
        this.players.delete(playerId);
        this.syncGameState();
    }
    handlePlayerInput(playerId, input) {
        const player = this.players.get(playerId);
        if (player && player.isAlive) {
            player.setInput(input);
            const boost = input?.boost;
            if (boost)
                player.tryActivateBoost();
        }
    }
    spawnPlayer(playerId) {
        // Spawn farther apart by sampling until a minimum distance from existing spawns
        const MIN_SPAWN_DIST = 1100; // increased for ultrafast speeds
        const WALL_MARGIN = 240; // keep away from walls to avoid instant bounces
        let spawnPosition = { x: 0, y: 0 };
        for (let tries = 0; tries < 40; tries++) {
            const cand = { x: WALL_MARGIN + Math.random() * (WORLD_WIDTH - 2 * WALL_MARGIN), y: WALL_MARGIN + Math.random() * (WORLD_HEIGHT - 2 * WALL_MARGIN) };
            let ok = true;
            for (const p of this.players.values()) {
                const dx = cand.x - p.sperm.position.x;
                const dy = cand.y - p.sperm.position.y;
                if ((dx * dx + dy * dy) < MIN_SPAWN_DIST * MIN_SPAWN_DIST) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                spawnPosition = cand;
                break;
            }
            spawnPosition = cand; // fallback to last candidate
        }
        const player = new PlayerEntity(playerId, spawnPosition);
        this.players.set(playerId, player);
    }
    syncGameState() {
        const newPlayersState = {};
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
    }
}
