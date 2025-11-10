## Release Checklist

Pre-release
- [ ] Secrets configured outside git (PM2 env or secret manager)
- [ ] `ALLOWED_ORIGINS` set to Vercel/primary domains only
- [ ] `ENABLE_DEV_BOTS=false`, `SKIP_ENTRY_FEE=false` in prod
- [ ] TLS certificates valid; Nginx `game.conf` deployed and `nginx -t` OK
- [ ] Client `VITE_WS_URL` set for Vercel if WS is on VPS

Health/Readiness
- [ ] `/api/healthz` returns ok
- [ ] `/api/readyz` passes (RPC reachable, prize pool configured)
- [ ] `/api/ws-healthz` shows expected alive count and latency

Load/Resilience Tests
- [ ] Run WS load: `node scripts/loadtest/ws-broadcast.js wss://game.example/ws 200 60`
- [ ] Observe PM2 memory/CPU during test; no slow-consumer disconnect storms

Observability
- [ ] Metrics at `/api/metrics` scrapeable
- [ ] Logs flow to central destination (optional)

Deployment
- [ ] `pnpm -w build` successful
- [ ] `pm2 start ops/pm2/ecosystem.config.js` or `pm2 reload spermrace-server-ws`
- [ ] Smoke test via SPA: join lobby, start round, receive state

Rollback
- [ ] Backup of previous `dist/` exists
- [ ] `pm2 restart spermrace-server-ws --update-env` with previous build if needed



