# Production Readiness Audit (Non-Core) - 2026-02-21

## Scope
Audit of everything except core gameplay mechanics:
- security and secrets
- CI/CD and release gates
- deployment/runtime ops
- observability and recovery
- autonomous Codex/tmux readiness

## Verified baseline (2026-02-21)
- `pnpm build`: PASS (bundle-size warning remains)
- `pnpm --filter server test`: FAIL (`6 failed | 135 passed`, 141 total)
- `pnpm --filter client test`: FAIL (`66 failed | 291 passed`, 357 total)
- `pnpm exec playwright test -c playwright.config.ts --reporter=line`: PASS (`2 passed`), with CSP/API warnings in browser logs
- `pnpm audit --audit-level high`: FAIL (`9 vulnerabilities`, `2 high`)

## P0 blockers (must fix before production signoff)

1. Secret material committed in tracked files
- `./.env.backup:13` includes a real `PRIZE_POOL_SECRET_KEY`.
- `packages/client/.env.production:4` includes a hardcoded Helius API key.
- `./.gitignore:10` does not ignore `*.env.production`, `.env.backup`, or coverage artifacts.

2. No production CI gate
- Only workflow is WS regression on `dev`: `.github/workflows/ws-regression-dev.yml:1`.
- No required CI for `build`, `server test`, `client test`, Playwright smoke, or dependency/security checks on mainline branches.

3. Test suite is not release-ready
- Server failures remain: see `packages/server/test/*.test.ts` baseline above.
- Client failures remain: see `packages/client/src/test/*.test.ts` baseline above.
- Current runbook deploy gate references lint, but no lint script exists.
  - `RUNBOOK.md:21`
  - root scripts in `package.json:5` (no `lint` script present).

4. SIWS/session auth hardening gaps
- HTTP SIWS auth reads `nonce` but does not validate or bind it:
  - `packages/server/src/index.ts:728`
  - `packages/server/src/index.ts:736`
- WS session token is accepted via URL query and is reusable within TTL:
  - `packages/server/src/index.ts:973`
  - `packages/server/src/index.ts:992`
- Domain validation is hardcoded to one domain, not env-driven:
  - `packages/server/src/AuthService.ts:5`

5. Deployment path drift and stale deploy scripts
- Legacy/stale production script references `skidr.io` and hardcoded/nonexistent config model:
  - `deploy-production.sh:3`
  - `deploy-production.sh:8`
- VPS deploy script still references `skidr` paths and labels:
  - `scripts/deploy-vps.sh:4`
  - `scripts/deploy-vps.sh:20`
  - `scripts/deploy-vps.sh:224`
- Mobile test helper is hardcoded to `/opt/spermrace`:
  - `scripts/test-mobile.sh:25`

## P1 high-priority gaps

1. Public operational endpoints expose internals
- Readiness endpoint returns RPC + prize pool details:
  - `packages/server/src/index.ts:576`
  - `packages/server/src/index.ts:587`
- Metrics endpoint is fully open:
  - `packages/server/src/index.ts:692`

2. Proxy/rate-limit trust boundary risk
- `app.set('trust proxy', 1)` is always enabled:
  - `packages/server/src/index.ts:444`
- If server is exposed directly, spoofed forwarding headers can distort IP-based protections.

3. Client API base inconsistency causes CSP/network noise
- `WsProvider` comment says same-origin but returns hardcoded production API:
  - `packages/client/src/WsProvider.tsx:3`
  - `packages/client/src/WsProvider.tsx:8`
- Playwright logs show blocked `https://spermrace.io/api/sol-price` calls in local smoke.

4. Runtime/deploy config drift
- Two PM2 configs disagree on entrypoint/layout:
  - `ops/pm2/ecosystem.config.js:5`
  - `ecosystem.config.js:4`
- Nginx example file has duplicate server blocks:
  - `ops/nginx/game.conf.example:3`
  - `ops/nginx/game.conf.example:70`
- Caddyfile contains Windows local path and nonportable root:
  - `ops/caddy/Caddyfile:10`

5. Autonomous tmux loop masks smoke failures
- Check loop currently swallows errors with `|| true`:
  - `scripts/autonomous-tmux.sh:63`
- Failures are logged but not escalated/restarted/notified.

## P2 cleanup and hardening

1. Dependency risk backlog
- `pnpm audit` reports 2 high issues (including `axios` and `minimatch` transitive paths).

2. Documentation sprawl and contradiction
- Multiple legacy deployment docs and old brand/package references remain in root and `docs/deployment/`.

3. Repo hygiene debt
- Coverage artifacts are tracked under `packages/client/coverage/*`.
- Legacy large logs/report files are tracked (for example `deployment-log.txt`).

4. Default fallback values can hide bad config
- Smart contract service has fallback RPC + fallback prize wallet:
  - `packages/server/src/SmartContractService.ts:10`
  - `packages/server/src/SmartContractService.ts:13`

## Definition of done for non-core production readiness

1. Security and secrets
- Remove/rotate exposed keys and enforce secret scanning.
- No real credentials in tracked files.
- SIWS nonce challenge is validated and replay-resistant.

2. Release gates
- CI required on main branches for:
  - install + build
  - server tests
  - client tests
  - Playwright smoke
  - dependency/security check
- All gates green before deploy.

3. Deploy/ops reliability
- One canonical deploy path (script + doc) with tested rollback.
- One canonical PM2 config.
- Portable scripts (no machine-specific absolute paths).

4. Observability/recovery
- Metrics/logging/health scope intentionally exposed (or protected).
- Backup + restore drill documented and tested.
- Autonomous tmux loop raises failure signals, not only logs.

## Recommended execution order for autonomous Codex
1. P0: secrets + CI + auth hardening + test baseline stabilization.
2. P1: endpoint exposure, proxy trust, API-base consistency, config consolidation.
3. P2: dependency upgrades, repo/doc cleanup, operational polish.
