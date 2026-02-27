## Load & Chaos Testing

WebSocket load test
- Example: `node scripts/loadtest/ws-broadcast.js wss://game.example/ws 200 60`
- Metrics to watch: PM2 CPU/mem, `/api/ws-healthz` alive/latency, disconnect codes (4001/4003/4004/4005).

WebSocket regression (multiplayer correctness)
- Example: `node scripts/loadtest/ws-regression-test.js --url ws://127.0.0.1:8080/ws --clients 12 --seconds 35`
- Checks: no movement before GO (when `goAtMs` exists), players move after GO, trail deltas present.

Chaos (network flapping)
- Requires Linux with `tc`/netem and root.
- Example: `bash scripts/chaos/ws-flap.sh eth0 45`



