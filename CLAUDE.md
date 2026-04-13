# SpermRace.io — Dev Reference

## What this game is

Browser-based battle royale. Players control a sperm cell (Slither.io style) — always moving forward, steer with mouse/joystick. You leave a trail behind you. Touching anyone's trail (including your own after a grace period) = instant death. Last one alive wins the crypto prize pool.

**Entry fees:** $1 / $5 / $25 / $100 (paid in SOL)
**Winner payout:** ~10x entry fee (85% winner, 15% platform fee)
**Match length:** ~3-6 minutes
**Players:** up to 32 per lobby
**Classes:** Balanced (Shield), Sprinter (Dash), Tank (Overdrive) — persisted via localStorage

---

## Repo layout

```
packages/
  client/     Vite + React + PixiJS (WebGL rendering) — deployed to Vercel
  server/     Node.js + WebSocket game server — deployed via PM2 on VPS
  shared/     Zod schemas + shared constants
```

---

## Client architecture

```
src/
  AppUnified.tsx            Screen router: landing | practice-solo | lobby | game | results
  WsProvider.tsx            WebSocket connection + state (auth, lobby, game, payment)
  WalletProvider.tsx        Context bridge — wraps WalletProviderNew, exposes connect/disconnect/publicKey
  WalletProviderNew.tsx     Solana wallet adapter (Coinbase, Trust, WalletConnect, Mobile)
                            Phantom + Solflare omitted — auto-register via Wallet Standard API

  game/engine/
    NewGameViewECS.tsx      Main React wrapper — class selection, input loop, win overlay, death screen
    NewGameViewECS.css      Game overlay styles (win overlay, controls hint, class selection)
    Game.tsx                ECS engine — registers all systems, spawns entities, game loop

    systems/                15 ECS systems (priority-ordered):
      InputSystem.ts          Mouse/touch/gamepad → PlayerInput (hasDirection flag prevents drift)
      PhysicsSystem.ts        Velocity movement, angle interpolation, drift feel
      CameraSystem.ts         Smooth follow + zoom
      ZoneSystem.ts           Shrinking arena — warns then kills outside zone
      TrailSystem.ts          Emits trail points at tail tip, spatial grid collision → kills
      PowerupSystem.ts        Powerup spawning + collection
      AbilitySystem.ts        Shield / Dash / Trap / Overdrive cooldowns + sound dispatch
      CollisionSystem.ts      Car-to-car bouncing + boundary bounce
      BotAISystem.ts          Bot pathfinding, steering, ability usage
      DeathEffectSystem.ts    Death particles + effects
      CombatFeedbackSystem.ts Kill/damage visual feedback
      SoundSystem.ts          Web Audio API — all sounds (boost, kill, death, zone, abilities)
      FloatingTextSystem.ts   Damage numbers + kill text
      SlowMotionSystem.ts     Time-dilation on kills
      RenderSystem.ts         PixiJS rendering — trails, sperm head, sine-wave tail, HUD

    factories/
      EntityFactory.ts      Creates player + bot entities with all ECS components
    config/
      GameConstants.ts      All tuning values (see Key Config below)

  components/
    screens/premium/        Landing, Lobby, Results screens
    game/
      ClassSelection.tsx    3-card class picker with animated canvas demos + playstyle badges
      DeathScreen.tsx       Post-death overlay
      PreGameSequence.tsx   Pre-match countdown
      KillFeed.tsx          In-game kill announcements
      Leaderboard.tsx       Global leaderboard
      MiniMap.tsx           Radar
      ZoneIndicator.tsx     Zone warning UI
```

---

## How the game loop works

**System update order (every frame):**
Input → Physics → Camera → Zone → Trail (collision) → Powerup → Ability → Collision → BotAI → DeathEffect → CombatFeedback → Sound → FloatingText → SlowMotion → Render

**Movement:** `position += velocity * dt`. Heading angle interpolates toward target (drift feel). `hasDirection` flag on PlayerInput prevents angle update when no mouse input, stopping rightward drift.

**Trail:** Points emitted every 4px of movement. Lifetime 7000ms. Width 5px base, 9px boosted. Spatial grid for O(1) collision. Opponent trails rendered with red halo (0xff2222) to signal lethality.

**Tail:** 18-segment sine-wave flagellum driven by `this._time`. Amplitude envelope peaks at ~60% of length, tapers at tip. Boost increases amplitude (10→15) and wave speed (31.4→44.0 rad/s).

