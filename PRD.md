# SpermRace.io - The "Ultra-Premium" Overhaul (v4.0)

**Objective:**
Erase the "browser game" feel. Build a AA-quality competitive experience.
Focus on **Game Feel** (Juice), **Visual Identity** (Neon Bio-Cyberpunk), **Smart AI**, and **Rock-Solid Gameplay**.

---

## 🎨 PART 1: UI/UX REVOLUTION (Completed/Verifying)
*Goal: Redesign every single screen. No old CSS. Mobile-First.*

### Task 1: The "Holo-Deck" Main Menu
**Branch: ui/main-menu**
- [x] **Background:** Dynamic 3D-style tunnel traversal (WebGL/Canvas) instead of static image.
- [x] **Play Button:** Massive, pulsing "Biometric Scanner" button. Hold to play (adds tension).
- [x] **Typography:** Custom `Orbitron` (Headers) + `Rajdhani` (UI) font stack.
- [x] **Layout:** Bottom-sheet style for mobile, Floating holographic panels for desktop.

### Task 2: Tactical HUD 2.0 (The Pilot's Cockpit)
**Branch: ui/hud-2.0**
- [x] **Minimap:** Hexagonal "Radar" with scanning sweep effect (not just dots).
- [x] **Boost Gauge:** Curved bar around the player character (diegetic UI) instead of a screen bar.
- [x] **Kill Feed:** Glitch-text effect for eliminations (e.g., "USER_01 [ERASED] USER_02").
- [x] **Damage Feedback:** Screen chromatic aberration and red vignette on impact.

### Task 3: The "Lobby of Legends"
**Branch: ui/lobby-redesign**
- [x] **Player Grid:** 3D tilting cards for each player.
- [x] **Ready State:** "System Check" animation (text scrolling: "Syncing... Connected... Ready").
- [x] **Countdown:** Cinematic "3... 2... 1..." with bass-drop sound cues and screen shake.

### Task 4: Victory & Defeat Cinematics
**Branch: ui/results-cinema**
- [x] **Victory:** Slow-motion freeze frame of the final kill. "CHAMPION" text slams onto screen.
- [x] **Defeat:** Screen "cracks" (glass shatter effect) and fades to gray.
- [x] **Stats:** Animated bar charts filling up for Kills, Survival Time, and Accuracy.

---

## 🔧 PART 4: CORE GAMEPLAY REPAIR (Priority High)
*Goal: Fix "broken" mechanics. Tight controls, smooth physics, fair combat.*

### Task 11: Physics & Collision Tuning
**Branch: gameplay/physics-fix**
- [ ] **Hitboxes:** visualize and tighten player hitboxes. Ensure "Head-to-Trail" collisions are pixel-perfect.
- [ ] **Wall Sliding:** Prevent sticky collisions. Players should slide/glance off walls, not stop dead.
- [ ] **Momentum:** Adjust friction/drag. Drifting should feel heavy but responsive (Mario Kart style).

### Task 12: Control Responsiveness
**Branch: gameplay/controls**
- [ ] **Input Latency:** Audit input handling path. Ensure <16ms response time.
- [ ] **Turning Radius:** Implement "Drift Boost" mechanics (sharper turn = speed loss unless boosting).
- [ ] **Mobile Touch:** Fix virtual joystick deadzones. Ensure no "stuck" inputs on release.

### Task 13: Camera & Awareness
**Branch: gameplay/camera**
- [ ] **Dynamic Zoom:** Camera zooms out at high speed (to see ahead) and in during combat/slow speed.
- [ ] **Look-Ahead:** Offset camera in direction of travel so players can see where they are going.
- [ ] **Shake:** Refine screen shake (don't overdo it). Only shake on impacts/kills.

---

## 🤖 PART 2: THE "APEX PREDATOR" BOT AI
*Goal: Bots that play like skilled humans, not mindless drones.*

### Task 5: Advanced Pathfinding (The Brain)
**Branch: ai/pathfinding**
- [ ] **Navigation Mesh:** Implement a dynamic grid/mesh to detect "traps" (areas surrounded by trails).
- [ ] **Wall Hugging:** Teach bots to safely drift near walls to bait enemies.
- [ ] **Trail Awareness:** Bots must predict *future* trail closures, not just react to current ones.

### Task 6: Combat Logic (The Hunter)
**Branch: ai/combat**
- [ ] **Interception:** Calculate interception vectors to cut off enemies, not just chase them.
- [ ] **Baiting:** Bots should feign retreat, then turn 180° to encircle a chaser.
- [ ] **Boost Management:** Bots only boost to *kill* or *escape*, never randomly.

### Task 7: Human-Like Flaws (The Turing Test)
**Branch: ai/humanization**
- [ ] **Reaction Delay:** 150-300ms variable delay based on "focus".
- [ ] **Panic:** If surrounded, bot inputs become jittery/erratic.
- [ ] **Vengeance:** If hit by a player, the bot prioritizes that player for 10 seconds.

### Task 10: Bot Logic Audit & Refactor
**Branch: ai/audit-refactor**
- [ ] **Audit:** Review `BotController.ts` for logic gaps and state machine flaws.
- [ ] **Refactor:** Implement GOAP or Utility AI to replace simple state machine if needed.
- [ ] **Optimization:** Ensure bot logic doesn't impact server performance (target < 1ms per bot update).

---

## ⚡ PART 3: GAME FEEL (JUICE)
*Goal: Make every interaction satisfying.*

### Task 8: Impact & Physics
**Branch: fx/impact**
- [ ] **Collision Particles:** Sparks and "bio-goo" explosion on death.
- [ ] **Camera Shake:** Directional shake based on impact vector.
- [ ] **Time Dilation:** Slight slow-motion (0.5s) when the final kill happens.

### Task 9: Audio-Visual Sync
**Branch: fx/audio-sync**
- [ ] **Beat Sync:** UI elements pulse to the background music BPM.
- [ ] **Spatial Audio:** Enemy boost sounds get louder/pan based on proximity.

---

## 🛠 ARCHITECTURE
- **Parallel Execution:** Ralphy will execute these tasks simultaneously.
- **Strict TypeScript:** No `any`. Strict types for all new AI modules.
- **Mobile Optimized:** All UI *must* be touch-friendly (44px+ targets).
