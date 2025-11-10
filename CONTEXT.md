SpermRace.io – Project Context (for AI assistants / Cursor CLI)

Purpose
- Fast, simple, attractive battle-royale racer (sperm theme) with lethal trails and boost.
- Two modes share the same core runtime once a match begins:
  - Practice: local simulation with bots (no wallet).
  - Tournament: WebSocket multiplayer (wallet, entry tiers, prizes).

Core Gameplay (current)
- Movement: always-forward, mouse/touch or pointer aim; drifting feel; screen-centered camera.
- Boost: hold to boost; energy drains/regens; screen/halo effect while active.
- Trails: leave fading trail; collision with any opponent trail eliminates; self-collision grace is handled.
- Elimination: permanent (no respawns) – battle-royale rules.
- Zone: Rectangular Slicer – big rectangular safe area; every 8s one side slices inward (telegraphed 3s). Outside → push + elimination after 6s.
- Countdown: 5s pre-start. 5→3s camera fits all players/map; 2→0s camera refocuses on the player; everything frozen until GO.
- Spawning: all players spawn spaced along the map edges, facing inward (slight variance).
- Radar: sonar in corner; map rectangle fits the radar; sweep/pings/echo draw only inside map bounds.
- Map scale: Large arena (currently 8000×6000). Optional procedural artifacts per match:
  - Gel fields (soft slow zones), flow streams (gentle directional lanes).

Tech / Stack
- Monorepo with pnpm workspaces; TypeScript throughout.
- Client: React + Vite + PixiJS v8 (Graphics API v8: .rect().fill(), .stroke(), .circle(), .roundRect()).
- Server: Node/WS (WebSocket) – tournament orchestration + game state sync.
- Shared: types/schemas shared between client and server.

Repository Layout
- packages/client/
  - src/NewGameView.tsx – main PixiJS game component (Practice + Tournament HUD binding)
  - vite.config.ts – dev proxy for /api and /ws
  - index.html, style.css
- packages/server/
  - src/index.ts – Web server + WS gateway (configure ALLOWED_ORIGINS)
  - other files (Auth, Lobby, GameWorld, etc.)
- packages/shared/
  - src/index.ts – shared types/interfaces (WS payloads, game state shapes)
- packages/core/ – (if present) core utilities
- pnpm-workspace.yaml, package.json, README.md

Dev Commands
- Install: pnpm install
- Client dev: pnpm --filter client dev  (default Vite port 5174 unless changed)
- Server dev: pnpm --filter server dev (or start script in server package)
- Full build: pnpm -r build

Environment
- Client (build-time Vite):
  - VITE_WS_URL (optional in prod if proxying /ws through same origin)
- Server (runtime):
  - PORT (default 8080)
  - ALLOWED_ORIGINS (e.g., https://yourdomain.com)
  - VITE_SOLANA_RPC_ENDPOINT (e.g., https://api.devnet.solana.com)

Network / Proxy
- Nginx serves static client and proxies:
  - /ws → ws://127.0.0.1:8080/ws (Upgrade headers)
  - /api/ → http://127.0.0.1:8080
- In dev, Vite proxy preserves Origin (changeOrigin: false) so the server origin check works.

WebSocket Contracts (shared)
- Shared shapes live in packages/shared/src.
- Typical tournament WS state snapshot:
  - players: [{ id, isAlive, sperm: { position {x,y}, angle, color }, trail: [{x,y}] }]
  - world: { width, height }
  - aliveCount: number
  - kills: Record<playerId, number>
  - killFeed: [{ killerId?: string; victimId: string; ts: number }]

Client Runtime (NewGameView highlights)
- Pixi Application lifecycle: init → setupWorld → setupControls → setupZone → createPlayer/Bots → createUI → ticker loop.
- Ticker loop order (simplified):
  - Freeze logic during pre-start; draw overview markers; camera update.
  - When active: input, cars update (player+bots), collisions, trails, particles, HUD (leaderboard/killfeed/boost), radar, zone update.
- Safety & cleanup: on component unmount, ticker stops; containers destroyed; UI removed.

Server Runtime (Tournament)
- Auth/connect (SIWS if enabled) → lobby → countdown → game state streaming via WS.
- Server produces periodic state updates; client renders and shows kills/leaderboard using WS data.

Coding Conventions
- TypeScript strict-ish, avoid any where possible.
- PixiJS v8 API only (no deprecated beginFill/lineStyle; use .fill/.stroke chains).
- Early returns; small helper functions; keep update loop light.
- DOM HUD elements are scoped to a container that is removed on cleanup.

Deployment (summary)
- Build on VPS: pnpm i --frozen-lockfile && pnpm -r build
- Static client → /var/www/<app>
- PM2 run server dist/index.js with env (PORT, ALLOWED_ORIGINS, VITE_SOLANA_RPC_ENDPOINT)
- Nginx site for TLS + proxy; certbot for certificates.

Operational Notes / Gotchas
- Origin enforcement: server will reject WS if Origin mismatch; ensure ALLOWED_ORIGINS matches frontend domain and Vite proxy doesn’t change origin.
- Large arena view: countdown overview relies on zoom-to-fit + overlay markers for visibility.
- Radar: sweep/pings are clipped to map bounds; ensure scale math uses same world units as arena size.

Roadmap / TODO (high level)
- Tournament polish: reconnection, anti-cheat hooks, server authoritative collisions.
- Mobile controls: virtual joystick + boost button.
- Performance: trail LOD for distant bots; pool Graphics objects; tile background.
- Analytics: simple /api/analytics events (join/start/end).

How to Use This Context
- Paste this file into any AI/code-assistant prompt on the VPS (Cursor CLI / editor), or keep it in the repo root as CONTEXT.md so the tool can ingest it locally.



