#!/usr/bin/env node
/**
 * Multiplayer WS regression test (practice mode) to catch:
 * - Movement before server GO countdown ends (goAtMs gate)
 * - Stuck players after GO despite inputs
 * - Missing trail deltas (tails not syncing / not broadcast)
 *
 * No external deps: prefers Node's global WebSocket; falls back to server's `ws` dep.
 *
 * Usage:
 *   node scripts/loadtest/ws-regression-test.js --url ws://127.0.0.1:8080/ws --clients 12 --seconds 25
 */

/* eslint-disable no-console */

import { setTimeout as sleep } from 'timers/promises';

function parseArgs(argv) {
  const args = {
    url: 'ws://127.0.0.1:8080/ws',
    clients: 12,
    seconds: 35,
    tier: 0,
    mode: 'practice',
    trailDelta: true,
    inputHz: 20,
    preGoMaxMove: 0.75,
    postGoMinMove: 4.0,
    minTrailPlayersRatio: 0.6,
    minMovingPlayersRatio: 0.8,
    joinTimeoutMs: 12_000,
    requireGoAtMs: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const next = argv[i + 1];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const hasValue = next && !next.startsWith('--');

    const read = () => {
      if (!hasValue) return '';
      i++;
      return String(next);
    };

    switch (name) {
      case 'url': args.url = read(); break;
      case 'clients': args.clients = Number(read()); break;
      case 'seconds': args.seconds = Number(read()); break;
      case 'tier': args.tier = Number(read()); break;
      case 'mode': args.mode = read(); break;
      case 'trailDelta': {
        const v = read();
        args.trailDelta = v !== '0' && v !== 'false';
        break;
      }
      case 'inputHz': args.inputHz = Number(read()); break;
      case 'preGoMaxMove': args.preGoMaxMove = Number(read()); break;
      case 'postGoMinMove': args.postGoMinMove = Number(read()); break;
      case 'minTrailPlayersRatio': args.minTrailPlayersRatio = Number(read()); break;
      case 'minMovingPlayersRatio': args.minMovingPlayersRatio = Number(read()); break;
      case 'joinTimeoutMs': args.joinTimeoutMs = Number(read()); break;
      case 'requireGoAtMs': {
        const v = read();
        args.requireGoAtMs = !(v === '0' || v === 'false');
        break;
      }
      default: break;
    }
  }

  if (!args.url) throw new Error('Missing --url');
  if (!Number.isFinite(args.clients) || args.clients < 1) throw new Error('Invalid --clients');
  if (!Number.isFinite(args.seconds) || args.seconds < 5) throw new Error('Invalid --seconds');
  return args;
}

function nowMs() { return Date.now(); }

