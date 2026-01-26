import 'dotenv/config.js';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { randomUUID, createHash } from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { GameWorld } from './GameWorld.js';
import { LobbyManager } from './LobbyManager.js';
import { AuthService } from './AuthService.js';
import { SmartContractService } from './SmartContractService.js';
import { DatabaseService } from './DatabaseService.js';
import { AuditLogger } from './AuditLogger.js';
import { ClientToServerMessage, ServerToClientMessage, GameStateUpdateMessage, LobbyStateMessage, Lobby, AuthenticatedMessage } from 'shared';
import { clientToServerMessageSchema } from 'shared/dist/schemas.js';
import { v4 as uuidv4 } from 'uuid';

// =================================================================================================
// Constants
// =================================================================================================

const PORT = parseInt(process.env.PORT || '8080', 10);
const BROADCAST_INTERVAL = 1000 / 15; // 15 FPS to reduce bandwidth (25% reduction from 20 FPS)
const NONCE_TTL_MS = parseInt(process.env.SIWS_NONCE_TTL_MS || '60000', 10);
const AUTH_GRACE_MS = parseInt(process.env.AUTH_GRACE_MS || '60000', 10);
const UNAUTH_MAX = parseInt(process.env.WS_UNAUTH_MAX || '3', 10);
const IS_PRODUCTION = (process.env.NODE_ENV || '').toLowerCase() === 'production';
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase() as 'silent' | 'error' | 'warn' | 'info' | 'debug';
const BACKPRESSURE_MAX_BUFFERED = parseInt(process.env.BACKPRESSURE_MAX_BUFFERED || '1048576', 10); // 1MB
const SLOW_CONSUMER_STRIKES_MAX = parseInt(process.env.SLOW_CONSUMER_STRIKES_MAX || '5', 10);
const RATE_VIOLATION_STRIKES_MAX = parseInt(process.env.RATE_VIOLATION_STRIKES_MAX || '8', 10);
const LEVELS: Record<'silent' | 'error' | 'warn' | 'info' | 'debug', number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
function shouldLog(level: keyof typeof LEVELS): boolean { return LEVELS[LOG_LEVEL] >= LEVELS[level]; }
const log = {
  debug: (...args: any[]) => { if (shouldLog('debug')) console.log(...args); },
  info: (...args: any[]) => { if (shouldLog('info')) console.log(...args); },
  warn: (...args: any[]) => { if (shouldLog('warn')) console.warn(...args); },
  error: (...args: any[]) => { if (shouldLog('error')) console.error(...args); },
};
function maskPk(pk: string | null | undefined): string { return pk ? (pk.length > 10 ? `${pk.slice(0, 6)}…${pk.slice(-4)}` : pk) : String(pk); }
// Rate limits (token bucket)
const RATE_LIMITS = {
  auth: { capacity: 3, refillPerMs: 3 / 60000 }, // 3/min
  join: { capacity: 10, refillPerMs: 10 / 60000 }, // 10/min
  tx: { capacity: 20, refillPerMs: 20 / 60000 }, // 20/min
  input: { capacity: 60, refillPerMs: 60 / 1000 } // 60/sec hard cap on playerInput
} as const;

// =================================================================================================
// Server Setup
// =================================================================================================

// Enforce production safety flags (no bots, no skip-fee)
if (IS_PRODUCTION) {
  if (process.env.SKIP_ENTRY_FEE === 'true') {
    console.error('[FATAL] SKIP_ENTRY_FEE must be false in production');
    process.exit(1);
  }
  if (process.env.ENABLE_DEV_BOTS === 'true') {
    console.error('[FATAL] ENABLE_DEV_BOTS must be false in production');
    process.exit(1);
  }
}

// Single HTTP server hosting both API and WebSocket (path /ws)
const app = express();
const server = http.createServer(app);
const WS_PERMESSAGE_DEFLATE = (process.env.WS_PERMESSAGE_DEFLATE || (IS_PRODUCTION ? '1' : '1')).toLowerCase();
const enableWsDeflate = WS_PERMESSAGE_DEFLATE === '1' || WS_PERMESSAGE_DEFLATE === 'true' || WS_PERMESSAGE_DEFLATE === 'yes';
const wss = new WebSocketServer({
  server,
  path: '/ws',
  perMessageDeflate: enableWsDeflate ? { threshold: 512 } : false
});

const smartContractService = new SmartContractService();
const lobbyManager = new LobbyManager(smartContractService);

// Database for leaderboards and player stats
const DB_PATH = process.env.DB_PATH || './packages/server/data/spermrace.db';
const db = new DatabaseService(DB_PATH);
log.info(`[DB] Using database: ${DB_PATH}`);
const BUILD_SHA = (process.env.GIT_SHA || process.env.COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || '').toString() || undefined;
const AUDIT_DIR = process.env.AUDIT_DIR || './packages/server/data/audit';
const audit = new AuditLogger({ dir: AUDIT_DIR, build: BUILD_SHA });
const pendingSockets = new Set<WebSocket>();
const playerIdToSocket = new Map<string, WebSocket>();
const socketToPlayerId = new Map<WebSocket, string>();
const playerIdToName = new Map<string, string>();
const socketToNonce = new Map<WebSocket, { nonce: string; issuedAt: number; consumed: boolean }>();
const socketToSessionId = new Map<WebSocket, string>();
const socketToAuthTimeout = new Map<WebSocket, NodeJS.Timeout>();
const socketUnauthViolations = new Map<WebSocket, number>();
type BucketState = { tokens: number; lastRefill: number };
const socketRate: Map<WebSocket, Record<keyof typeof RATE_LIMITS, BucketState>> = new Map();
const socketRateViolations = new Map<WebSocket, number>();
const socketSlowStrikes = new Map<WebSocket, number>();
const socketPendingState = new Map<WebSocket, { state?: string; trail?: string }>(); // coalesced latest game payloads
const socketCaps = new Map<WebSocket, { trailDelta?: boolean }>();
const paidPlayers = new Set<string>();
const expectedLamportsByPlayerId = new Map<string, number>();
const expectedTierByPlayerId = new Map<string, import('shared').EntryFeeTier>();
const pendingPaymentByPlayerId = new Map<string, { paymentId: string; createdAt: number; lamports: number; tier: import('shared').EntryFeeTier }>();
const usedPaymentIds = new Set<string>();

// Session tokens for HTTP-based authentication (mobile-friendly)
const sessionTokens = new Map<string, { playerId: string; createdAt: number }>();
const SESSION_TOKEN_TTL_MS = 300000; // 5 minutes

// Guest resume (practice): lets mobile reconnect without losing the match.
const guestSessions = new Map<string, { resumeToken: string; name: string; updatedAt: number }>();
const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cleanupGuestSessions(now = Date.now()): void {
  try {
    for (const [guestId, s] of guestSessions.entries()) {
      if (!s || (now - s.updatedAt) > GUEST_SESSION_TTL_MS) guestSessions.delete(guestId);
    }
  } catch { }
}

function sanitizeGuestName(name: string | undefined): string {
  return (name || 'Guest').trim().slice(0, 20).replace(/[^a-zA-Z0-9 ]/g, '') || 'Guest';
}

function getGuestSession(requestedId: string | undefined, resumeToken: string | undefined, cleanName: string): { guestId: string; resumeToken: string } {
  const now = Date.now();
  cleanupGuestSessions(now);
  try {
    const rid = (requestedId || '').trim();
    const tok = (resumeToken || '').trim();
    if (rid && tok) {
      const existing = guestSessions.get(rid);
      if (existing && existing.resumeToken === tok) {
        existing.updatedAt = now;
        existing.name = cleanName || existing.name || 'Guest';
        guestSessions.set(rid, existing);
        return { guestId: rid, resumeToken: existing.resumeToken };
      }
    }
  } catch { }

  const guestId = `guest-${uuidv4()}`;
  const newToken = randomUUID();
  guestSessions.set(guestId, { resumeToken: newToken, name: cleanName || 'Guest', updatedAt: now });
  return { guestId, resumeToken: newToken };
}

// Match resume: keep players in-round for a short grace window.
const reconnectTimersByPlayerId = new Map<string, NodeJS.Timeout>();
function getReconnectGraceMs(mode: import('shared').GameMode): number {
  const key = mode === 'tournament' ? 'MATCH_RECONNECT_GRACE_MS_TOURNAMENT' : 'MATCH_RECONNECT_GRACE_MS_PRACTICE';
  const raw = process.env[key] || process.env.MATCH_RECONNECT_GRACE_MS || '';
  const n = parseInt(String(raw || '').trim() || (mode === 'tournament' ? '10000' : '20000'), 10);
  if (!Number.isFinite(n) || n < 0) return mode === 'tournament' ? 10000 : 20000;
  return Math.min(60000, n);
}

function clearReconnectTimer(playerId: string): void {
  try {
    const t = reconnectTimersByPlayerId.get(playerId);
    if (t) clearTimeout(t);
  } catch { }
  reconnectTimersByPlayerId.delete(playerId);
}

function sendLobbyStateToPlayer(ws: WebSocket, lobby: Lobby): void {
  try {
    const playerNamesMap: Record<string, string> = {};
    lobby.players.forEach((pid) => {
      playerNamesMap[pid] = playerIdToName.get(pid)
        || (pid.startsWith('BOT_') ? 'Bot' : pid.startsWith('guest-') ? 'Guest' : pid.slice(0, 4) + '…' + pid.slice(-4));
    });
    const message: LobbyStateMessage = { type: 'lobbyState', payload: { ...lobby, playerNames: playerNamesMap } as any };
    safeSend(ws, JSON.stringify(message as any), 'generic');
  } catch { }
}

