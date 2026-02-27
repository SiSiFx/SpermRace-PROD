#!/usr/bin/env node
// Simple WS load test: N clients join, authenticate (optional), receive broadcasts, and send inputs at a rate
// Usage: node scripts/loadtest/ws-broadcast.js wss://host/ws 200

/* eslint-disable no-console */

async function getWebSocketCtor() {
  if (typeof globalThis.WebSocket === 'function') return globalThis.WebSocket;
  // Fallback if running on older Node versions (or global WebSocket is disabled).
  // `ws` is a dependency of the server package; use its local install.
  const mod = await import(new URL('../../packages/server/node_modules/ws/index.js', import.meta.url));
  return mod.default || mod.WebSocket || mod;
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

const WebSocket = await getWebSocketCtor();

const url = process.argv[2] || 'ws://localhost:8080/ws';
const num = parseInt(process.argv[3] || '50', 10);
const runSeconds = parseInt(process.argv[4] || '60', 10);

let connected = 0;
let closed = 0;
let messages = 0;
let errors = 0;
let inputsSent = 0;

const clients = [];

function jitter(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function scheduleInput(ws) {
  const send = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const payload = { target: { x: jitter(0, 1920), y: jitter(0, 1080) }, accelerate: Math.random() < 0.3 };
    try { ws.send(JSON.stringify({ type: 'playerInput', payload })); inputsSent++; } catch {}
    setTimeout(send, jitter(40, 80));
  };
  setTimeout(send, jitter(100, 300));
}

for (let i = 0; i < num; i++) {
  const ws = new WebSocket(url);
  clients.push(ws);
  on(ws, 'open', () => {
    connected++;
    // remain unauthenticated to test unauth gate and rate limits, or send a fake auth to exercise error path
    scheduleInput(ws);
    // attempt join to test server response
    try { ws.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: 1, mode: 'practice' } })); } catch {}
  });
  on(ws, 'message', () => { messages++; });
  on(ws, 'error', () => { errors++; });
  on(ws, 'close', () => { closed++; });
}

const start = Date.now();
const timer = setInterval(() => {
  const elapsed = Math.round((Date.now() - start) / 1000);
  process.stdout.write(`\rsec=${elapsed}/${runSeconds} open=${connected - closed} conn=${connected} closed=${closed} msgs=${messages} inputs=${inputsSent} errors=${errors}   `);
  if (elapsed >= runSeconds) {
    clearInterval(timer);
    clients.forEach(c => { try { c.close(); } catch {} });
    console.log();
    process.exit(0);
  }
}, 1000);



