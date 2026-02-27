import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs(argv) {
  const args = {
    url: process.env.WS_URL || 'ws://127.0.0.1:8080/ws',
    clients: Number(process.env.CLIENTS || 12),
    durationMs: Number(process.env.DURATION_MS || 60000),
    tickMs: Number(process.env.TICK_MS || 80),
    trailDelta: (process.env.TRAIL_DELTA || '1') !== '0',
    auditDir: process.env.AUDIT_DIR || path.resolve('./data/audit'),
    exitOnFirstRoundEnd: (process.env.EXIT_ON_FIRST_ROUND_END || '1') !== '0',
    requireAllRoundEnds: (process.env.REQUIRE_ALL_ROUND_ENDS || '0') === '1',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--clients') args.clients = Number(argv[++i]);
    else if (a === '--durationMs') args.durationMs = Number(argv[++i]);
    else if (a === '--tickMs') args.tickMs = Number(argv[++i]);
    else if (a === '--no-trail-delta') args.trailDelta = false;
    else if (a === '--auditDir') args.auditDir = argv[++i];
    else if (a === '--exitOnFirstRoundEnd') args.exitOnFirstRoundEnd = true;
    else if (a === '--waitAllRoundEnds') { args.exitOnFirstRoundEnd = false; args.requireAllRoundEnds = true; }
  }
  if (!Number.isFinite(args.clients) || args.clients <= 0) args.clients = 12;
  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) args.durationMs = 60000;
  if (!Number.isFinite(args.tickMs) || args.tickMs <= 15) args.tickMs = 80;
  return args;
}

function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

