import WebSocket from 'ws';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }

async function waitFor(ws, predicate, timeoutMs = 8000) {
  return await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    const onMsg = (data) => {
      const msg = safeJsonParse(data.toString());
      if (!msg) return;
      if (predicate(msg)) {
        clearTimeout(t);
        ws.off('message', onMsg);
        resolve(msg);
      }
    };
    ws.on('message', onMsg);
  });
}

async function main() {
  const url = process.env.WS_URL || 'ws://127.0.0.1:8080/ws';
  const graceMs = Number(process.env.GRACE_MS || 20000);
  console.log('[RESUME TEST] url=', url, 'expectedGraceMs≈', graceMs);

  const ws1 = new WebSocket(url);
  await new Promise((r, j) => { ws1.on('open', r); ws1.on('error', j); });
  ws1.send(JSON.stringify({ type: 'guestLogin', payload: { guestName: 'ResumeTest' } }));
  const auth1 = await waitFor(ws1, (m) => m.type === 'authenticated', 6000);
  const guestId = auth1.payload?.playerId;
  const resumeToken = auth1.payload?.resumeToken;
  if (!guestId || !resumeToken) throw new Error('missing guestId/resumeToken');
  console.log('[RESUME TEST] authed guestId=', guestId.slice(0, 8), 'resumeToken=', String(resumeToken).slice(0, 8) + '…');

  ws1.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: 0, mode: 'practice' } }));
  await waitFor(ws1, (m) => m.type === 'gameStarting', 12000);
  await waitFor(ws1, (m) => m.type === 'gameStateUpdate', 6000);
  console.log('[RESUME TEST] got gameStarting + first gameStateUpdate');

  // Disconnect and reconnect within grace window.
  try { ws1.close(); } catch { }
  await sleep(5000);

  const ws2 = new WebSocket(url);
  await new Promise((r, j) => { ws2.on('open', r); ws2.on('error', j); });
  ws2.send(JSON.stringify({ type: 'guestLogin', payload: { guestName: 'ResumeTest', guestId, resumeToken } }));
  const auth2 = await waitFor(ws2, (m) => m.type === 'authenticated', 6000);
  const guestId2 = auth2.payload?.playerId;
  if (guestId2 !== guestId) throw new Error(`resume failed: expected ${guestId} got ${guestId2}`);
  console.log('[RESUME TEST] re-auth ok (same guestId)');

  // Ensure we still receive state updates and our player is still in the match.
  const st = await waitFor(ws2, (m) => m.type === 'gameStateUpdate', 6000);
  const me = (st.payload?.players || []).find((p) => p?.id === guestId);
  if (!me) throw new Error('did not find player in match after reconnect');
  if (me.isAlive !== true) throw new Error('player not alive after reconnect (maybe eliminated too quickly)');
  console.log('[RESUME TEST] resumed into match OK (alive)');

  try { ws2.close(); } catch { }
}

main().catch((e) => {
  console.error('[RESUME TEST] FAIL', e?.message || e);
  process.exitCode = 1;
});

