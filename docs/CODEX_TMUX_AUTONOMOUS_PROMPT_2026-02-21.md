You are Codex running autonomously in `/home/sisi/projects/spermrace-clean`.

Mission:
Ship non-core production readiness. Do not change core gameplay behavior unless required to fix a failing non-core test.

Authoritative audit:
Read and execute from `docs/PRODUCTION_READINESS_AUDIT_2026-02-21.md`.

Work order (strict):
1. P0 blockers
2. P1 high-priority gaps
3. P2 cleanup

Constraints:
- Keep changes small and atomic.
- Prefer fixing root causes over patching tests.
- Keep scripts portable (no machine-specific absolute paths).
- Do not commit secrets.
- Preserve current tmux flow (`scripts/autonomous-tmux.sh`, `scripts/autonomous-smoke.sh`) while improving failure signaling.

Required deliverables:
1. Secrets and config hygiene
- Remove tracked real secrets from repository files.
- Update `.gitignore` for secret-bearing env files and generated coverage artifacts.
- Add/update a safe sample env file strategy for client/server.

2. CI/CD hardening
- Add GitHub workflow(s) for:
  - install + build
  - `pnpm --filter server test`
  - `pnpm --filter client test`
  - `pnpm exec playwright test -c playwright.config.ts --project=pc`
  - security/dependency check
- Keep existing WS regression workflow intact unless it conflicts.

3. Auth and security hardening
- Bind SIWS HTTP auth to issued challenge nonce and expiration.
- Reduce replay risk for session token handoff to WS.
- Make SIWS domain configuration environment-driven (with safe defaults).
- Review exposure of `/api/readyz` and `/api/metrics`; gate or redact as appropriate.

4. Deployment/runtime consolidation
- Consolidate to one canonical PM2 config and one canonical deploy path.
- Remove/replace stale skidr-era script assumptions.
- Ensure scripts use repo-relative paths.

5. Autonomous tmux reliability
- Improve check-loop behavior so failures are visible and actionable (status marker/log file/exit code strategy).
- Keep unattended operation simple.

6. Test and verification stabilization
- Reduce failing test backlog (server first, then client) until CI gate can pass reliably.
- Preserve Playwright smoke pass.

Execution loop:
1. Implement one focused change set.
2. Run targeted verification.
3. Update `progress.md` with:
  - what changed
  - commands run
  - results
  - remaining risks
4. Continue until all P0 items are complete.

Verification commands:
- `pnpm build`
- `pnpm --filter server test`
- `pnpm --filter client test`
- `pnpm exec playwright test -c playwright.config.ts --reporter=line`
- `pnpm audit --audit-level high`

Final output format:
1. Summary of completed P0/P1/P2 items
2. Remaining failures with exact file references
3. Exact commands and outcomes
4. Rollback notes for risky changes