function findLatestAuditFile(auditDir) {
  try {
    const files = fs.readdirSync(auditDir).filter(f => /^audit-\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
    if (!files.length) return null;
    files.sort();
    return path.join(auditDir, files[files.length - 1]);
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    '[TEST] ws url=', args.url,
    'clients=', args.clients,
    'durationMs=', args.durationMs,
    'tickMs=', args.tickMs,
    'trailDelta=', args.trailDelta,
    'exitOnFirstRoundEnd=', args.exitOnFirstRoundEnd,
    'requireAllRoundEnds=', args.requireAllRoundEnds,
  );

  const startedAt = Date.now();
  const auditFileBefore = findLatestAuditFile(args.auditDir);
  const auditStatBefore = auditFileBefore ? fs.statSync(auditFileBefore) : null;

  const clients = [];
  const summary = {
    connected: 0,
    authed: 0,
    joined: 0,
    gotGameStarting: 0,
    gotGameState: 0,
    gotObjective: 0,
    gotRoundEnd: 0,
    clientsRoundEnded: 0,
    lastRoundEnd: null,
    errors: 0,
  };

  const globalState = {
    world: null,
    objective: null,
    serverPlayerCountMax: 0,
  };

  const mkClient = (idx) => {
    const st = {
      idx,
      ws: null,
      playerId: null,
      phase: 'init',
      lastSentAt: 0,
      eliminated: false,
      gotRoundEnd: false,
    };

    const ws = new WebSocket(args.url);
    st.ws = ws;

    ws.on('open', () => {
      summary.connected++;
      st.phase = 'open';
      ws.send(JSON.stringify({ type: 'guestLogin', payload: { guestName: `Load${idx}` } }));
    });

    ws.on('message', (data) => {
      const msg = safeJsonParse(data.toString());
      if (!msg || !msg.type) return;

      if (msg.type === 'authenticated') {
        summary.authed++;
        st.playerId = msg.payload?.playerId;
        st.phase = 'authed';
        if (args.trailDelta) {
          try { ws.send(JSON.stringify({ type: 'clientHello', payload: { trailDelta: true } })); } catch { }
        }
        ws.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: 0, mode: 'practice' } }));
        summary.joined++;
        return;
      }

      if (msg.type === 'gameStarting') {
        summary.gotGameStarting++;
        st.phase = 'game';
        return;
      }

      if (msg.type === 'gameStateUpdate') {
        summary.gotGameState++;
        const p = msg.payload || {};
        globalState.world = p.world || globalState.world;
        globalState.objective = p.objective || globalState.objective;
        const players = Array.isArray(p.players) ? p.players : [];
        if (players.length > globalState.serverPlayerCountMax) globalState.serverPlayerCountMax = players.length;
        if (p.objective && p.objective.kind === 'extraction') summary.gotObjective++;
        return;
      }

      if (msg.type === 'playerEliminated') {
        if (msg.payload?.playerId && msg.payload.playerId === st.playerId) st.eliminated = true;
        return;
      }

      if (msg.type === 'roundEnd') {
        if (!st.gotRoundEnd) {
          st.gotRoundEnd = true;
          summary.clientsRoundEnded++;
        }
        summary.gotRoundEnd++;
        summary.lastRoundEnd = msg.payload || null;
        return;
      }

      if (msg.type === 'error') {
        summary.errors++;
        if (!/invalid message schema/i.test(msg.payload?.message || '')) {
          console.log('[WS error]', idx, msg.payload?.message);
        }
        return;
      }
    });

    ws.on('close', () => { /* noop */ });
    ws.on('error', () => { summary.errors++; });

    return st;
  };

  for (let i = 0; i < args.clients; i++) clients.push(mkClient(i + 1));

  const tick = setInterval(() => {
    const world = globalState.world;
    const obj = globalState.objective;
    let eggX = null, eggY = null;
    if (obj && obj.kind === 'extraction' && obj.egg) {
      eggX = Number(obj.egg.x);
      eggY = Number(obj.egg.y);
    } else if (world) {
      eggX = Number(world.width) / 2;
      eggY = Number(world.height) / 2;
    }
    if (!Number.isFinite(eggX) || !Number.isFinite(eggY)) return;

    for (const c of clients) {
      const ws = c.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;
      if (c.phase !== 'game') continue;
      if (c.eliminated) continue;
      const now = Date.now();
      if (now - c.lastSentAt < args.tickMs) continue;
      c.lastSentAt = now;

      const t = (now / 1000) + c.idx * 0.37;
      const jitter = 120 + (c.idx % 5) * 15;
      const tx = eggX + Math.cos(t) * jitter;
      const ty = eggY + Math.sin(t) * jitter;
      try {
        ws.send(JSON.stringify({ type: 'playerInput', payload: { target: { x: tx, y: ty }, accelerate: true, boost: (c.idx % 7 === 0) } }));
      } catch { }
    }
  }, 20);

  const endAt = startedAt + args.durationMs;
  while (Date.now() < endAt) {
    if (args.exitOnFirstRoundEnd && summary.gotRoundEnd > 0) break;
    if (args.requireAllRoundEnds && summary.clientsRoundEnded >= args.clients) break;
    await sleep(250);
  }
  clearInterval(tick);

  for (const c of clients) {
    try { c.ws?.close(); } catch { }
  }

  console.log('[RESULT] connected=', summary.connected, 'authed=', summary.authed, 'joined=', summary.joined, 'gameStarting=', summary.gotGameStarting);
  console.log('[RESULT] gameStateUpdates=', summary.gotGameState, 'objectiveSeen=', summary.gotObjective, 'serverPlayerCountMax=', globalState.serverPlayerCountMax);
  console.log('[RESULT] roundEnd=', summary.gotRoundEnd, 'clientsRoundEnded=', summary.clientsRoundEnded, 'lastRoundEnd=', summary.lastRoundEnd);
  console.log('[RESULT] errors=', summary.errors);

  const auditFileAfter = findLatestAuditFile(args.auditDir);
  if (auditFileAfter) {
    const st = fs.statSync(auditFileAfter);
    const beforeSize = auditFileBefore === auditFileAfter && auditStatBefore ? auditStatBefore.size : 0;
    const grew = st.size > beforeSize;
    console.log('[AUDIT] file=', auditFileAfter, 'grew=', grew, 'size=', st.size, 'beforeSize=', beforeSize);
  } else {
    console.log('[AUDIT] no audit file found at', args.auditDir);
  }

  const ok = summary.authed >= Math.min(args.clients, summary.connected) && summary.gotGameState > 0 && summary.gotObjective > 0;
  if (!ok) process.exitCode = 2;
  if (args.requireAllRoundEnds && summary.clientsRoundEnded < args.clients) process.exitCode = 3;
  else if (summary.gotRoundEnd === 0) process.exitCode = 3;
}

main().catch((e) => {
  console.error('[FATAL]', e);
  process.exitCode = 1;
});
