// Test full client-server integration (HTTP health + WS handshake)
const http = require('http');
let WebSocket;
try { WebSocket = require('ws'); } catch {
  console.error('❌ Missing dependency: ws');
  process.exit(1);
}

const BASE = process.env.TEST_BASE || 'http://localhost:8080';
const WS_URL = process.env.TEST_WS || 'ws://localhost:8080/ws';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const req = lib.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, text: data }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(new Error('HTTP timeout')); });
  });
}

async function main() {
  console.log('🔌 Testing client-server integration...');
  console.log(`🌐 BASE=${BASE}  🔄 WS=${WS_URL}`);

  // 1) HTTP health
  const health = await httpGet(`${BASE}/api/healthz`);
  if (health.status !== 200 || !health.json || health.json.ok !== true) {
    console.error('❌ /api/healthz failed:', health);
    process.exit(1);
  }
  console.log('✅ /api/healthz OK');

  // 2) WS health (optional: skip if endpoint not available)
  try {
    const wsHealth = await httpGet(`${BASE}/api/ws-healthz`);
    if (wsHealth.status === 200 && wsHealth.json && wsHealth.json.ok === true) {
      console.log(`✅ /api/ws-healthz OK (clients: total=${wsHealth.json.total}, alive=${wsHealth.json.alive})`);
    } else {
      console.log('⚠ ws-healthz not available or non-200; continuing without it');
    }
  } catch (_) {
    console.log('⚠ ws-healthz check failed; continuing');
  }

  // 3) WS handshake (expect siwsChallenge)
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, { handshakeTimeout: 5000 });
    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error('WS handshake timeout'));
    }, 7000);

    ws.on('open', () => {
      console.log('✅ WS connected');
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg && msg.type === 'siwsChallenge' && msg.payload && msg.payload.nonce) {
          console.log('✅ Received siwsChallenge');
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          resolve();
        }
      } catch (e) {
        // ignore parse errors; continue waiting for valid message
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on('close', () => {
      // If closed before receiving challenge, reject if timeout not yet fired
    });
  });

  console.log('🎉 Integration test successful');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});