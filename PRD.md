# SpermRace.io - The "Ultra-Premium" Overhaul (v4.0)

**Objective:** 
Erase the "browser game" feel. Build a AA-quality competitive experience. 
**GLM Optimized Run:** Ensure zero-latency, high-precision execution.

---

## 🔧 PHASE 1: CORE GAMEPLAY REPAIR (Priority: CRITICAL)
*Goal: Fix the "broken" feel. The game must be tight, fair, and responsive.*

### Task 1.1: Physics Engine Audit (Momentum & Drag)
- **Sub-task:** Refactor longitudinal/lateral drag scalars in `NewGameView.tsx`.
- **Sub-task:** Implement "Heavy Drifting" — add a 0.15s weight-transfer delay when switching turn directions.
- **Sub-task:** Pixel-Perfect Hitboxes — visualize player hitboxes in debug mode; tighten the "Head-to-Trail" collision radius to 85% of current size.

### Task 1.2: Input Latency & Drift-Boost
- **Sub-task:** Input Path Audit — Ensure `WsProvider` and `NewGameView` handle inputs in <16ms.
- **Sub-task:** "Drift-Boost" Mechanic — If turning > 45° for more than 0.8s, store "Drift Energy". Release turn to gain a 1.2x speed burst for 0.5s.
- **Sub-task:** Mobile Touch Fix — Resolve the "Stuck Joystick" bug by implementing a `touchend` safety reset.

### Task 1.3: Dynamic Camera System
- **Sub-task:** Speed-Dependent Zoom — Zoom out to 0.35x at max speed; zoom in to 0.75x when slow/colliding.
- **Sub-task:** Look-Ahead Offset — Offset the camera 150px in the direction of travel so players can see trails ahead.

---

## 🎨 PHASE 2: VISUAL IDENTITY (Bio-Cyberpunk Reskin)
*Goal: Neon, Glass, and Motion.*

### Task 2.1: The "Holo-Deck" Main Menu
- **Sub-task:** WebGL Tunnel Background — Replace static stars with a high-speed warping tunnel.
- **Sub-task:** Biometric Play Button — 3D CSS button with a scanning "laser" line sweep.

### Task 2.2: Tactical HUD 2.0
- **Sub-task:** Diegetic UI — Move the Boost Bar from the screen edge to a curved ring around the player character.
- **Sub-task:** Glitch Kill Feed — Add a chromatic aberration "shake" to the kill feed when an elimination occurs.

---

## 🤖 PHASE 3: APEX PREDATOR AI
*Goal: Bots that hunt and bait.*

### Task 3.1: Combat & Vengeance
- **Sub-task:** Interception Vectors — Bots should predict where a player *will* be, not where they are.
- **Sub-task:** The "Panic" State — Bots jitter and boost randomly if trapped in a 200px radius by trails.

---

## 🛠️ QUALITY GATES (For Agents)
1. **Performance Budget:** Zero frame drops below 60fps on mobile.
2. **Testing:** Every Physics/Control change MUST include a vitest unit test in `packages/client/src/test`.
3. **Theming:** Use `this.theme` object in `NewGameView`. Hardcoded hex codes = Automatic Task Rejection.