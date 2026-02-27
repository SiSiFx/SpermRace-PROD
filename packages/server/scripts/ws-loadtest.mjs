import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseArgs(argv) {
  const args = {
    url: process.env.WS_URL || 'ws://127.0.0.1:8081/ws',
    clients: Number(process.env.CLIENTS || 256),
    spawnEveryMs: Number(process.env.SPAWN_EVERY_MS || 15),
    durationMs: Number(process.env.DURATION_MS || 90000),
    tickMs: Number(process.env.TICK_MS || 80),
    trailDelta: (process.env.TRAIL_DELTA || '1') !== '0',
    rejoinOnRoundEnd: (process.env.REJOIN || '1') !== '0',
    auditDir: process.env.AUDIT_DIR || path.resolve('./data/audit'),
    reportEveryMs: Number(process.env.REPORT_EVERY_MS || 5000),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--clients') args.clients = Number(argv[++i]);
    else if (a === '--durationMs') args.durationMs = Number(argv[++i]);
    else if (a === '--tickMs') args.tickMs = Number(argv[++i]);
    else if (a === '--spawnEveryMs') args.spawnEveryMs = Number(argv[++i]);
    else if (a === '--no-trail-delta') args.trailDelta = false;
    else if (a === '--no-rejoin') args.rejoinOnRoundEnd = false;
    else if (a === '--auditDir') args.auditDir = argv[++i];
    else if (a === '--reportEveryMs') args.reportEveryMs = Number(argv[++i]);
  }
  if (!Number.isFinite(args.clients) || args.clients <= 0) args.clients = 256;
  if (!Number.isFinite(args.spawnEveryMs) || args.spawnEveryMs < 0) args.spawnEveryMs = 15;
  if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) args.durationMs = 90000;
  if (!Number.isFinite(args.tickMs) || args.tickMs <= 15) args.tickMs = 80;
  if (!Number.isFinite(args.reportEveryMs) || args.reportEveryMs < 0) args.reportEveryMs = 5000;
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

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