function syncPlayerAfterAuth(playerId: string, ws: WebSocket): void {
  try {
    clearReconnectTimer(playerId);
  } catch { }
  try {
    const match = getMatchForPlayer(playerId);
    if (match) {
      try { (match.gameWorld as any).handlePlayerReconnect?.(playerId); } catch { }
      // gameStateUpdate broadcasts will pick this socket up automatically
      return;
    }
  } catch { }
  try {
    const lobby = lobbyManager.getLobbyForPlayer(playerId);
    if (lobby) sendLobbyStateToPlayer(ws, lobby);
  } catch { }
}

// =================================================================================================
// Anti-abuse telemetry (hashed; no raw IP stored)
// =================================================================================================

const ABUSE_TELEMETRY = (process.env.ABUSE_TELEMETRY || '1').toLowerCase() !== '0';
const ABUSE_SALT = (process.env.ABUSE_SALT || '').toString();
const ABUSE_LOG_FULL_IP_HASH = (process.env.ABUSE_LOG_FULL_IP_HASH || '0').toLowerCase() === '1';
if (ABUSE_TELEMETRY && IS_PRODUCTION && !ABUSE_SALT) {
  log.warn('[ABUSE] ABUSE_SALT is not set; hashes are unsalted (set ABUSE_SALT for stronger anti-collusion signals).');
}

type ConnMeta = { ipHash?: string; ipPrefixHash?: string; uaHash?: string };
const socketToConnMeta = new Map<WebSocket, ConnMeta>();
const playerIdToConnMeta = new Map<string, ConnMeta>();

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
function hashWithSalt(value: string): string {
  const base = ABUSE_SALT ? `${ABUSE_SALT}|${value}` : value;
  return sha256Hex(base);
}
function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const s = String(ip).trim();
  if (!s) return null;
  if (s.startsWith('::ffff:')) return s.slice('::ffff:'.length);
  return s;
}
function ipPrefix(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return parts.slice(0, 4).join(':') + '::/64';
  }
  return ip;
}
function getClientIp(req: any): string | null {
  try {
    const xff = req?.headers?.['x-forwarded-for'];
    const first = Array.isArray(xff) ? xff[0] : (typeof xff === 'string' ? xff.split(',')[0] : null);
    return normalizeIp(first || req?.socket?.remoteAddress || null);
  } catch {
    return null;
  }
}
function getUserAgent(req: any): string | null {
  try {
    const ua = req?.headers?.['user-agent'];
    if (!ua) return null;
    return String(ua).slice(0, 256);
  } catch {
    return null;
  }
}

type Match = {
  matchId: string;
  lobbyId: string;
  entryFee: import('shared').EntryFeeTier;
  mode: import('shared').GameMode;
  entrants: string[];
  gameWorld: GameWorld;
  startedAtMs: number;
  cleanupTimer?: NodeJS.Timeout;
  lastTrailCreatedAtByPlayerId: Map<string, number>;
};
const matchesById = new Map<string, Match>();
const playerToMatchId = new Map<string, string>();

function getMatchForPlayer(playerId: string): Match | null {
  const matchId = playerToMatchId.get(playerId);
  if (!matchId) return null;
  return matchesById.get(matchId) || null;
}

function broadcastToPlayers(playerIds: string[], message: ServerToClientMessage): void {
  const messageString = JSON.stringify(message);
  for (const playerId of playerIds) {
    const ws = playerIdToSocket.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      safeSend(ws, messageString, 'generic');
    }
  }
}

function removeMatch(matchId: string): void {
  const match = matchesById.get(matchId);
  if (!match) return;
  try { if (match.cleanupTimer) clearTimeout(match.cleanupTimer); } catch { }
  try { match.gameWorld.stop(); } catch { }
  try { audit.log('match_cleanup', { matchId, lobbyId: match.lobbyId, roundId: match.gameWorld.gameState.roundId }); } catch { }
  matchesById.delete(matchId);
  for (const pid of match.entrants) {
    if (playerToMatchId.get(pid) === matchId) playerToMatchId.delete(pid);
    try { clearReconnectTimer(pid); } catch { }
  }
}

function createAndStartMatch(lobby: Lobby): Match {
  const matchId = lobby.lobbyId;
  const existing = matchesById.get(matchId);
  if (existing) return existing;

  const entrants = [...lobby.players];
  const gameWorld = new GameWorld(smartContractService, db);
  const match: Match = {
    matchId,
    lobbyId: lobby.lobbyId,
    entryFee: lobby.entryFee,
    mode: lobby.mode,
    entrants,
    gameWorld,
    startedAtMs: Date.now(),
    lastTrailCreatedAtByPlayerId: new Map(),
  };
  matchesById.set(matchId, match);
  for (const pid of entrants) playerToMatchId.set(pid, matchId);

  // Anti-abuse match telemetry (hashed): detect clustering by IP prefix.
  try {
    if (ABUSE_TELEMETRY) {
      const counts = new Map<string, number>();
      for (const pid of entrants) {
        const meta = playerIdToConnMeta.get(pid);
        if (meta?.ipPrefixHash) counts.set(meta.ipPrefixHash, (counts.get(meta.ipPrefixHash) || 0) + 1);
      }
      let maxSamePrefix = 0;
      for (const c of counts.values()) if (c > maxSamePrefix) maxSamePrefix = c;
      audit.log('match_conn_fingerprint', {
        matchId,
        lobbyId: lobby.lobbyId,
        mode: lobby.mode,
        entrants: entrants.length,
        uniqueIpPrefixHashes: counts.size,
        maxSameIpPrefix: maxSamePrefix,
      });
    }
  } catch { }

  gameWorld.onAuditEvent = (type: string, payload?: any) => {
    try { audit.log(type, { matchId, lobbyId: lobby.lobbyId, mode: lobby.mode, ...(payload || {}) }); } catch { }
  };

  // Per-match eliminations and debug events
  (gameWorld as any).onPlayerEliminatedExt = (victimId: string, killerId?: string, debug?: any) => {
    const message: ServerToClientMessage = { type: 'playerEliminated', payload: { playerId: victimId, eliminatorId: killerId } } as any;
    broadcastToPlayers(match.entrants, message);
    try {
      const allowDebug = (process.env.ENABLE_DEBUG_COLLISIONS || '').toLowerCase() === 'true';
      if (allowDebug && debug && debug.type === 'trail') {
        const dbg: any = { type: 'debugCollision', payload: { victimId, killerId, hit: debug.hit, segment: debug.segment, normal: debug.normal, relSpeed: debug.relSpeed, ts: Date.now() } };
        broadcastToPlayers(match.entrants, dbg);
      }
    } catch { }
  };

  gameWorld.onRoundEnd = (winnerId, prizeAmount, txSignature) => {
    const message: ServerToClientMessage = { type: 'roundEnd', payload: { winnerId, prizeAmount, txSignature } } as any;
    broadcastToPlayers(match.entrants, message);

    // Record game result in database (async, fire-and-forget)
    try {
      if (prizeAmount > 0) {
        const prizeLamports = Math.floor(prizeAmount * 1_000_000_000);
        const killsMap: Record<string, number> = {};
        for (const wallet of match.entrants) killsMap[wallet] = 0;
        db.recordGameResult(winnerId, prizeLamports, match.entrants.length, killsMap);
        log.info(`[DB] Recorded game result for ${match.entrants.length} players`);
      }
    } catch (error) {
      log.error('[DB] Failed to record game result:', error);
    }

    // Cleanup match after a short delay (let clients display results)
    try {
      if (!match.cleanupTimer) {
        match.cleanupTimer = setTimeout(() => removeMatch(matchId), 8000);
      }
    } catch { }
  };

  gameWorld.startRound(entrants, lobby.entryFee, lobby.mode as any);
  gameWorld.start();
  try { audit.log('match_world_started', { matchId, lobbyId: lobby.lobbyId, entrants, entryFee: lobby.entryFee, mode: lobby.mode }); } catch { }
  return match;
}

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://spermrace.io,https://www.spermrace.io,https://sperm-race-io.vercel.app,http://localhost:5174')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

log.info(`🚀 SpermRace.io server starting on http://localhost:${PORT} (WS path /ws)`);
log.info(`[ENV] SOLANA_RPC_ENDPOINT=${process.env.SOLANA_RPC_ENDPOINT || 'default'} ENABLE_DEV_BOTS=${process.env.ENABLE_DEV_BOTS} DEV_BOTS_TARGET=${process.env.DEV_BOTS_TARGET} SKIP_ENTRY_FEE=${process.env.SKIP_ENTRY_FEE}`);
log.info(`[SEC] ALLOWED_ORIGINS=${ALLOWED_ORIGINS.join(' | ')}`);

// Production safety: forbid example/localhost origins in prod
if (IS_PRODUCTION) {
  const hasLocal = ALLOWED_ORIGINS.some(o => /localhost|127\.0\.0\.1/i.test(o));
  const looksExample = ALLOWED_ORIGINS.some(o => /yourdomain|your-frontend-domain/i.test(o));
  if (hasLocal || looksExample || ALLOWED_ORIGINS.length === 0) {
    console.error('[FATAL] ALLOWED_ORIGINS must be set to real production domains (no localhost, no example values).');
    process.exit(1);
  }
}

// =================================================================================================
// Lightweight HTTP API (price proxy)
// =================================================================================================