**Collision:** carRadius 8px + trailPointWidth 5-9px. Self-collision ignored for 300ms. Spawn invincibility: built into TrailSystem.

---

## Key Config (GameConstants.ts)

```
CAR_PHYSICS.BASE_SPEED = 420 px/s   (was 315 — increased for faster, more skill-based feel)
CAR_PHYSICS.BOOST_SPEED = 780 px/s
CAR_PHYSICS.MAX_SPEED = 860 px/s
CAR_PHYSICS.TURN_SPEED = 3.2 rad/s

RENDER_CONFIG.DEFAULT_ZOOM = 0.72   (was 1.12 — zoomed out for better spatial awareness)
RENDER_CONFIG.MOBILE_ZOOM  = 0.72

TRAIL_CONFIG.LIFETIME_MS = 7000
TRAIL_CONFIG.BASE_WIDTH = 5
TRAIL_CONFIG.BOOSTED_WIDTH = 9
TRAIL_CONFIG.MAX_POINTS = 480       (recalculated for 420px/s)

BOOST_CONFIG.MAX_ENERGY = 100
BOOST_CONFIG.REGEN_RATE = 17 energy/s
BOOST_CONFIG.CONSUMPTION_RATE = 22 energy/s
BOOST_CONFIG.KILL_REWARD_ENERGY = 45

SPAWN_CONFIG.EDGE_PADDING = 320         // global via _generateSpawnPoints()
SPAWN_CONFIG.BOT_FIRST_RING = 500       // defined but ring spawn not used in practice
Arena: 60% of arena used, 600px min separation between spawns

MATCH_CONFIG.ZONE_START_DELAY_MS = 6000
MATCH_CONFIG.ZONE_SHRINK_DURATION_MS = 28000
MATCH_CONFIG.ZONE_MIN_SIZE = 500
MATCH_CONFIG.ZONE_SHRINK_RATE = 30 px/s

Abilities:
  DASH      cooldown 3s   duration 150ms   600px/s
  SHIELD    cooldown 8s   duration 1500ms
  TRAP      cooldown 5s   instant
  OVERDRIVE cooldown 10s  duration 3000ms  2x trail width

Arena sizes:
  Desktop: 8000 × 6000 px
  Mobile:  3500 × 7700 px
```

---

## Sounds (SoundSystem.ts — all Web Audio API, no files)

| Method | Trigger |
|--------|---------|
| `_startBoostSound()` | Boost held — turbine roar |
| `playKill(pitch?)` | Kill confirmed — chime + triangle thud, pitch scales with streak |
| `playNearMiss()` | Opponent trail within 18px — fwit sweep (throttled 400ms) |
| `playFinalDuel()` | 2 players remain — bass pulses + sting |
| `playDeath()` | Local player dies — descending whoosh |
| `playCollision()` | Car-to-car bounce |
| `playPickup()` | Powerup collected |
| `playVictory()` | Win — 3-note arpeggio |
| `playShield()` | Shield ability activated |
| `playDash()` | Dash ability activated |
| `playTrap()` | Trap placed |
| `_playZoneWarning()` | Zone about to shrink |
| `_playZoneShrink()` | Zone actively shrinking |

---

## Game flow (client)

```
Landing → (practice) → Class selection* → Game → Death/Win overlay → Results
         → (tournament) → wallet modal (direct) → Lobby → Class selection* → Game → Results

*Class selection skipped if localStorage has 'spermrace_last_class'
```

**Wallet connect flow:** clicking "Enter room" calls `connect()` directly — opens `@solana/wallet-adapter-react-ui` modal. No intermediate WalletScreen. On mobile always shows modal; on desktop tries last used wallet first (2.5s timeout), then falls back to modal.

**Win overlay:** VICTORY stamp → 3s countdown → auto-exits to Results. Manual CONTINUE button skips countdown.

**Kill streaks:** DOUBLE KILL (2+) → TRIPLE KILL (3+) → MEGA KILL (5+) → ULTRA KILL (7+) → GODLIKE (10+)

**Debug mode:** `?tools=1` or `?debug=1` or `?devtools=1` in URL

---

## Security (implemented)