function dist(a, b) {
  const dx = (a.x - b.x);
  const dy = (a.y - b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

function rand(min, max) { return min + Math.random() * (max - min); }

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

async function getWebSocketCtorOrThrow() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket;
  try {
    const mod = await import(new URL('../../packages/server/node_modules/ws/index.js', import.meta.url));
    return mod.default || mod.WebSocket || mod;
  } catch {
    throw new Error('WebSocket not available (need Node global WebSocket or server dependency ws).');
  }
}

function on(ws, event, handler) {
  if (typeof ws.addEventListener === 'function') {
    ws.addEventListener(event, handler);
    return;
  }
  if (typeof ws.on === 'function') {
    ws.on(event, (...args) => {
      if (event === 'message') handler({ data: args[0] });
      else handler(...args);
    });
  }
}

async function main() {
  const cfg = parseArgs(process.argv);
  const WebSocketCtor = await getWebSocketCtorOrThrow();

  const startedAt = nowMs();
  const endAt = startedAt + Math.round(cfg.seconds * 1000);

  const clients = [];

  const seenPlayerIds = new Set();
  const maxPlayersInState = { value: 0 };
  const goAtMsGlobal = { value: null };
  const sawExplicitGoAt = { value: false };

  let totalErrors = 0;
  let totalServerErrors = 0;
  let totalInvalidMessages = 0;

  // movement tracking (per playerId)
  const firstPreGoPosByPlayerId = new Map(); // {x,y}
  const maxPreGoMoveByPlayerId = new Map(); // number
  const firstPostGoPosByPlayerId = new Map(); // {x,y}
  const maxPostGoMoveByPlayerId = new Map(); // number

  // trail delta tracking
  const trailPointsByPlayerId = new Map(); // number

  function recordMove(map, playerId, v) {
    const prev = map.get(playerId) || 0;
    if (v > prev) map.set(playerId, v);
  }

  function onStateUpdate(msg) {
    const payload = msg?.payload;
    if (!payload) return;
    if (typeof payload.goAtMs === 'number') {
      sawExplicitGoAt.value = true;
      if (goAtMsGlobal.value == null) goAtMsGlobal.value = payload.goAtMs;
      else goAtMsGlobal.value = Math.min(goAtMsGlobal.value, payload.goAtMs);
    }
    const players = Array.isArray(payload.players) ? payload.players : [];
    if (players.length > maxPlayersInState.value) maxPlayersInState.value = players.length;

    const ts = (typeof payload.timestamp === 'number') ? payload.timestamp : nowMs();
    // Backward compatible fallback: if server doesn't provide goAtMs, treat the first state timestamp as "GO".
    if (goAtMsGlobal.value == null) goAtMsGlobal.value = ts;
    const goAt = goAtMsGlobal.value;

    for (const p of players) {
      const playerId = String(p?.id || '');
      const sperm = p?.sperm;
      const pos = sperm?.position ?? sperm;
      const x = pos?.x;
      const y = pos?.y;
      if (!playerId || typeof x !== 'number' || typeof y !== 'number') continue;
      seenPlayerIds.add(playerId);
      const point = { x, y };

      if (sawExplicitGoAt.value && ts < goAt) {
        if (!firstPreGoPosByPlayerId.has(playerId)) firstPreGoPosByPlayerId.set(playerId, point);
        const base = firstPreGoPosByPlayerId.get(playerId);
        recordMove(maxPreGoMoveByPlayerId, playerId, dist(base, point));
      } else if (ts >= goAt) {
        if (!firstPostGoPosByPlayerId.has(playerId)) firstPostGoPosByPlayerId.set(playerId, point);
        const base = firstPostGoPosByPlayerId.get(playerId);
        recordMove(maxPostGoMoveByPlayerId, playerId, dist(base, point));
      }
    }
  }

  function onTrailDelta(msg) {
    const deltas = msg?.payload?.deltas;
    if (!Array.isArray(deltas)) return;
    for (const d of deltas) {
      const playerId = String(d?.playerId || '');
      const points = Array.isArray(d?.points) ? d.points : [];
      if (!playerId || points.length === 0) continue;
      trailPointsByPlayerId.set(playerId, (trailPointsByPlayerId.get(playerId) || 0) + points.length);
    }
  }

  function sendJson(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch { /* ignore */ }
  }

  function scheduleInputs(ws) {
    const periodMs = Math.max(10, Math.round(1000 / Math.max(1, cfg.inputHz)));
    const loop = async () => {
      while (nowMs() < endAt) {
        sendJson(ws, {
          type: 'playerInput',
          payload: {
            target: { x: rand(0, 1920), y: rand(0, 1080) },
            accelerate: Math.random() < 0.75,
            boost: Math.random() < 0.25,
          },
        });
        await sleep(periodMs);
      }
    };
    loop().catch(() => {});
  }

  const joinDeadline = nowMs() + cfg.joinTimeoutMs;

  for (let i = 0; i < cfg.clients; i++) {
    const ws = new WebSocketCtor(cfg.url);
    const state = {
      ws,
      idx: i,
      playerId: null,
      openedAt: null,
      authedAt: null,
      sawAnyState: false,
      sawGoAt: false,
      closed: false,
    };
    clients.push(state);

    on(ws, 'open', () => {
      state.openedAt = nowMs();
      sendJson(ws, { type: 'guestLogin', payload: { guestName: `bot_${String(i).padStart(2, '0')}` } });
      sendJson(ws, { type: 'clientHello', payload: { trailDelta: !!cfg.trailDelta } });
      sendJson(ws, { type: 'joinLobby', payload: { entryFeeTier: cfg.tier, mode: cfg.mode } });

      // Always send some inputs (even pre-go) so the test validates the server gate.
      scheduleInputs(ws);
    });

    on(ws, 'message', (ev) => {
      const data = ev?.data;
      const raw = typeof data === 'string' ? data : Buffer.from(data || []).toString('utf8');
      const msg = safeJsonParse(raw);
      if (!msg || typeof msg.type !== 'string') { totalInvalidMessages++; return; }

      if (msg.type === 'error') totalServerErrors++;
      if (msg.type === 'authenticated') {
        const playerId = msg?.payload?.playerId;
        if (typeof playerId === 'string' && playerId) {
          state.playerId = playerId;
          state.authedAt = nowMs();
        }
      }
      if (msg.type === 'gameStateUpdate') {
        state.sawAnyState = true;
        if (typeof msg?.payload?.goAtMs === 'number') state.sawGoAt = true;
        onStateUpdate(msg);
      } else if (msg.type === 'trailDelta') {
        onTrailDelta(msg);
      }
    });

    on(ws, 'error', () => { totalErrors++; });
    on(ws, 'close', () => { state.closed = true; });
  }

  // Wait for basic auth / initial lobby traffic.
  while (nowMs() < joinDeadline) {
    const authed = clients.filter(c => typeof c.playerId === 'string').length;
    if (authed >= Math.max(1, Math.floor(cfg.clients * 0.9))) break;
    await sleep(100);
  }

  // Main run loop: print a small live status line.
  while (nowMs() < endAt) {
    const open = clients.filter(c => !c.closed).length;
    const authed = clients.filter(c => typeof c.playerId === 'string').length;
    const stateCount = clients.filter(c => c.sawAnyState).length;
    const goAt = sawExplicitGoAt.value ? goAtMsGlobal.value : null;
    const tLeft = Math.max(0, Math.round((endAt - nowMs()) / 1000));
    process.stdout.write(
      `\rclients=${cfg.clients} open=${open} authed=${authed} state=${stateCount} goAt=${goAt ?? '-'} seenPlayers=${seenPlayerIds.size} trails=${trailPointsByPlayerId.size} errors=${totalErrors} srvErr=${totalServerErrors} t-${tLeft}s   `,
    );
    await sleep(250);
  }
  process.stdout.write('\n');

  // Close connections
  for (const c of clients) {
    try { c.ws.close(); } catch {}
  }
  await sleep(250);

  // Evaluate
  const authed = clients.filter(c => typeof c.playerId === 'string').length;
  const stateCount = clients.filter(c => c.sawAnyState).length;
  const goAtSeen = clients.filter(c => c.sawGoAt).length;

  const preMoves = [...maxPreGoMoveByPlayerId.values()];
  const postMoves = [...maxPostGoMoveByPlayerId.values()];

  const maxPre = preMoves.length ? Math.max(...preMoves) : 0;
  const maxPost = postMoves.length ? Math.max(...postMoves) : 0;
  const movingPlayers = [...maxPostGoMoveByPlayerId.entries()].filter(([, v]) => v >= cfg.postGoMinMove).length;
  const trailPlayers = [...trailPointsByPlayerId.entries()].filter(([, v]) => v >= 3).length;

  const expectedPlayers = Math.max(1, Math.floor(cfg.clients * 0.8));
  const minMovingPlayers = Math.max(1, Math.floor(cfg.clients * cfg.minMovingPlayersRatio));
  const minTrailPlayers = Math.max(1, Math.floor(cfg.clients * cfg.minTrailPlayersRatio));

  const failures = [];

  if (authed < Math.max(1, Math.floor(cfg.clients * 0.9))) failures.push(`auth: only ${authed}/${cfg.clients} authenticated`);
  if (stateCount < expectedPlayers) failures.push(`state: only ${stateCount}/${cfg.clients} clients received gameStateUpdate`);
  if (cfg.requireGoAtMs && goAtSeen < expectedPlayers) failures.push(`countdown: only ${goAtSeen}/${cfg.clients} clients saw goAtMs`);
  if (maxPlayersInState.value < expectedPlayers) failures.push(`players: max players in state=${maxPlayersInState.value} (expected >=${expectedPlayers})`);
  if (cfg.requireGoAtMs && maxPre > cfg.preGoMaxMove) failures.push(`pre-go move: max=${maxPre.toFixed(2)} (limit ${cfg.preGoMaxMove})`);
  if (maxPost < cfg.postGoMinMove) failures.push(`post-go move: max=${maxPost.toFixed(2)} (expected >=${cfg.postGoMinMove})`);
  if (movingPlayers < minMovingPlayers) failures.push(`stuck: movingPlayers=${movingPlayers}/${cfg.clients} (min ${minMovingPlayers})`);
  if (trailPlayers < minTrailPlayers) failures.push(`trail: trailPlayers>=3pts=${trailPlayers}/${cfg.clients} (min ${minTrailPlayers})`);
  if (totalServerErrors > 0) failures.push(`server errors: ${totalServerErrors} (Invalid message schema / other)`);

  console.log('WS regression summary:');
  console.log(`- url=${cfg.url}`);
  console.log(`- clients=${cfg.clients} seconds=${cfg.seconds} tier=${cfg.tier} mode=${cfg.mode} trailDelta=${cfg.trailDelta}`);
  console.log(`- authed=${authed}/${cfg.clients} stateClients=${stateCount}/${cfg.clients} goAtSeen=${goAtSeen}/${cfg.clients} maxPlayersInState=${maxPlayersInState.value}`);
  console.log(`- maxPreGoMove=${maxPre.toFixed(2)} maxPostGoMove=${maxPost.toFixed(2)} movingPlayers=${movingPlayers} trailPlayers>=3pts=${trailPlayers}`);
  console.log(`- errors=${totalErrors} serverErrors=${totalServerErrors} invalidJson=${totalInvalidMessages}`);

  if (failures.length) {
    console.error('\nFAIL:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log('\nPASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