// Attach middleware to the unified app
app.set('trust proxy', 1);
// Correlation IDs and optional JSON request logging
app.use((req: any, res: any, next: any) => {
  const incoming = (req.headers['x-request-id'] as string) || undefined;
  const requestId = incoming || randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  if ((process.env.LOG_JSON || '').toLowerCase() === 'true') {
    const started = Date.now();
    res.on('finish', () => {
      try {
        const entry = {
          level: 'info',
          ts: Date.now(),
          requestId,
          method: req.method,
          url: req.originalUrl || req.url,
          status: res.statusCode,
          durationMs: Date.now() - started,
          ip: req.ip,
        };
        console.log(JSON.stringify(entry));
      } catch { }
    });
  }
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https:', 'wss:', ...ALLOWED_ORIGINS],
    },
  },
} as any));
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Do not throw here: it spams server logs with stack traces for random/bot origins.
    // Returning `false` blocks the browser from reading responses and keeps logs clean.
    return cb(null, false);
  },
  credentials: true,
};
app.use(cors(corsOptions));
// Global baseline limiter
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
// Route-specific stricter limiters
const limiterSensitive = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
const limiterAnalytics = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use(express.json({ limit: '256kb' }));

let cachedPrice: { usd: number | null; ts: number } = { usd: null, ts: 0 };
app.get('/api/sol-price', limiterSensitive, async (_req, res) => {
  const now = Date.now();
  try {
    if (cachedPrice.usd && (now - cachedPrice.ts) < 30_000) {
      res.json({ usd: cachedPrice.usd, ts: cachedPrice.ts, source: 'cache' });
      return;
    }

    const sources: Array<{ name: string; url: string; pick: (j: any) => number | null }> = [
      { name: 'jupiter', url: 'https://price.jup.ag/v6/price?ids=SOL', pick: j => Number(j?.data?.SOL?.price) || null },
      { name: 'coingecko', url: 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', pick: j => Number(j?.solana?.usd) || null },
    ];

    let lastErr: any = null;
    for (const s of sources) {
      try {
        const r = await fetch(s.url);
        if (!r.ok) { lastErr = new Error(`${s.name} ${r.status}`); continue; }
        const j = await r.json();
        const usd = s.pick(j);
        if (usd && Number.isFinite(usd)) {
          cachedPrice = { usd, ts: now };
          res.json({ usd, ts: now, source: s.name });
          return;
        }
        lastErr = new Error(`${s.name} invalid payload`);
      } catch (e) { lastErr = e; }
    }

    // Fallback to stale cache (up to 10 min) instead of failing
    if (cachedPrice.usd && (now - cachedPrice.ts) < 600_000) {
      res.json({ usd: cachedPrice.usd, ts: cachedPrice.ts, source: 'stale-cache' });
      return;
    }

    res.status(502).json({ error: 'Price fetch failed', reason: lastErr?.message || String(lastErr || 'unknown') });
  } catch (e: any) {
    res.status(502).json({ error: 'Price fetch failed', reason: e?.message || String(e) });
  }
});

// Version/build info
app.get('/api/version', (_req, res) => {
  res.json({
    version: process.env.APP_VERSION || '0.0.0',
    buildId: process.env.APP_BUILD_ID || null,
    buildTime: process.env.APP_BUILD_TIME || null,
    env: (process.env.NODE_ENV || 'development'),
  });
});

// Health and readiness endpoints
app.get('/api/healthz', (_req, res) => {
  try {
    res.json({ ok: true, port: PORT, now: Date.now() });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// WebSocket health (alive count and avg latency)
app.get('/api/ws-healthz', (_req, res) => {
  try {
    const total = wss.clients.size;
    let alive = 0;
    const latencies: number[] = [];
    wsHeartbeat.forEach((hb, ws) => {
      if ((ws as any).isAlive) alive++;
      if (typeof hb.latencyMs === 'number' && hb.latencyMs > 0) latencies.push(hb.latencyMs);
    });
    const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    res.json({ ok: true, total, alive, avgLatencyMs });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.get('/api/readyz', async (_req, res) => {
  const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';
  try {
    const { Connection, PublicKey } = await import('@solana/web3.js');
    const conn = new Connection(rpcEndpoint, 'processed' as any);
    const { blockhash } = await conn.getLatestBlockhash('processed' as any);
    const prize = (process.env.PRIZE_POOL_WALLET || '').trim();
    let prizeBalance: number | null = null;
    if (prize) {
      try { prizeBalance = await conn.getBalance(new PublicKey(prize), { commitment: 'processed' as any }); } catch { }
    }
    res.json({ ok: true, rpc: { ok: !!blockhash, endpoint: rpcEndpoint }, prizePool: { address: prize || null, balance: prizeBalance } });
  } catch (e: any) {
    res.status(503).json({ ok: false, reason: e?.message || String(e) });
  }
});

// Prize pool preflight
app.get('/api/prize-preflight', async (_req, res) => {
  try {
    const addr = smartContractService.getPrizePoolAddressBase58();
    const lamports = await smartContractService.getPrizePoolBalanceLamports();
    // In non-production, always consider preflight configured to enable local tournaments;
    // in production, require a configured payout OR explicit skip flag (should be false in prod).
    const configured = !IS_PRODUCTION || smartContractService.isPayoutConfigured() || process.env.SKIP_ENTRY_FEE === 'true';
    res.json({ address: addr, lamports, sol: lamports >= 0 ? lamports / 1_000_000_000 : null, configured });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// ================================================================================================
// Leaderboard & Player Stats API
// ================================================================================================

// Get top players by wins
app.get('/api/leaderboard/wins', limiterSensitive, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100'), 100);
    const leaderboard = db.getTopWins(limit);
    res.json({ leaderboard, type: 'wins', count: leaderboard.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Get top players by earnings
app.get('/api/leaderboard/earnings', limiterSensitive, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100'), 100);
    const leaderboard = db.getTopEarnings(limit);
    res.json({ leaderboard, type: 'earnings', count: leaderboard.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Get top players by kills
app.get('/api/leaderboard/kills', limiterSensitive, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100'), 100);
    const leaderboard = db.getTopKills(limit);
    res.json({ leaderboard, type: 'kills', count: leaderboard.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Get top players by skill rating
app.get('/api/leaderboard/skill-rating', limiterSensitive, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string || '100'), 100);
    const leaderboard = db.getTopSkillRating(limit);
    res.json({ leaderboard, type: 'skillRating', count: leaderboard.length });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Get player stats by wallet
app.get('/api/player/:wallet/stats', limiterSensitive, (req, res) => {
  try {
    const { wallet } = req.params;
    const stats = db.getPlayerStats(wallet);
    if (!stats) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json({ player: stats });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// Get overall stats
app.get('/api/stats', limiterSensitive, (req, res) => {
  try {
    const stats = db.getTotalStats();
    res.json(stats);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || String(e) });
  }
});

// ================================================================================================
// Metrics (Prometheus text format)
// ================================================================================================
let metrics = {
  ws_connections_total: 0,
  ws_connected_current: 0,
  http_requests_total: 0,
  lobby_active: 0,
};

app.use((_req: Request, _res: Response, next) => { metrics.http_requests_total++; next(); });

app.get('/api/metrics', (_req, res) => {
  const lines: string[] = [];
  lines.push('# TYPE ws_connections_total counter');
  lines.push(`ws_connections_total ${metrics.ws_connections_total}`);
  lines.push('# TYPE ws_connected_current gauge');
  lines.push(`ws_connected_current ${metrics.ws_connected_current}`);
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${metrics.http_requests_total}`);
  lines.push('# TYPE lobby_active gauge');
  lines.push(`lobby_active ${lobbyManager ? (lobbyManager as any).lobbies?.size || 0 : 0}`);
  res.setHeader('Content-Type', 'text/plain');
  res.send(lines.join("\n"));
});

// ================================================================================================
// Analytics ingestion (basic)
// ================================================================================================
app.post('/api/analytics', limiterAnalytics, (req, res) => {
  try {
    const { type, payload } = req.body || {};
    if (!type || typeof type !== 'string') { res.status(400).json({ ok: false }); return; }
    // Redact sensitive fields if any
    const safe = JSON.parse(JSON.stringify(payload || {}));
    if (safe.signedMessage) safe.signedMessage = '[redacted]';
    log.info(`[ANALYTICS] ${type}`, safe);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message || String(e) });
  }
});

// ================================================================================================
// HTTP-based SIWS Authentication (mobile-friendly)
// ================================================================================================
app.post('/api/siws-auth', limiterSensitive, async (req, res) => {
  try {
    const { publicKey, signedMessage, message, nonce } = req.body || {};

    if (!publicKey || !signedMessage || !message) {
      res.status(400).json({ ok: false, error: 'Missing required fields' });
      return;
    }

    // Verify the signature using the original message that was signed
    const isValid = AuthService.verifySignature(publicKey, signedMessage, message);

    if (!isValid) {
      log.warn(`[HTTP AUTH] Invalid signature from ${maskPk(publicKey)}`);
      res.status(401).json({ ok: false, error: 'Invalid signature' });
      return;
    }

    // Clean up expired tokens periodically
    const now = Date.now();
    for (const [token, data] of sessionTokens.entries()) {
      if (now - data.createdAt > SESSION_TOKEN_TTL_MS) {
        sessionTokens.delete(token);
      }
    }

    // Generate session token
    const sessionToken = randomUUID();
    sessionTokens.set(sessionToken, { playerId: publicKey, createdAt: now });

    log.info(`[HTTP AUTH] ✓ Authenticated ${maskPk(publicKey)} → token ${sessionToken.slice(0, 8)}…`);

    res.json({
      ok: true,
      sessionToken,
      expiresIn: SESSION_TOKEN_TTL_MS
    });
  } catch (e: any) {
    log.error('[HTTP AUTH] Error:', e);
    res.status(500).json({ ok: false, error: 'Authentication failed' });
  }
});

// ================================================================================================
// Get SIWS Challenge (for HTTP auth flow)
// ================================================================================================
app.get('/api/siws-challenge', limiterSensitive, (req, res) => {
  try {
    const nonce = AuthService.createNonce();
    const message = AuthService.getMessageToSign(nonce);
    res.json({ ok: true, message, nonce });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// ================================================================================================
// Dev-only payout test endpoint (DEV/DEMO ONLY)
// ================================================================================================
if (!IS_PRODUCTION) {
  app.post('/api/dev/test-payout', async (req, res) => {
    try {
      const { winnerPubkey, lamports, sol, platformFeeBps } = req.body || {};
      if (!winnerPubkey || (!lamports && !sol)) { res.status(400).json({ ok: false, error: 'winnerPubkey and lamports|sol required' }); return; }
      if (!smartContractService.isPayoutConfigured()) { res.status(400).json({ ok: false, error: 'Prize pool key not configured' }); return; }
      const { PublicKey } = await import('@solana/web3.js');
      const to = new PublicKey(winnerPubkey);
      const amountLamports = Number.isFinite(lamports) && lamports > 0 ? Math.floor(lamports) : Math.floor(Number(sol) * 1_000_000_000);
      if (!Number.isFinite(amountLamports) || amountLamports <= 0) { res.status(400).json({ ok: false, error: 'Invalid amount' }); return; }
      const sig = await smartContractService.payoutPrizeLamports(to, amountLamports, typeof platformFeeBps === 'number' ? platformFeeBps : 1500);
      res.json({ ok: true, signature: sig, explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet` });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });
}

server.listen(PORT, () => {
  log.info(`📈 Unified API listening on http://localhost:${PORT}/api/sol-price | WS at /ws`);
});

// =================================================================================================
// Event Handling from LobbyManager
// =================================================================================================

lobbyManager.onLobbyUpdate = (lobby: Lobby) => {
  const playerNamesMap: Record<string, string> = {};
  lobby.players.forEach(pid => {
    playerNamesMap[pid] = playerIdToName.get(pid)
      || (pid.startsWith("BOT_") ? "Bot" : pid.startsWith("guest-") ? "Guest" : pid.slice(0, 4) + "…" + pid.slice(-4));
  });
  const message: LobbyStateMessage = { type: 'lobbyState', payload: { ...lobby, playerNames: playerNamesMap } as any };
  broadcastToLobby(lobby, message);
  try { audit.log('lobby_update', { lobbyId: lobby.lobbyId, mode: lobby.mode, entryFee: lobby.entryFee, status: lobby.status, players: lobby.players }); } catch { }
};

lobbyManager.onGameStart = (lobby: Lobby) => {
  log.info(`📢 Fertilization race starting for lobby ${lobby.lobbyId}`);
  try { audit.log('match_start', { lobbyId: lobby.lobbyId, mode: lobby.mode, entryFee: lobby.entryFee, players: lobby.players }); } catch { }
  // Consume paid tickets for players admitted to this game round
  try {
    lobby.players.forEach(pid => {
      if (paidPlayers.has(pid)) {
        paidPlayers.delete(pid);
        expectedTierByPlayerId.delete(pid);
      }
    });
  } catch { }
  try {
    createAndStartMatch(lobby);
  } catch (e) {
    log.error('[MATCH] Failed to start match world:', e);
    try { audit.log('match_start_failed', { lobbyId: lobby.lobbyId, mode: lobby.mode, entryFee: lobby.entryFee, players: lobby.players, error: String((e as any)?.message || e) }); } catch { }
  }
  const rules = [
    'Contrôles: pointez la souris pour nager',
    'Votre spermatozoïde laisse une trace ~5s',
    'Collision avec une trace = élimination',
    'Dernier survivant = victoire',
    'Tournoi payant: le gagnant reçoit 85% du prize pool'
  ];
  const gameStarting: ServerToClientMessage = { type: 'gameStarting', payload: { countdown: 0, rules } } as any;
  broadcastToLobby(lobby, gameStarting);
};

lobbyManager.onLobbyCountdown = (lobby, remaining, startAtMs) => {
  const msg: ServerToClientMessage = { type: 'lobbyCountdown', payload: { lobbyId: lobby.lobbyId, remaining, startAtMs } } as any;
  broadcastToLobby(lobby, msg);
  try {
    if (remaining === Math.ceil((startAtMs - Date.now()) / 1000) || remaining % 5 === 0 || remaining <= 5) {
      audit.log('lobby_countdown', { lobbyId: lobby.lobbyId, remaining, startAtMs, players: lobby.players.length });
    }
  } catch { }

  // If solo tournament player, show discrete countdown (refund timeline)
  // Timeline: 0-30s = silent waiting, 30-50s = show countdown every second
  if (lobby.mode === 'tournament' && lobby.players.length === 1) {
    // Show countdown for every second in the last 20 seconds
    const shouldWarn = remaining <= 20 && remaining > 0;
    if (shouldWarn) {
      const refundWarning: ServerToClientMessage = {
        type: 'soloPlayerWarning',
        payload: { secondsUntilRefund: remaining }
      } as any;
      broadcastToLobby(lobby, refundWarning);
    }
  }
};

lobbyManager.onLobbyRefund = async (lobby: Lobby, playerId: string, _calculatedLamports: number) => {
  if (playerId.startsWith('Guest_') || playerId.startsWith('PLAYER_')) { console.log(`[REFUND] Skipping refund for guest/local player ${playerId}`); return; }
  // Use ACTUAL amount paid, not recalculated amount
  const actualLamportsPaid = expectedLamportsByPlayerId.get(playerId) || _calculatedLamports;

  // Deduct network fee buffer (5000 lamports = ~$0.001)
  // The original payment had ~5000 lamports deducted for network fee
  // So prize pool has slightly less than what player sent
  const NETWORK_FEE_BUFFER = 5000; // Standard Solana transaction fee
  const refundAmount = Math.max(0, actualLamportsPaid - NETWORK_FEE_BUFFER);

  console.log(`[REFUND] Processing refund for ${playerId}:`);
  console.log(`[REFUND]   - Expected payment: ${actualLamportsPaid} lamports`);
  console.log(`[REFUND]   - Network fee buffer: ${NETWORK_FEE_BUFFER} lamports`);
  console.log(`[REFUND]   - Refund amount: ${refundAmount} lamports`);

  try {
    // Issue refund transaction with network fee deducted
    const txSignature = await smartContractService.refundPlayer(playerId, refundAmount);
    try { audit.log('refund_sent', { lobbyId: lobby.lobbyId, playerId, lamports: refundAmount, txSignature }); } catch { }

    // Clear payment tracking - player needs to pay again if they want to rejoin
    paidPlayers.delete(playerId);
    expectedLamportsByPlayerId.delete(playerId);

    console.log(`[REFUND] Cleared payment cache for ${maskPk(playerId)}`);

    // Notify player
    const socket = playerIdToSocket.get(playerId);
    if (socket) {
      const msg: ServerToClientMessage = {
        type: 'lobbyRefund',
        payload: {
          reason: 'Not enough players joined the tournament (network fee deducted)',
          lamports: refundAmount,
          txSignature
        }
      } as any;
      try { socket.send(JSON.stringify(msg)); } catch (e) { log.error('[REFUND] Failed to send message:', e); }

      // Also send them back to mode selection
      setTimeout(() => {
        const backMsg: ServerToClientMessage = { type: 'lobbyError', payload: { message: 'Lobby cancelled - entry fee refunded' } } as any;
        try { socket.send(JSON.stringify(backMsg)); } catch (e) { log.error('[REFUND] Failed to send back message:', e); }
      }, 2000);
    }

    console.log(`[REFUND] ✅ Refund completed for ${playerId}: ${txSignature}`);
  } catch (error) {
    console.error(`[REFUND] ❌ Failed to refund ${playerId}:`, error);
    try { audit.log('refund_failed', { lobbyId: lobby.lobbyId, playerId, lamports: refundAmount, error: String((error as any)?.message || error) }); } catch { }

    // ✅ FIX #2: Notify player of refund failure with details
    const socket = playerIdToSocket.get(playerId);
    if (socket) {
      let errorMessage = 'Refund failed - please contact support with your wallet address.';

      // Parse common errors
      if (error instanceof Error) {
        if (error.message.includes('insufficient') || error.message.includes('Insufficient')) {
          errorMessage = 'Refund failed: Prize pool balance insufficient. Contact support immediately.';
        } else if (error.message.includes('block height') || error.message.includes('expired')) {
          errorMessage = 'Refund transaction expired. Please refresh and try again.';
        }
      }

      const msg: ServerToClientMessage = {
        type: 'refundFailed',
        payload: {
          message: errorMessage,
          playerId: maskPk(playerId),
          timestamp: Date.now()
        }
      } as any;
      try {
        socket.send(JSON.stringify(msg));
        console.log(`[REFUND] Sent error notification to ${maskPk(playerId)}`);
      } catch (e) {
        log.error('[REFUND] Failed to send error message:', e);
      }
    }
  }
};

// =================================================================================================
// Connection Handling
// =================================================================================================

wss.on('connection', (ws: WebSocket, req: any) => {
  try {
    const origin = (req?.headers?.origin as string | undefined) || '';
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`[SEC] Rejecting WS connection from origin: ${origin}`);
      ws.close(1008, 'Origin not allowed');
      return;
    }
  } catch { }

  // Check for session token in URL query parameter (HTTP auth flow)
  let sessionToken: string | null = null;
  let authenticatedPlayerId: string | null = null;

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    sessionToken = url.searchParams.get('token');

    if (sessionToken) {
      // Clean up expired tokens periodically (cheap; map is small in practice)
      try {
        const now = Date.now();
        for (const [token, data] of sessionTokens.entries()) {
          if (now - data.createdAt > SESSION_TOKEN_TTL_MS) sessionTokens.delete(token);
        }
      } catch { }
      const sessionData = sessionTokens.get(sessionToken);
      if (sessionData && (Date.now() - sessionData.createdAt < SESSION_TOKEN_TTL_MS)) {
        authenticatedPlayerId = sessionData.playerId;
        // Do NOT consume the token (reusable within TTL) so mobile can reconnect without re-signing.
        log.info(`[WS] Client authenticated via HTTP token: ${maskPk(authenticatedPlayerId)}`);
      } else {
        log.warn(`[WS] Invalid or expired session token: ${sessionToken.slice(0, 8)}…`);
        sessionToken = null;
      }
    }
  } catch (e) {
    log.error('[WS] Error parsing session token:', e);
  }

  setupHeartbeat(ws);
  metrics.ws_connections_total++;
  metrics.ws_connected_current = pendingSockets.size + playerIdToSocket.size;

  const sessionId = uuidv4();
  socketToSessionId.set(ws, sessionId);
  try {
    if (ABUSE_TELEMETRY) {
      const ip = getClientIp(req);
      const ua = getUserAgent(req);
      const meta: ConnMeta = {};
      if (ip) {
        if (ABUSE_LOG_FULL_IP_HASH) meta.ipHash = hashWithSalt(ip);
        const pref = ipPrefix(ip);
        if (pref) meta.ipPrefixHash = hashWithSalt(pref);
      }
      if (ua) meta.uaHash = hashWithSalt(ua);
      socketToConnMeta.set(ws, meta);
      audit.log('ws_connect', { sessionId, ipPrefixHash: meta.ipPrefixHash, ...(ABUSE_LOG_FULL_IP_HASH ? { ipHash: meta.ipHash } : {}), uaHash: meta.uaHash });
    }
  } catch { }
  socketRate.set(ws, {
    auth: { tokens: RATE_LIMITS.auth.capacity, lastRefill: Date.now() },
    join: { tokens: RATE_LIMITS.join.capacity, lastRefill: Date.now() },
    tx: { tokens: RATE_LIMITS.tx.capacity, lastRefill: Date.now() },
    input: { tokens: RATE_LIMITS.input.capacity, lastRefill: Date.now() },
  });
  socketCaps.set(ws, { trailDelta: false });

  // If authenticated via HTTP token, skip SIWS challenge
  if (authenticatedPlayerId) {
    try {
      const prev = playerIdToSocket.get(authenticatedPlayerId);
      if (prev && prev !== ws) {
        try { prev.close(4000, 'Reconnected'); } catch { }
      }
    } catch { }
    // Move directly to authenticated state
    playerIdToSocket.set(authenticatedPlayerId, ws);
    socketToPlayerId.set(ws, authenticatedPlayerId);
    (ws as any).authenticated = true;
    try {
      if (ABUSE_TELEMETRY) {
        const meta = socketToConnMeta.get(ws);
        if (meta) playerIdToConnMeta.set(authenticatedPlayerId, meta);
        audit.log('ws_authenticated', { sessionId, playerId: authenticatedPlayerId, ipPrefixHash: meta?.ipPrefixHash, uaHash: meta?.uaHash });
      }
    } catch { }
    const authMessage: AuthenticatedMessage = { type: 'authenticated', payload: { playerId: authenticatedPlayerId } };
    ws.send(JSON.stringify(authMessage));
    log.info(`🔌 Client connected & authenticated via token (${pendingSockets.size + playerIdToSocket.size} total)`);
    syncPlayerAfterAuth(authenticatedPlayerId, ws);
  } else {
    // Traditional WebSocket SIWS flow
    pendingSockets.add(ws); (ws as any).authenticated = false;
    // Enforce authenticate-within timeout
    try {
      const t = setTimeout(() => {
        try {
          if (pendingSockets.has(ws) && !(ws as any).authenticated) {
            ws.close(4001, 'Authentication timeout');
          }
        } catch { }
      }, AUTH_GRACE_MS);
      socketToAuthTimeout.set(ws, t);
    } catch { }

    const nonce = AuthService.createNonce();
    socketToNonce.set(ws, { nonce, issuedAt: Date.now(), consumed: false });
    const challenge = { type: 'siwsChallenge', payload: { message: AuthService.getMessageToSign(nonce), nonce } } as any;
    ws.send(JSON.stringify(challenge));
  }

	  ws.on('message', (data) => {
	    try {
	      const raw = data.toString();
	      log.debug(`[WS=>] Message received: ${raw.length} bytes at ${Date.now()}`);
	      if (raw.length > 64_000) { ws.send(JSON.stringify({ type: 'error', payload: { message: 'Payload too large' } })); return; }
	      const parsed = JSON.parse(raw);
	      log.debug(`[WS=>] Parsed message type: ${parsed?.type || 'unknown'}`);
	      const result = clientToServerMessageSchema.safeParse(parsed);
	      if (!result.success) {
	        log.warn(`[WS=>] Invalid message schema for type ${parsed?.type || 'unknown'}`);
	        log.debug(`[WS=>] Schema errors:`, result.error.errors);
	        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message schema' } }));
	        return;
	      }
	      const message: ClientToServerMessage = result.data as any;

      // Handle guest login specifically
      if (message.type === 'guestLogin') {
        const { guestName, guestId: requestedGuestId, resumeToken: requestedResumeToken } = message.payload as any;
        const cleanName = sanitizeGuestName(guestName);
        const { guestId, resumeToken } = getGuestSession(requestedGuestId, requestedResumeToken, cleanName);

        try {
          const prev = playerIdToSocket.get(guestId);
          if (prev && prev !== ws) {
            try { prev.close(4000, 'Reconnected'); } catch { }
          }
        } catch { }

        // Register as authenticated
        // Clear auth timeout and pending status
        if (socketToAuthTimeout.has(ws)) {
          const t = socketToAuthTimeout.get(ws);
          clearTimeout(t);
          socketToAuthTimeout.delete(ws);
        }
        pendingSockets.delete(ws);
        (ws as any).authenticated = true;
        playerIdToSocket.set(guestId, ws);
        socketToPlayerId.set(ws, guestId);
        try {
          if (ABUSE_TELEMETRY) {
            const meta = socketToConnMeta.get(ws);
            if (meta) playerIdToConnMeta.set(guestId, meta);
            audit.log('ws_authenticated', { sessionId: socketToSessionId.get(ws), playerId: guestId, ipPrefixHash: meta?.ipPrefixHash, uaHash: meta?.uaHash });
          }
        } catch { }
        playerIdToName.set(guestId, cleanName);

        // Send success
        const authMessage: AuthenticatedMessage = { type: 'authenticated', payload: { playerId: guestId, resumeToken } };
        ws.send(JSON.stringify(authMessage));

        log.info(`🔌 Guest connected: ${cleanName} (${guestId})`);
        syncPlayerAfterAuth(guestId, ws);
        return;
      }

      handleClientMessage(message, ws);
    } catch (error) {
      log.error(`❌ Invalid message:`, error);
    }
  });

	  ws.on('close', (code, reason) => {
	    const reasonStr = reason?.toString() || 'no reason';
	    console.log(`🔌 WebSocket closed: code=${code}, reason="${reasonStr}"`);
	    pendingSockets.delete(ws);
	    try { wsHeartbeat.delete(ws); } catch { }
	    try {
	      const t = socketToAuthTimeout.get(ws);
	      if (t) { clearTimeout(t); socketToAuthTimeout.delete(ws); }
	    } catch { }
		    const playerId = socketToPlayerId.get(ws);
		    if (playerId) {
          // If a player refreshes/leaves while in a lobby, remove them immediately so they don't "ghost" a slot.
          // This also ensures they can re-join after refresh (LobbyManager blocks duplicate joins by playerId).
          try { lobbyManager.leaveLobby(playerId); } catch { }
		      playerIdToSocket.delete(playerId);
		      socketToPlayerId.delete(ws);
	        // Match reconnect grace: do not instantly remove/eliminate on mobile drops.
	        const match = getMatchForPlayer(playerId);
	        if (match && !String(playerId).startsWith('BOT_')) {
          try { (match.gameWorld as any).handlePlayerDisconnect?.(playerId); } catch { }
          const graceMs = getReconnectGraceMs(match.mode);
          clearReconnectTimer(playerId);
          if (graceMs <= 0) {
            try { (match.gameWorld as any).eliminateForDisconnect?.(playerId); } catch { }
          } else {
            const t = setTimeout(() => {
              try {
                const m = getMatchForPlayer(playerId);
                if (!m) return;
                try { (m.gameWorld as any).eliminateForDisconnect?.(playerId); } catch { }
              } catch { }
            }, graceMs);
            reconnectTimersByPlayerId.set(playerId, t);
          }
	      }
	    }
	    try {
	      if (ABUSE_TELEMETRY) {
	        const sessionId = socketToSessionId.get(ws);
	        const meta = socketToConnMeta.get(ws);
	        audit.log('ws_disconnect', { sessionId, playerId: playerId || undefined, code, ipPrefixHash: meta?.ipPrefixHash, uaHash: meta?.uaHash });
	      }
	    } catch { }
	    try { socketToConnMeta.delete(ws); } catch { }
	    try { if (playerId) playerIdToConnMeta.delete(playerId); } catch { }
	    socketToNonce.delete(ws);
	    socketToSessionId.delete(ws);
	    socketRate.delete(ws);
    socketUnauthViolations.delete(ws);
    socketCaps.delete(ws);

    // Clean up pending payment state on disconnect
    const disconnectedPlayerId = socketToPlayerId.get(ws) || playerId;
    if (disconnectedPlayerId) {
      const hadPendingPayment = pendingPaymentByPlayerId.has(disconnectedPlayerId);
      if (hadPendingPayment) {
        log.info(`[PAYMENT] 🧹 Clearing pending payment for disconnected player ${maskPk(disconnectedPlayerId)}`);
        pendingPaymentByPlayerId.delete(disconnectedPlayerId);
        expectedLamportsByPlayerId.delete(disconnectedPlayerId);
        expectedTierByPlayerId.delete(disconnectedPlayerId);
      }
    }

    log.info(`🔌 Client disconnected (${pendingSockets.size + playerIdToSocket.size} total)`);
    metrics.ws_connected_current = pendingSockets.size + playerIdToSocket.size;
  });

  ws.on('error', (error) => {
    log.error(`❌ WebSocket error for client:`, error);
    ws.close();
  });

  // If this player reconnects (same wallet), restore lobby state if already paid
  const playerId = socketToPlayerId.get(ws);
  if (playerId) {
    // Note: Pending payments are now cleared on disconnect to avoid stale transaction issues
    // Players must re-initiate payment flow if they disconnect before completing
    if (paidPlayers.has(playerId)) {
      // If already paid, try to restore to lobby if exists
      const lobby = lobbyManager.getLobbyForPlayer(playerId);
      if (lobby) {
        const msg: LobbyStateMessage = { type: 'lobbyState', payload: lobby } as any;
        ws.send(JSON.stringify(msg));
      } else {
        const tier = expectedTierByPlayerId.get(playerId);
        if (tier) {
          lobbyManager.joinLobby(playerId, tier).catch(() => { });
        }
      }
    }
  }
});

// =================================================================================================
// Message Handling
// =================================================================================================

async function handleClientMessage(message: any, ws: WebSocket): Promise<void> {
  // WS auth gate: deny all messages except 'authenticate' until authenticated
  try {
    const t = (message as any)?.type;
    const isAuth = t === 'authenticate';
    const authed = socketToPlayerId.has(ws);
    if (!isAuth && !authed) {
      const v = (socketUnauthViolations.get(ws) || 0) + 1;
      socketUnauthViolations.set(ws, v);
      try { ws.send(JSON.stringify({ type: 'error', payload: { message: 'Authenticate first' } })); } catch { }
      if (v >= UNAUTH_MAX) {
        try { ws.close(4003, 'Too many unauthenticated messages'); } catch { }
      }
      return;
    }
  } catch { }
  function take(name: keyof typeof RATE_LIMITS): boolean {
    const rates = socketRate.get(ws);
    if (!rates) return true;
    const cfg = RATE_LIMITS[name];
    const bucket = rates[name];
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refill = elapsed * cfg.refillPerMs;
    bucket.tokens = Math.min(cfg.capacity, bucket.tokens + refill);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    // strike on rate violation and possibly disconnect
    const strikes = (socketRateViolations.get(ws) || 0) + 1;
    socketRateViolations.set(ws, strikes);
    if (strikes >= RATE_VIOLATION_STRIKES_MAX) {
      try { ws.close(4005, 'Rate limit exceeded'); } catch { }
    }
    return false;
  }

  switch ((message as any).type) {
    case 'clientHello': {
      // Capability negotiation (backward compatible with older clients)
      try {
        const payload = (message as any).payload || {};
        const caps = socketCaps.get(ws) || {};
        caps.trailDelta = !!payload.trailDelta;
        socketCaps.set(ws, caps);
      } catch { }
      break;
    }
    case 'authenticate': {
      if (!take('auth')) { ws.send(JSON.stringify({ type: 'error', payload: { message: 'Rate limited (auth)' } })); return; }
      const { publicKey, signedMessage, nonce } = (message as any).payload as any;
      const nonceRec = socketToNonce.get(ws);
      const expired = !nonceRec || (Date.now() - nonceRec.issuedAt) > NONCE_TTL_MS || nonceRec.consumed;
      const expected = nonceRec?.nonce || '';
      const original = AuthService.getMessageToSign(expected);
      const ok = !expired && expected === nonce && AuthService.verifySignature(publicKey, signedMessage, original);
      if (!ok) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Authentication failed' } }));
        ws.close();
        return;
      }
      if (nonceRec) nonceRec.consumed = true;
      // Promote socket to authenticated mapping
      try {
        const prev = playerIdToSocket.get(publicKey);
        if (prev && prev !== ws) {
          try { prev.close(4000, 'Reconnected'); } catch { }
        }
      } catch { }
	      pendingSockets.delete(ws);
	      (ws as any).authenticated = true; pendingSockets.delete(ws); playerIdToSocket.set(publicKey, ws);
	      socketToPlayerId.set(ws, publicKey);
	      try {
	        if (ABUSE_TELEMETRY) {
	          const meta = socketToConnMeta.get(ws);
	          if (meta) playerIdToConnMeta.set(publicKey, meta);
	          audit.log('ws_authenticated', { sessionId: socketToSessionId.get(ws), playerId: publicKey, ipPrefixHash: meta?.ipPrefixHash, uaHash: meta?.uaHash });
	        }
	      } catch { }
	      playerIdToName.set(publicKey, publicKey.slice(0, 4) + "…" + publicKey.slice(-4));
      // Clear auth timeout and reset violation count
      try {
        const t = socketToAuthTimeout.get(ws);
        if (t) { clearTimeout(t); socketToAuthTimeout.delete(ws); }
      } catch { }
      socketUnauthViolations.delete(ws);
      const authMessage: AuthenticatedMessage = { type: 'authenticated', payload: { playerId: publicKey } };
      ws.send(JSON.stringify(authMessage));
      syncPlayerAfterAuth(publicKey, ws);

      // Reconnect/restore: if there is a pending payment and SKIP_ENTRY_FEE is not enabled, resend it
      const pending = pendingPaymentByPlayerId.get(publicKey);
      if (pending) {
        if (process.env.SKIP_ENTRY_FEE === 'true') {
          // Drop pending in dev skip mode and route to lobby directly
          pendingPaymentByPlayerId.delete(publicKey);
          const tier = expectedTierByPlayerId.get(publicKey);
          if (tier) await lobbyManager.joinLobby(publicKey, tier, 'practice');
        } else if (!paidPlayers.has(publicKey)) {
          (async () => {
            const { lamports, tier, paymentId } = pending;
            const { txBase64, recentBlockhash, prizePool } = await smartContractService.createEntryFeeTransactionBase64((new (await import('@solana/web3.js')).PublicKey(publicKey)), lamports);
            try { audit.log('payment_tx_resend', { playerId: publicKey, tier, lamports, paymentId }); } catch { }
            const entryFeeTxMessage: any = { type: 'entryFeeTx', payload: { txBase64, lamports, recentBlockhash, prizePool, entryFeeTier: tier, paymentId, sessionNonce: socketToNonce.get(ws)?.nonce } };
            ws.send(JSON.stringify(entryFeeTxMessage));
          })().catch(() => { });
        }
      } else if (paidPlayers.has(publicKey)) {
        // If already paid and game in progress with this player, resume immediately
        const match = getMatchForPlayer(publicKey);
        const inProgress = !!match && match.gameWorld.gameState.status === 'in_progress' && !!(match.gameWorld.gameState.players as any)[publicKey];
        if (inProgress) {
          const rules = [
            'Contrôles: pointez la souris pour diriger',
            'Votre voiture laisse une trace ~5s',
            'Collision avec une trace = élimination',
            'Dernier en vie gagne (85% du prize pool en tournoi)'
          ];
          const gameStarting: ServerToClientMessage = { type: 'gameStarting', payload: { countdown: 0, rules } } as any;
          ws.send(JSON.stringify(gameStarting));
          break;
        }
        // If paid but not in a game, requeue into a lobby so they don't lose their ticket
        const tier = expectedTierByPlayerId.get(publicKey) || 1 as any;
        await lobbyManager.joinLobby(publicKey, tier, 'tournament');
      }
      break;
    }
    case 'joinLobby': {
      if (!take('join')) { ws.send(JSON.stringify({ type: 'error', payload: { message: 'Rate limited (join)' } })); return; }
      const playerId = socketToPlayerId.get(ws);
      if (!playerId) return;

      const { entryFeeTier, mode } = (message as any).payload;

      // SECURITY: Guests can only join EntryFeeTier 0
      if (playerId.startsWith('guest-')) {
        if (entryFeeTier !== 0) {
          log.warn(`[SEC] Guest ${playerId} attempted to join paid tier ${entryFeeTier}`);
          ws.send(JSON.stringify({ type: 'error', payload: { message: 'Guests can only play free mode' } }));
          return;
        }
        // Valid guest join - route directly to lobby
        await lobbyManager.joinLobby(playerId, entryFeeTier, mode);
        break;
      }

      // Standard user logic (Payment processing)
      log.info(`[LOBBY] joinLobby request from ${maskPk(playerId)}`);
      log.debug(`[LOBBY] - mode: ${mode}`);
      log.debug(`[LOBBY] - entryFeeTier: ${entryFeeTier}`);
      log.debug(`[LOBBY] - SKIP_ENTRY_FEE: ${process.env.SKIP_ENTRY_FEE}`);
      log.debug(`[LOBBY] - player already paid: ${paidPlayers.has(playerId)}`);

      try {
        const requestedMode = mode as 'practice' | 'tournament' | undefined;
        // Always allow practice mode without fee
        if (requestedMode === 'practice' || entryFeeTier === 0) {
          pendingPaymentByPlayerId.delete(playerId);
          expectedLamportsByPlayerId.delete(playerId);
          await lobbyManager.joinLobby(playerId, entryFeeTier, 'practice');
          break;
        }
        // If a round is already in progress and the player is part of it, ignore join and resume
        const match = getMatchForPlayer(playerId);
        if (match && match.gameWorld.gameState.status === 'in_progress' && (match.gameWorld.gameState.players as any)[playerId]) {
          const rules = [
            'Contrôles: pointez la souris pour diriger',
            'Votre voiture laisse une trace ~5s',
            'Collision avec une trace = élimination',
            'Dernier en vie gagne (85% du prize pool en tournoi)'
          ];
          const gameStarting: ServerToClientMessage = { type: 'gameStarting', payload: { countdown: 0, rules } } as any;
          ws.send(JSON.stringify(gameStarting));
          break;
        }
        if (process.env.SKIP_ENTRY_FEE === 'true') {
          // Practice-like dev mode: no payment, bots allowed, treat as tournament UI but skip tx
          pendingPaymentByPlayerId.delete(playerId);
          expectedLamportsByPlayerId.delete(playerId);
          paidPlayers.add(playerId);
          await lobbyManager.joinLobby(playerId, entryFeeTier, mode ?? 'tournament');
          break;
        }
        if (paidPlayers.has(playerId)) {
          log.info(`[LOBBY] Player ${maskPk(playerId)} already paid, joining lobby directly`);
          await lobbyManager.joinLobby(playerId, entryFeeTier, mode ?? 'tournament');
        } else if (pendingPaymentByPlayerId.has(playerId)) {
          log.info(`[LOBBY] Player ${maskPk(playerId)} has pending payment verification, ignoring duplicate join request`);
          // Payment verification in progress, ignore this request - player will auto-join after verification
        } else {
          // Create entry-fee transaction and send to client
          const tier = entryFeeTier as import('shared').EntryFeeTier;
          const lamports = await smartContractService.getEntryFeeInLamports(tier);
          const solAmount = (lamports / 1_000_000_000).toFixed(6);
          log.info(`[PAYMENT] 💵 Entry fee for tier $${tier}: ${lamports} lamports (${solAmount} SOL)`);
          expectedLamportsByPlayerId.set(playerId, lamports);
          expectedTierByPlayerId.set(playerId, tier);
          const { txBase64, recentBlockhash, prizePool } = await smartContractService.createEntryFeeTransactionBase64((new (await import('@solana/web3.js')).PublicKey(playerId)), lamports);
          const paymentId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          pendingPaymentByPlayerId.set(playerId, { paymentId, createdAt: Date.now(), lamports, tier });
          try { audit.log('payment_tx_created', { playerId, tier, lamports, paymentId }); } catch { }
          const entryFeeTxMessage: any = { type: 'entryFeeTx', payload: { txBase64, lamports, recentBlockhash, prizePool, entryFeeTier: tier, paymentId, sessionNonce: socketToNonce.get(ws)?.nonce } };
          ws.send(JSON.stringify(entryFeeTxMessage));
        }
      } catch (e: any) {
        log.error(`Join error: ${e?.message || e}`);
        ws.send(JSON.stringify({ type: 'error', payload: { message: `Join failed: ${e?.message || e}` } }));
      }
      break;
    }
    case 'entryFeeSignature': {
      if (!take('tx')) { ws.send(JSON.stringify({ type: 'error', payload: { message: 'Rate limited (tx)' } })); return; }
      const playerId = socketToPlayerId.get(ws);
      if (!playerId) return;
      log.info(`[PAYMENT] 📝 Received entryFeeSignature from ${maskPk(playerId)}`);
      log.debug(`[PAYMENT] - signature: ${(message as any).payload.signature?.slice(0, 20)}...`);
      log.debug(`[PAYMENT] - paymentId: ${(message as any).payload.paymentId}`);
      log.debug(`[PAYMENT] - sessionNonce: ${(message as any).payload.sessionNonce}`);
      log.debug(`[PAYMENT] - player in paidPlayers: ${paidPlayers.has(playerId)}`);
      log.debug(`[PAYMENT] - pending payment exists: ${pendingPaymentByPlayerId.has(playerId)}`);
      log.debug(`[PAYMENT] - expected lamports: ${expectedLamportsByPlayerId.get(playerId)}`);
      log.debug(`[PAYMENT] Starting verification...`);
      const playerPk = new (await import('@solana/web3.js')).PublicKey(playerId);
      const expectedLamports = expectedLamportsByPlayerId.get(playerId);
      const pending = pendingPaymentByPlayerId.get(playerId);
      if (pending && usedPaymentIds.has(pending.paymentId)) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Payment already used' } }));
        return;
      }
      const signature = (message as any).payload.signature as string;
      const providedPaymentId = (message as any).payload.paymentId as string | undefined;
      const providedNonce = (message as any).payload.sessionNonce as string | undefined;
      const sessionNonceObj = socketToNonce.get(ws);
      const sessionNonce = sessionNonceObj?.nonce;
      if (!pending || !providedPaymentId || pending.paymentId !== providedPaymentId || (providedNonce && providedNonce !== sessionNonce)) {
        ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid payment context' } }));
        return;
      }

      console.log(`[PAYMENT] 🔍 Starting verification for signature: ${signature}`);
      console.log(`[PAYMENT] Expected lamports: ${expectedLamports}`);
      console.log(`[PAYMENT] Player: ${maskPk(playerId)}`);
      console.log(`[PAYMENT] Solscan: https://solscan.io/tx/${signature}`);

      // Retry verification to allow confirmation on-chain
      let attempts = 0;
      let verified = false;
      let lastErr: any = null;
      let errorReason: string | undefined = undefined;
      if (expectedLamports) {
        while (attempts < 40 && !verified) { // up to ~60s (increased from 20 to 40 attempts)
          try {
            const res = await smartContractService.verifyEntryFee(signature, expectedLamports);
            verified = res.ok;
            if (verified) {
              console.log(`[PAYMENT] ✅ Verification succeeded on attempt ${attempts + 1}`);
              break;
            }
            // If transaction explicitly failed (not just not found yet)
            if (res.error) {
              console.log(`[PAYMENT] ❌ Transaction failed: ${res.error}`);
              errorReason = res.error;
              break; // Don't keep retrying if transaction failed
            }
          } catch (e) {
            lastErr = e;
            if (attempts % 10 === 0) {
              console.log(`[PAYMENT] Attempt ${attempts}: Not found yet...`);
            }
          }
          await new Promise(r => setTimeout(r, 1500));
          attempts++;
        }
      }
      const timedOut = attempts >= 40 && !errorReason;
      log.info(`[PAYMENT] 🔍 Verification complete after ${attempts} attempts: verified=${verified}, timedOut=${timedOut}, error=${errorReason}`);
      const reason = errorReason || (timedOut ? 'Timeout waiting for confirmation' : 'Payment not found');
      const resp: any = { type: 'entryFeeVerified', payload: { ok: verified, reason: verified ? undefined : reason } };
      ws.send(JSON.stringify(resp));
      try { audit.log('payment_verified', { playerId, ok: verified, reason: verified ? undefined : reason, signature }); } catch { }
      if (verified) {
        log.info(`[PAYMENT] ✅ Adding player ${maskPk(playerId)} to paidPlayers set`);
        paidPlayers.add(playerId);
        if (pending) {
          usedPaymentIds.add(pending.paymentId);
          pendingPaymentByPlayerId.delete(playerId);
        }
        const tier = expectedTierByPlayerId.get(playerId);
        if (tier) {
          log.info(`[PAYMENT] 🎯 Auto-joining player ${maskPk(playerId)} to lobby (tier=${tier})`);
          await lobbyManager.joinLobby(playerId, tier);
        }
        // DON'T delete expectedLamportsByPlayerId - needed for refunds!
        // expectedLamportsByPlayerId.delete(playerId);
        expectedTierByPlayerId.delete(playerId);
      } else {
        // Payment failed - kick player out
        log.warn(`[PAYMENT] ❌ Payment verification failed for ${maskPk(playerId)} - disconnecting`);
        expectedLamportsByPlayerId.delete(playerId);
        expectedTierByPlayerId.delete(playerId);
        pendingPaymentByPlayerId.delete(playerId);
        // Give client 2 seconds to show the error message, then disconnect
        setTimeout(() => {
          try {
            ws.close(1008, 'Payment verification failed');
          } catch (e) {
            log.error('[PAYMENT] Error closing socket:', e);
          }
        }, 2000);
      }
      break;
    }
	    case 'playerInput': {
	      if (!take('input')) return;
	      const playerId = socketToPlayerId.get(ws);
	      if (!playerId) return;
      // Clamp bursts: accept at most one input per ~16ms (~60/s) in addition to token bucket
      const now = Date.now();
      const last = (socketRate as any).lastInputAt?.get?.(ws) as number | undefined;
      if (!(socketRate as any).lastInputAt) (socketRate as any).lastInputAt = new Map();
	      if (!last || (now - last) >= 16) {
	        (socketRate as any).lastInputAt.set(ws, now);
	        const match = getMatchForPlayer(playerId);
	        if (match) {
	          match.gameWorld.handlePlayerInput(playerId, (message as any).payload);
	        }
	      }
	      break;
	    }
    case 'leaveLobby': {
      const playerId = socketToPlayerId.get(ws);
      if (!playerId) return;
      lobbyManager.leaveLobby(playerId);
      break;
    }
    default:
      log.warn(`⚠️ Unknown message type`, (message as any).type);
  }
}

// =================================================================================================
// Broadcasting
// =================================================================================================

function broadcastToLobby(lobby: Lobby, message: ServerToClientMessage): void {
  const messageString = JSON.stringify(message);
  lobby.players.forEach(playerId => {
    const ws = playerIdToSocket.get(playerId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(messageString);
    }
  });
}

function safeSend(ws: WebSocket, data: string, kind: 'game' | 'generic', topic?: 'state' | 'trail'): void {
  try {
    const buffered = (ws as any).bufferedAmount || 0;
    if (buffered > BACKPRESSURE_MAX_BUFFERED) {
      const strikes = (socketSlowStrikes.get(ws) || 0) + 1;
      socketSlowStrikes.set(ws, strikes);
      if (kind === 'game') {
        const prev = socketPendingState.get(ws) || {};
        if (topic === 'trail') prev.trail = data;
        else prev.state = data; // default to state
        socketPendingState.set(ws, prev);
      }
      if (strikes >= SLOW_CONSUMER_STRIKES_MAX) {
        try { ws.close(4004, 'Slow consumer'); } catch { }
      }
      return;
    }
    ws.send(data);
  } catch { }
}

// Helper function to quantize coordinates to reduce JSON size
function quantizeCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

// Helper function to optimize player data for transmission
function optimizePlayerData(p: any, includeTrail: boolean): any {
  const optimized: any = {
    id: p.id,
    sperm: {
      position: { x: quantizeCoord(p.sperm.position.x), y: quantizeCoord(p.sperm.position.y) },
      velocity: { x: quantizeCoord(p.sperm.velocity.x), y: quantizeCoord(p.sperm.velocity.y) },
      angle: Math.round(p.sperm.angle * 100) / 100,
      angularVelocity: quantizeCoord(p.sperm.angularVelocity),
      color: p.sperm.color,
    },
    isAlive: p.isAlive,
  };

  // Only include status if it exists and has meaningful data (skip if mostly empty)
  if (p.status && (p.status.boostActive || p.status.boostEndTimeMs)) {
    optimized.status = {
      boostActive: p.status.boostActive,
      boostEndTimeMs: p.status.boostEndTimeMs,
    };
  }

  // Only include trail if requested (trailDelta clients get separate trail updates)
  if (includeTrail && p.trail && p.trail.length > 0) {
    optimized.trail = p.trail.map((tp: any) => ({
      x: quantizeCoord(tp.x),
      y: quantizeCoord(tp.y),
      expiresAt: tp.expiresAt,
    }));
  }

  return optimized;
}

function broadcastGameState(): void {
  for (const match of matchesById.values()) {
    const gameState = match.gameWorld.gameState;
    if (gameState.status !== 'in_progress') continue;

    const timestamp = Date.now();
    const playersArray = Object.values(gameState.players) as any[];
    let aliveCount = 0;
    for (const p of playersArray) if (p?.isAlive) aliveCount++;
    const world = gameState.world;
    const objective = (gameState as any).objective;

    let slimStr: string | null = null;
    let fullStr: string | null = null;
    const getSlimStr = (): string => {
      if (slimStr) return slimStr;
      const messageSlim: GameStateUpdateMessage = {
        type: 'gameStateUpdate',
        payload: {
          timestamp,
          goAtMs: (gameState as any).goAtMs,
          players: playersArray.map((p: any) => optimizePlayerData(p, false)),
          world,
          aliveCount,
          objective,
        },
      };
      slimStr = JSON.stringify(messageSlim);
      return slimStr;
    };
    const getFullStr = (): string => {
      if (fullStr) return fullStr;
      const messageFull: GameStateUpdateMessage = {
        type: 'gameStateUpdate',
        payload: {
          timestamp,
          goAtMs: (gameState as any).goAtMs,
          players: playersArray.map((p: any) => optimizePlayerData(p, true)),
          world,
          aliveCount,
          objective,
        },
      };
      fullStr = JSON.stringify(messageFull);
      return fullStr;
    };

    // Broadcast only to players who are actually in this match round (with backpressure)
    Object.keys(gameState.players).forEach((playerId: string) => {
      const ws = playerIdToSocket.get(playerId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        const caps = socketCaps.get(ws);
        safeSend(ws, (caps && caps.trailDelta) ? getSlimStr() : getFullStr(), 'game', 'state');
      }
    });
  }
}

setInterval(broadcastGameState, BROADCAST_INTERVAL);

// Trail delta broadcasting (send only new trail points, not full trails every tick)
function broadcastTrailDelta(): void {
  for (const match of matchesById.values()) {
    const gameState = match.gameWorld.gameState;
    if (gameState.status !== 'in_progress') continue;

    // Only bother if at least one connected client opted into trail deltas.
    let anyWants = false;
    for (const playerId of Object.keys(gameState.players)) {
      const ws = playerIdToSocket.get(playerId);
      if (ws && ws.readyState === WebSocket.OPEN && socketCaps.get(ws)?.trailDelta) { anyWants = true; break; }
    }
    if (!anyWants) continue;

    const deltas: Array<{ playerId: string; points: Array<{ x: number; y: number; expiresAt: number; createdAt?: number }> }> = [];

    for (const p of Object.values(gameState.players) as any[]) {
      const playerId = String(p?.id || '');
      if (!playerId) continue;
      const trail = Array.isArray(p?.trail) ? p.trail : [];
      if (trail.length === 0) continue;

      const lastCreatedAt = match.lastTrailCreatedAtByPlayerId.get(playerId);
      let startIdx = 0;

      if (typeof lastCreatedAt === 'number') {
        let found = false;
        for (let i = trail.length - 1; i >= 0; i--) {
          if (trail[i]?.createdAt === lastCreatedAt) {
            startIdx = i + 1;
            found = true;
            break;
          }
        }
        // If we can't find the last sent point (due to expiry/cleanup), resync with current trail.
        if (!found) startIdx = 0;
      }

      if (startIdx >= trail.length) continue;

      const newPoints = trail.slice(startIdx).map((pt: any) => ({
        x: quantizeCoord(pt.x),
        y: quantizeCoord(pt.y),
        expiresAt: pt.expiresAt,
        createdAt: pt.createdAt
      }));
      if (newPoints.length === 0) continue;

      const last = trail[trail.length - 1];
      if (last && typeof last.createdAt === 'number') match.lastTrailCreatedAtByPlayerId.set(playerId, last.createdAt);

      deltas.push({ playerId, points: newPoints });
    }

    if (deltas.length === 0) continue;

    const msg = { type: 'trailDelta', payload: { timestamp: Date.now(), deltas } } as any;
    const str = JSON.stringify(msg);

    Object.keys(gameState.players).forEach((playerId: string) => {
      const ws = playerIdToSocket.get(playerId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (socketCaps.get(ws)?.trailDelta) safeSend(ws, str, 'game', 'trail');
      }
    });
  }
}

setInterval(broadcastTrailDelta, BROADCAST_INTERVAL * 2); // Send trail deltas at half frequency (7.5 FPS)

// =================================================================================================
// Global error handling
// =================================================================================================

process.on('unhandledRejection', (reason: any) => {
  try {
    log.error('UnhandledPromiseRejection', typeof reason === 'object' ? (reason?.stack || reason) : String(reason));
  } catch { }
});

process.on('uncaughtException', (err: any) => {
  try {
    log.error('UncaughtException', err?.stack || err);
  } catch { }
});

// =================================================================================================
// WebSocket Keepalive (Ping/Pong)
// =================================================================================================

const HEARTBEAT_INTERVAL_MS = 30_000;
const CLIENT_GRACE_MS = 45_000;
const wsHeartbeat = new Map<WebSocket, { lastPing: number; lastPong: number; latencyMs: number }>();

function setupHeartbeat(ws: WebSocket): void {
  (ws as any).isAlive = true;
  wsHeartbeat.set(ws, { lastPing: 0, lastPong: Date.now(), latencyMs: 0 });
  ws.on('pong', () => {
    const hb = wsHeartbeat.get(ws);
    const now = Date.now();
    if (hb) {
      hb.lastPong = now;
      if (hb.lastPing) hb.latencyMs = now - hb.lastPing;
    }
    (ws as any).isAlive = true;
  });
}

const pingTimer = setInterval(() => {
  try {
    wss.clients.forEach((ws) => {
      const hb = wsHeartbeat.get(ws);
      const now = Date.now();
      if (hb && (now - hb.lastPong) > CLIENT_GRACE_MS) {
        try { ws.terminate(); } catch { }
        wsHeartbeat.delete(ws);
        return;
      }
      if (ws.readyState === WebSocket.OPEN) {
        if (hb) hb.lastPing = Date.now();
        (ws as any).isAlive = false;
        try { ws.ping(); } catch { }
        // Attempt to flush coalesced state if buffer has drained sufficiently
        try {
          const buffered = (ws as any).bufferedAmount || 0;
          if (buffered < BACKPRESSURE_MAX_BUFFERED / 2) {
            const pending = socketPendingState.get(ws);
            if (pending && (pending.state || pending.trail)) {
              if (pending.state) ws.send(pending.state);
              if (pending.trail) ws.send(pending.trail);
              socketPendingState.delete(ws);
              const s = (socketSlowStrikes.get(ws) || 0);
              if (s > 0) socketSlowStrikes.set(ws, s - 1);
            }
          }
        } catch { }
      }
    });
  } catch { }
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => { try { clearInterval(pingTimer); } catch { } });
