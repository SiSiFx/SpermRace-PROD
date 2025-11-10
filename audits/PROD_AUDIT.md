## Production Audit — skidr.io / spermrace.io

Date: 2025-10-05

Scope: Monorepo (client on Vercel, server on VPS behind Nginx, PM2). Priorities: security/secrets, WebSocket reliability, deployment safety, performance/costs, observability.

### Summary of Key Risks

- P1 Security
  - ALLOWED_ORIGINS must be set correctly in production; default includes localhost. Misconfig risks WS/API exposure across origins.
  - PM2 ecosystem file contains secret placeholders. Risk of operators pasting live secrets into a tracked file. Use environment/PM2 `--update-env` instead.
  - CSP is enforced via `helmet` for API; static frontend CSP is governed by Nginx example with minimal headers. Consider stricter CSP for SPA hosting.
  - No auth tokens/JWTs by design; SIWS is nonce-based, TTL and single-use enforced. Replay mitigated by nonce TTL+consume.

- P1 WebSocket reliability
  - Heartbeat ping/pong present with termination on grace timeout.
  - Rate limits per-socket for auth/join/tx/input; slow-consumer backpressure handling implemented; unauthenticated message limit enforced.
  - Nginx WS timeouts were 60s; may be marginal depending on heartbeat cadence. Increased to 75s in example to reduce spurious closes.

- P1 Deployment safety
  - `scripts/deploy-vps.sh` referenced wrong PM2 process name and health endpoint. Fixed to use `spermrace-server-ws` and `/api/healthz`.
  - Zero-downtime reload possible via PM2; currently single instance (no sticky sessions required).

- P2 Performance/Costs
  - Consider enabling permessage-deflate on WS (thresholded) to reduce bandwidth for large state messages over high latency clients.
  - Static assets on Vercel have immutable cache headers for `/assets/*`. Ensure HTML remains no-cache.

- P2 Observability
  - Basic Prometheus metrics exposed at `/api/metrics` (http/ws counters). JSON request logs added (opt-in via `LOG_JSON=true`).
  - Correlation via `x-request-id` response header; propagate from proxy if set.

### Evidence (Code References)

WS server, security gates, rate limits, heartbeat:
```1:60:packages/server/src/index.ts
import 'dotenv/config.js';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
...
const wss = new WebSocketServer({ server, path: '/ws', perMessageDeflate: { threshold: 1024 } });
```

Origin check and auth gating:
```371:408:packages/server/src/index.ts
wss.on('connection', (ws: WebSocket, req: any) => {
  const origin = (req?.headers?.origin as string | undefined) || '';
  if (origin && !ALLOWED_ORIGINS.includes(origin)) { ws.close(1008, 'Origin not allowed'); return; }
  ...
  const challenge = { type: 'siwsChallenge', payload: { message: AuthService.getMessageToSign(nonce), nonce } } as any;
  ws.send(JSON.stringify(challenge));
```

Request logging and health endpoints:
```184:211:packages/server/src/index.ts
app.get('/api/healthz', (_req, res) => { res.json({ ok: true, port: PORT, now: Date.now() }); });
app.get('/api/ws-healthz', (_req, res) => { /* alive/latency */ });
app.get('/api/readyz', async (_req, res) => { /* RPC + prize pool */ });
```

PM2 ecosystem (use env, avoid committing secrets):
```1:30:ops/pm2/ecosystem.config.js
module.exports = { apps: [{ name: 'spermrace-server-ws', script: 'packages/server/dist/index.js', ... }] };
```

Nginx reverse proxy (timeouts increased to 75s):
```23:41:ops/nginx/game.conf.example
location /ws {
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 75s;
  proxy_send_timeout 75s;
  proxy_pass http://127.0.0.1:8080;
}
```

Client reconnection with exponential backoff and SIWS:
```136:176:packages/client/src/WsProvider.tsx
const attach = (sock: WebSocket, triedDefault = false) => {
  sock.onclose = (ev: CloseEvent) => {
    const attempt = (reconnectAttemptsRef.current = reconnectAttemptsRef.current + 1);
    const delay = Math.min(15000, 1000 * Math.pow(2, attempt - 1));
    reconnectTimerRef.current = (window as any).setTimeout(() => { /* reconnect */ }, delay);
  };
};
```

### Remediation Plan (Incremental PRs)

- security-hardening/nginx-timeouts
  - Raise WS timeouts to 75s. Consider adding `Strict-Transport-Security` and stricter CSP for static hosting.

- deploy-scripts/pm2-health-fixes
  - Fix process name and health endpoint in `scripts/deploy-vps.sh`.

- ws-robustness/permessage-deflate
  - Enable WS permessage-deflate (thresholded) to reduce bandwidth; monitor CPU.

- observability/json-logs
  - Add optional JSON request logs and `x-request-id` emission.

### Open Items / Decisions

- Multi-instance scaling would require either sticky sessions at L7 or externalizing state; current single-instance is fine.
- If serving SPA on Vercel + WS on VPS, ensure `VITE_WS_URL` is set for production deployments.



