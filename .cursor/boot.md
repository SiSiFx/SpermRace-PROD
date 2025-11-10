You are working in a pnpm monorepo for SpermRace.io.

Read CONTEXT.md at repo root first. Treat it as source of truth for:
- architecture, flows, game rules, networking, build/deploy, conventions
- client: packages/client/src/NewGameView.tsx (PixiJS v8) is the canonical game view
- server: packages/server/src/index.ts exposes HTTP and WS on the same port (default 8080), WS path /ws

Do not re-introduce deprecated files (e.g. packages/client/src/GameCanvas.tsx).
Practice (local) and Tournament (WS) share the same in‑match logic and HUD.

Non‑interactive rules:
- No prompts during builds; use defaults and non‑interactive flags
- Keep Vite client on 5174 for dev; proxy /api and /ws to 8080
- In production, static client via Nginx, proxy /api and /ws to the Node server

Gameplay and HUD to preserve (high level):
- lethal trails, self‑kill possible, permanent elimination
- boost at speed 400 with visual effects, without changing trail type
- countdown: 5–3s show everyone (zoomed out), 2–0s focus on player; inputs frozen
- spawns along map edges; rectangular zone slicer; rotating sonar with sweep‑based pings clipped to map
- game over screen with rank + replay/menu

Primary tasks on this host:
1) Ensure dev runs: server on 8080 (HTTP+WS /ws), client on 5174; proxy works
2) Preserve sonar clipping, countdown camera, zone slicer, elimination flow
3) Keep CORS aligned: ALLOWED_ORIGINS must include the site origin(s)
