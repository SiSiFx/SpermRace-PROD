# Autonomous tmux Audit (2026-02-21)

## Scope
Audit of current `spermrace-local` readiness for unattended Codex operation in `tmux`.

## Current status snapshot
- Core game loop is running and renderable locally.
- Monorepo build is now passing: `pnpm build`.
- Playwright landing/practice smoke is passing for both projects (`pc`, `mobile`) after selector/runtime fixes.
- Server tests are mostly passing but not fully green.
- Client tests are not green and still need a stabilization pass.

## What was fixed during this audit
1. `packages/server` compile blockers
- Removed duplicate method signature collision in `DatabaseService` by splitting multiplayer expected-score helper.
- Removed `aliveCount` variable redeclaration conflict in `GameWorld`.

2. Server test compatibility regressions
- Restored backward compatibility for `LobbyManager` constructor by allowing no DB dependency (fallback ELO store).
- Fixed `vitest` alias resolution for `shared/dist/*` imports.

3. Playwright execution health
- Resolved `@playwright/test` and `playwright` version mismatch by pinning to `1.56.1`.
- Installed required browser binaries.
- Updated stale landing selectors in `playwright/tests/landing.spec.ts` to match current UI.

4. Autonomous operations tooling
- Added `scripts/autonomous-tmux.sh` for `start|stop|status|attach|bootstrap|smoke` lifecycle.
- Added `scripts/autonomous-smoke.sh` for non-interactive health + integration + Playwright checks.

## Verified commands and results
- `pnpm build` -> PASS
- `pnpm --filter server test` -> FAIL (7 tests, 2 suites)
- `pnpm --filter client test` -> FAIL (significant failures remain)
- `pnpm exec playwright test -c playwright.config.ts --reporter=line` -> PASS (2/2)

## Remaining work (priority order)
1. P0 - Server test backlog (7 failures)
- `packages/server/test/botPerformance.test.ts` uses `@jest/globals` but suite is run under Vitest.
- `packages/server/test/collisionPerformance.test.ts` imports stale dist paths.
- Logic expectation mismatches in latency, ELO conservation, skill-rating delta assertions, and one bot trail-avoidance assertion.

2. P1 - Client test stabilization
- Current baseline has broad failures in style/UI assertions and environment mocks.
- Needs explicit segmentation into:
  - broken tests from stale expectations,
  - real regressions,
  - environment/test harness issues.

3. P1 - CSP/API environment consistency
- Local preview logs show blocked requests to `https://spermrace.io/api/sol-price` due CSP `connect-src`.
- Add environment-aware API base handling to avoid production-origin fetches in local smoke runs.

4. P2 - Docs consistency
- Several architecture/deployment docs are stale or describe old package topology.
- Consolidate to one canonical autonomous runbook and deprecate mismatched docs.

## Autonomous tmux usage
- Bootstrap once:
  - `scripts/autonomous-tmux.sh bootstrap`
- Start unattended stack:
  - `scripts/autonomous-tmux.sh start`
- Attach:
  - `scripts/autonomous-tmux.sh attach`
- Check status/log tail:
  - `scripts/autonomous-tmux.sh status`
- Stop:
  - `scripts/autonomous-tmux.sh stop`

Environment knobs:
- `SESSION_NAME`, `SERVER_PORT`, `CHECK_INTERVAL`, `RUN_MOBILE`, `CODEX_CMD`

Example:
- `SESSION_NAME=sr-auto CHECK_INTERVAL=120 RUN_MOBILE=1 CODEX_CMD="codex -m gpt-5 -C /home/sisi/spermrace-local" scripts/autonomous-tmux.sh start`
