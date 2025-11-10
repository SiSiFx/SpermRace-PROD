#!/usr/bin/env node
// Simple WS load test: N clients join, authenticate (optional), receive broadcasts, and send inputs at a rate
// Usage: node scripts/loadtest/ws-broadcast.js wss://host/ws 200

import WebSocket from 'ws';

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
  ws.on('open', () => {
    connected++;
    // remain unauthenticated to test unauth gate and rate limits, or send a fake auth to exercise error path
    scheduleInput(ws);
    // attempt join to test server response
    try { ws.send(JSON.stringify({ type: 'joinLobby', payload: { entryFeeTier: 1, mode: 'practice' } })); } catch {}
  });
  ws.on('message', () => { messages++; });
  ws.on('error', () => { errors++; });
  ws.on('close', () => { closed++; });
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



