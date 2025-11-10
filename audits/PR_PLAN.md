## Incremental PR Plan

Target branches: main

Naming:
- security-hardening/nginx-ws-timeouts-hsts
- deploy-scripts/pm2-health-check-fixes
- ws-robustness/permessage-deflate
- observability/json-logs-request-id
- load-chaos/ws-broadcast-and-flap

Order and Scope (each < 300 LOC diff):
1) security-hardening/nginx-ws-timeouts-hsts
   - Update `ops/nginx/game.conf.example` to set `proxy_read_timeout`/`proxy_send_timeout` to 75s and add HSTS.

2) deploy-scripts/pm2-health-check-fixes
   - Fix `scripts/deploy-vps.sh` to use `spermrace-server-ws` process, correct logs, and call `/api/healthz` + `/api/readyz`.

3) ws-robustness/permessage-deflate
   - Enable permessage-deflate (threshold 1KB) in `packages/server/src/index.ts` WS server.

4) observability/json-logs-request-id
   - Add `x-request-id` propagation and optional JSON access logs controlled via `LOG_JSON` env; update `ENV.sample`.

5) load-chaos/ws-broadcast-and-flap
   - Add `scripts/loadtest/ws-broadcast.js`, `scripts/chaos/ws-flap.sh`, and docs under `scripts/loadtest/README.md`.

Post-merge validation:
- Run `pnpm -w build`; run WS load for 60s; verify no slow-consumer mass disconnects and stable latency.
- Confirm `ALLOWED_ORIGINS` in prod and secrets set via PM2 env, not in repo.