function analyzeAudit(auditDir, startedAt, endedAt) {
  const file = findLatestAuditFile(auditDir);
  if (!file) return { file: null };
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { file }; }
  const lines = text.split('\n').filter(Boolean);
  const startByMatchId = new Map();
  const endByMatchId = new Map();
  const playersByMatchId = new Map();
  let totalEntries = 0;

  for (const line of lines) {
    const rec = safeJsonParse(line);
    if (!rec || typeof rec.ts !== 'number' || !rec.type) continue;
    if (rec.ts < startedAt || rec.ts > endedAt + 10_000) continue;
    totalEntries++;
    const payload = rec.payload || {};
    const matchId = payload.matchId;
    if (!matchId) continue;
    if (rec.type === 'round_start') {
      if (!startByMatchId.has(matchId)) startByMatchId.set(matchId, rec.ts);
      const ps = Array.isArray(payload.players) ? payload.players.length : null;
      if (typeof ps === 'number') playersByMatchId.set(matchId, ps);
    } else if (rec.type === 'round_end') {
      if (!endByMatchId.has(matchId)) endByMatchId.set(matchId, rec.ts);
    }
  }

  const durations = [];
  const events = [];
  for (const [matchId, startTs] of startByMatchId.entries()) {
    const endTs = endByMatchId.get(matchId);
    const n = playersByMatchId.get(matchId) || 0;
    if (endTs && endTs >= startTs) {
      durations.push(endTs - startTs);
      events.push({ ts: startTs, dm: +1, dp: +n });
      events.push({ ts: endTs, dm: -1, dp: -n });
    }
  }
  events.sort((a, b) => a.ts - b.ts);
  let m = 0, p = 0, peakM = 0, peakP = 0;
  for (const e of events) {
    m += e.dm;
    p += e.dp;
    if (m > peakM) peakM = m;
    if (p > peakP) peakP = p;
  }
  durations.sort((a, b) => a - b);

  return {
    file,
    totalEntries,
    roundsStarted: startByMatchId.size,
    roundsEnded: endByMatchId.size,
    peakConcurrentMatches: peakM,
    peakConcurrentPlayers: peakP,
    roundDurationMs_p50: percentile(durations, 0.50),
    roundDurationMs_p95: percentile(durations, 0.95),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    '[LOADTEST] url=', args.url,
    'clients=', args.clients,
    'spawnEveryMs=', args.spawnEveryMs,
    'durationMs=', args.durationMs,
    'tickMs=', args.tickMs,
    'trailDelta=', args.trailDelta,
    'rejoin=', args.rejoinOnRoundEnd,
    'auditDir=', args.auditDir,
  );

  const startedAt = Date.now();
  const clients = [];
  const intervals = [];
  const closeCodes = new Map();

  const summary = {
    connected: 0,
    authed: 0,
    joined: 0,
    gameStarting: 0,
    gameStateUpdates: 0,
    objectiveSeen: 0,
    roundEnd: 0,
    errors: 0,
    closes: 0,
    stallsOver250ms: 0,
    stallsOver500ms: 0,
  };

  const mkClient = (idx) => {
    const st = {
      idx,
      ws: null,
      playerId: null,
      phase: 'init',
      eliminated: false,
      world: null,
      objective: null,
      lastInputAt: 0,
      lastStateAt: 0,
    };

    const ws = new WebSocket(args.url);
    st.ws = ws;

    ws.on('open', () => {
      summary.connected++;
      st.phase = 'open';
      try { ws.send(JSON.stringify({ type: 'guestLogin', payload: { guestName: `Load${idx}` } })); } catch { }
    });

    ws.on('message', (data) => {
      const msg = safeJsonParse(data.toString());
      if (!msg || !msg.type) return;

      if (msg.type === 'authenticated') {
        summary.authed++;
        st.playerId = msg.payload?.playerId || null;
        st.phase = 'authed';
        if (args.trailDelta) {
          try { ws.send(JSON.stringify({ type: 'clientHello', payload: { trailDelta: true } })); } catch { }
        }
        try { ws.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: 0, mode: 'practice' } })); } catch { }
        summary.joined++;
        return;
      }

      if (msg.type === 'gameStarting') {
        summary.gameStarting++;
        st.phase = 'game';
        st.eliminated = false;
        return;
      }

      if (msg.type === 'playerEliminated') {
        if (msg.payload?.playerId && msg.payload.playerId === st.playerId) st.eliminated = true;
        return;
      }

      if (msg.type === 'roundEnd') {
        summary.roundEnd++;
        if (args.rejoinOnRoundEnd) {
          const delay = 500 + Math.floor(Math.random() * 2000);
          setTimeout(() => {
            if (!st.ws || st.ws.readyState !== WebSocket.OPEN) return;
            st.phase = 'authed';
            st.eliminated = false;
            try { st.ws.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: 0, mode: 'practice' } })); } catch { }
            summary.joined++;
          }, delay);
        }
        return;
      }

      if (msg.type === 'gameStateUpdate') {
        summary.gameStateUpdates++;
        const now = Date.now();
        if (st.lastStateAt) {
          const dt = now - st.lastStateAt;
          intervals.push(dt);
          if (dt > 250) summary.stallsOver250ms++;
          if (dt > 500) summary.stallsOver500ms++;
        }
        st.lastStateAt = now;
        const p = msg.payload || {};
        st.world = p.world || st.world;
        st.objective = p.objective || st.objective;
        if (p.objective && p.objective.kind === 'extraction') summary.objectiveSeen++;
        return;
      }

      if (msg.type === 'error') {
        summary.errors++;
        return;
      }
    });

    ws.on('close', (code) => {
      summary.closes++;
      closeCodes.set(code, (closeCodes.get(code) || 0) + 1);
    });
    ws.on('error', () => { summary.errors++; });

    return st;
  };

  for (let i = 0; i < args.clients; i++) {
    clients.push(mkClient(i + 1));
    if (args.spawnEveryMs > 0) await sleep(args.spawnEveryMs);
  }

  const tick = setInterval(() => {
    for (const c of clients) {
      const ws = c.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) continue;
      if (c.phase !== 'game') continue;
      if (c.eliminated) continue;
      const now = Date.now();
      if (now - c.lastInputAt < args.tickMs) continue;
      c.lastInputAt = now;

      const obj = c.objective;
      const world = c.world;
      let eggX = null, eggY = null;
      if (obj && obj.kind === 'extraction' && obj.egg) {
        eggX = Number(obj.egg.x);
        eggY = Number(obj.egg.y);
      } else if (world) {
        eggX = Number(world.width) / 2;
        eggY = Number(world.height) / 2;
      }
      if (!Number.isFinite(eggX) || !Number.isFinite(eggY)) continue;

      const t = (now / 1000) + c.idx * 0.37;
      const jitter = 120 + (c.idx % 5) * 15;
      const tx = eggX + Math.cos(t) * jitter;
      const ty = eggY + Math.sin(t) * jitter;
      try {
        ws.send(JSON.stringify({ type: 'playerInput', payload: { target: { x: tx, y: ty }, accelerate: true, boost: (c.idx % 11 === 0) } }));
      } catch { }
    }
  }, 20);

  const reporter = setInterval(() => {
    const open = clients.filter(c => c.ws && c.ws.readyState === WebSocket.OPEN).length;
    console.log('[PROGRESS] open=', open, 'authed=', summary.authed, 'gameStarting=', summary.gameStarting, 'gsu=', summary.gameStateUpdates, 'roundEnd=', summary.roundEnd, 'errors=', summary.errors, 'closes=', summary.closes);
  }, args.reportEveryMs);

  await sleep(args.durationMs);
  clearInterval(tick);
  clearInterval(reporter);

  for (const c of clients) {
    try { c.ws?.close(); } catch { }
  }

  await sleep(250);

  intervals.sort((a, b) => a - b);
  const p50 = percentile(intervals, 0.50);
  const p95 = percentile(intervals, 0.95);
  const p99 = percentile(intervals, 0.99);

  const endedAt = Date.now();
  const audit = analyzeAudit(args.auditDir, startedAt, endedAt);

  console.log('[RESULT] connected=', summary.connected, 'authed=', summary.authed, 'joined=', summary.joined, 'gameStarting=', summary.gameStarting);
  console.log('[RESULT] gameStateUpdates=', summary.gameStateUpdates, 'objectiveSeen=', summary.objectiveSeen, 'roundEnd=', summary.roundEnd);
  console.log('[RESULT] intervalsMs p50=', p50, 'p95=', p95, 'p99=', p99, 'samples=', intervals.length);
  console.log('[RESULT] stalls>250ms=', summary.stallsOver250ms, 'stalls>500ms=', summary.stallsOver500ms, 'errors=', summary.errors, 'closes=', summary.closes);
  console.log('[RESULT] closeCodes=', Object.fromEntries([...closeCodes.entries()].sort((a, b) => a[0] - b[0])));
  console.log('[AUDIT]', audit);

  // Exit codes:
  // - 0: ok-ish
  // - 2: too many errors
  // - 3: update cadence degraded
  if (summary.errors > Math.max(5, Math.floor(args.clients * 0.01))) process.exitCode = 2;
  if (typeof p95 === 'number' && p95 > 150) process.exitCode = 3;
}

main().catch((e) => {
  console.error('[FATAL]', e);
  process.exitCode = 1;
});

