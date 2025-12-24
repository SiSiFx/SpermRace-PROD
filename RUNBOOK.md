## Runbook (lean, solo)

### Processes
- Dev: `pnpm dev` (client + server). Prod: `pm2 start ops/pm2/ecosystem.config.js` (edit envs first).
- Health: `curl -f http://localhost:8080/api/healthz` and `curl -f http://localhost:8080/api/ws-healthz`.

### Backups
- Script: `scripts/backup-data.sh` (creates `backups/spermrace-data_YYYYMMDD_HHMMSS.tgz`).
- Contents: `packages/server/data` (SQLite + payment-state JSON + audit log).
- Retention: keep last 7 (manual prune or cron).

### Restore
- Stop server, untar backup into repo root, restart pm2/server.
- If payment-state JSON is corrupted, delete it; autosave will recreate but paid/pending cache will reset.

### Keys / Secrets
- Prize-pool key via env `PRIZE_POOL_SECRET_KEY`; never store in git. Rotate by updating env and restarting.
- SIWS domains: `SIWS_DOMAINS` (default `spermrace.io`).

### Deploy checklist (minimal)
- `pnpm lint && pnpm --filter server test && pnpm --filter server build` (or run the tests/build individually).
- Verify `.env` / pm2 ecosystem envs: `ALLOWED_ORIGINS`, `SOLANA_RPC_ENDPOINT`, `PRIZE_POOL_*`, `SKIP_ENTRY_FEE=false` for prod.
- Backup before deploy: `scripts/backup-data.sh`.
- Post-deploy smoke: `healthz`, `ws-healthz`, lobby join in practice, one paid join on devnet if applicable.