- SIWS (Sign-In With Solana) auth on all WebSocket connections — nonce TTL 60s, replay protection
- Rate limiting: auth 3/min, join 10/min, input 60/s per socket
- Zod schema validates all WS messages (64KB payload cap). `vector2Schema` uses `.finite()` — NaN/Infinity rejected.
- `clientTimestamp` bounds checked server-side: rejected if >30s old or >5s in future
- Solana RPC proxied through `/api/rpc` — Helius API key never in client bundle
- Production guards: `SKIP_ENTRY_FEE`, `ENABLE_DEV_BOTS`, devnet RPC all fatal-exit in production
- Payment dedup: `usedPaymentIds` Set prevents double-spend; on-chain verification with 40 retries
- Guest sessions: UUID resume token, 24h TTL, practice-mode only (entryFeeTier === 0)

---

## Server API endpoints

```
POST /api/rpc                    Solana RPC proxy (30 req/s rate limit)
GET  /api/sol-price              SOL/USD price (30s cache)
GET  /api/healthz                Health
GET  /api/readyz                 Readiness (checks RPC)
GET  /api/ws-healthz             WebSocket alive count
GET  /api/version                Build info
GET  /api/prize-preflight        Prize pool address + balance
GET  /api/leaderboard/wins       Top by wins
GET  /api/leaderboard/earnings   Top by earnings
GET  /api/leaderboard/kills      Top by kills
GET  /api/leaderboard/skill-rating
GET  /api/player/:wallet/stats
GET  /api/stats                  Global totals
GET  /api/metrics                Prometheus metrics (ops-auth required)
POST /api/analytics
POST /api/siws-auth              HTTP SIWS auth (mobile-friendly)
GET  /api/siws-challenge
POST /api/dev/test-payout        Dev only
```

---

## Server internals

- WebSocket server on port 8080 (path `/ws`), shared HTTP server with Express API
- Server-authoritative for multiplayer; client runs local ECS simulation for practice
- PM2 process: `spermrace-server-ws`
- `SmartContractService.ts` — entry fee tx creation + on-chain verification + prize payout
- `AuthService.ts` — SIWS signature verification (NaCl)
- `GameWorld.ts` — authoritative game state, player physics, lag compensation
- `LobbyManager.ts` — lobby lifecycle, bot filling, surge rules
- `DatabaseService.ts` — SQLite (better-sqlite3) for leaderboards + player stats
- `AuditLogger.ts` — append-only audit log for critical events

---

## Deployment

**Client:** Vercel (auto-deploy on push to main)
**Server:** VPS via PM2 at /opt/spermrace

```bash
# Dev
pnpm --filter client dev     # http://localhost:5174
pnpm --filter server dev     # ws://localhost:8080

# Build
pnpm --filter shared build   # build first — client + server depend on it
pnpm --filter client build
pnpm --filter server build

# Production
pm2 restart spermrace-server-ws
pm2 logs spermrace-server-ws
```

**Required server env vars (production):**
```
SOLANA_RPC_ENDPOINT=https://mainnet.helius-rpc.com/?api-key=...
PRIZE_POOL_SECRET_KEY=<base58 or JSON array>
PRIZE_POOL_WALLET=<pubkey>
NODE_ENV=production
```

---

## What's working

| Feature | Status |
|---------|--------|
| Physics movement + boost | WORKING |
| Trail collision → kill | WORKING |
| Bot AI pathfinding + abilities | WORKING |
| Zone shrinking + warnings | WORKING |
| Abilities (Shield/Dash/Trap/Overdrive) | WORKING |
| Solana wallet + tournament entry + payout | WORKING |
| Sine-wave tail animation | WORKING |
| Sound effects (all) + near-miss + final duel | WORKING |
| Class selection + persistence | WORKING |
| Win overlay (3s countdown) | WORKING |
| Red trail halo on opponents | WORKING |
| Spawn spread (60% arena, 600px sep) | WORKING |
| Mobile controls + boost hint | WORKING |
| Kill streaks + floating text | WORKING |
| Kill counter pulse animation | WORKING |
| Final duel escalation (2 players left) | WORKING |
| Minimap / leaderboard HUD | WORKING |
| Solana RPC proxy (key server-side) | WORKING |
| Countdown animation (SVG ring + CSS-driven) | WORKING |
| Landing page (animations, grain, vignette, glow) | WORKING |
| Wallet connect → direct modal, no intermediate screen | WORKING |

## Known issues / next priorities

- AppUnified chunk is ~2MB uncompressed (code-split `NewGameViewECS` + heavy game systems)
- No dispute/refund flow for failed on-chain payments
- Prize pool key in memory (no multi-sig / hardware wallet)
