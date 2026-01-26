# SpermRace.io - Smart Multiplayer Upgrade

## Overview
Make SpermRace.io smarter with improved multiplayer fluency, AI-powered features, and optimized game feel.

---

## Task 1: Client-Side Prediction System
**Branch: feat/client-prediction**

Eliminate 100-200ms input lag with client-side prediction.

### Requirements
- Player moves instantly on input (within 16ms)
- Store input history with sequence numbers
- Reconcile with server state smoothly (no jarring snaps)
- Interpolate corrections over 100ms

### Implementation
1. Add InputHistory class in `packages/client/src/game/`
2. Predict local player movement immediately on input
3. On server update, compare predicted vs actual
4. If mismatch > threshold, smoothly correct position

### Acceptance Criteria
- [x] Input response < 16ms
- [x] No visible snapping on correction
- [x] Existing gameplay tests pass

---

## Task 2: Trail Delta Compression
**Branch: feat/trail-compression**

Reduce bandwidth 60% by sending trail deltas instead of full arrays.

### Requirements
- Send only new trail points, not full trails
- Add trail point IDs for sync
- Client interpolates between points
- Compress trail data efficiently

### Implementation
1. Modify server trail broadcast in `packages/server/`
2. Add TrailDelta message type in `packages/shared/`
3. Client reconstructs trails from deltas
4. Add interpolation for smooth rendering

### Acceptance Criteria
- [x] Bandwidth reduced 60%+ (measure in devtools)
- [x] Trails render smoothly
- [x] Trail collision still works correctly

---

## Task 3: Smart Bot AI System
**Branch: feat/smart-bots**

Add AI bots that play intelligently to fill empty lobbies.

### Requirements
- Bots use pathfinding to avoid trails
- Bots target other players strategically
- Difficulty levels (easy, medium, hard)
- Bots fill lobbies when < 8 players

### Implementation
1. Create BotController in `packages/server/src/game/`
2. Implement trail avoidance algorithm
3. Add strategic targeting (chase weakest player)
4. Difficulty affects reaction time and accuracy

### Acceptance Criteria
- [x] Bots avoid trails 80%+ of time
- [x] Bots feel like human players
- [x] No performance impact with 8 bots

---

## Task 4: Lag Compensation for Collisions
**Branch: feat/lag-compensation**

Fair collision detection across varying latencies.

### Requirements
- Store game state history (last 200ms)
- Rewind to player's perceived time for collision checks
- Interpolate between stored states
- Handle 50-200ms latency fairly

### Implementation
1. Create StateHistory buffer in `packages/server/`
2. Store snapshots every tick (16ms)
3. On collision check, rewind based on player RTT
4. Interpolate positions for accurate detection

### Acceptance Criteria
- [x] Fair collisions across 50-200ms latency
- [x] No "I was already past!" complaints
- [x] Memory usage < 50MB for history buffer

---

## Task 5: Smart Matchmaking
**Branch: feat/smart-matchmaking**

Skill-based matchmaking for fair tournaments.

### Requirements
- Track player skill rating (ELO-like)
- Match similar skill levels
- Separate queues per tier
- Quick match < 30 seconds

### Implementation
1. Add SkillRating to player model
2. Create MatchmakingService in `packages/server/`
3. Implement ELO calculation on match end
4. Group players by skill band

### Acceptance Criteria
- [x] Skill rating updates correctly
- [x] Matches have <500 ELO spread
- [x] Queue time < 30 seconds for 100+ players

---

## Task 6: Performance Optimizer
**Branch: feat/perf-optimizer**

Optimize game for 60fps on mobile devices.

### Requirements
- Spatial partitioning for collision
- Object pooling for trails
- Reduce garbage collection
- Target 60fps on mid-range mobile

### Implementation
1. Add QuadTree for collision in `packages/shared/`
2. Implement object pools for trails and particles
3. Profile and fix GC hotspots
4. Add quality settings (low/medium/high)

### Acceptance Criteria
- [x] 60fps on iPhone 12 / Pixel 6
- [x] Collision check < 1ms for 32 players
- [x] No GC pauses > 5ms
