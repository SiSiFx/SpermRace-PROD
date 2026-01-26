# SpermRace.io - UI/UX & Gameplay Polish

## Overview
This batch focuses on refining the user experience, ensuring the HUD accurately reflects game events (especially bot eliminations), and polishing gameplay feedback.

---

## Task 1: Real-time HUD Updates for Bot Eliminations
**Branch: feat/hud-bot-updates**

Ensure the "Alive" count and Leaderboard/Kill Feed update immediately when a bot is eliminated in both Practice and Online modes.

### Requirements
- **Practice Mode**: When a local bot dies, decrement the "Alive" counter immediately.
- **Online Mode**: Ensure server-side bot eliminations propagate to the client HUD instantly.
- **Visuals**: Trigger a visual pulse or effect on the Alive counter when it changes.
- **Kill Feed**: Clearly show "Bot X eliminated" in the kill feed.

### Implementation
1.  **Modify `NewGameView.tsx`**:
    - Locate the bot elimination logic (local and server-synced).
    - Ensure `this.hudManager.updateAliveCount()` is called with the correct value.
    - For practice mode, calculate alive players based on `this.player` + `this.bot` + `this.extraBots`.
2.  **Modify `HudManager.ts`**:
    - Add a pulse animation class to `aliveCountEl` when the number decreases.

### Acceptance Criteria
- [ ] Alive counter updates instantly when a bot hits a trail.
- [ ] Kill feed shows the elimination event.
- [ ] Alive counter pulses red/white on update.

---

## Task 2: Enhanced Results Screen
**Branch: feat/enhanced-results**

Make the end-of-game dashboard ("Results") more detailed and responsive.

### Requirements
- Show the winner clearly (Player or specific Bot).
- If a bot won, display "Winner: Bot [Name]".
- Display stats: Time survived, Kills, Rank.
- "Play Again" button should be prominent and work for both modes.

### Implementation
1.  **Modify `AppMobile.tsx` / `AppPC.tsx` (Results Component)**:
    - Pass detailed stats to the `Results` component.
    - Differentiate between "You Won", "You Died", and "Bot Won".
2.  **Styling**: Use the existing neon theme but improve layout/typography.

### Acceptance Criteria
- [ ] Results screen correctly identifies the winner (even if it's a bot).
- [ ] Display player's rank (e.g., "Placed #5").
- [ ] "Play Again" restarts the game loop cleanly.

---

## Task 3: Gameplay Feedback Juice
**Branch: feat/gameplay-juice**

Add visual/audio feedback for key events to make the game feel more responsive ("juicy").

### Requirements
- **Elimination**: Screen shake and red vignette when the *player* dies.
- **Kill**: Gold/Green flash or particles when the player eliminates someone (including bots).
- **Near Miss**: Show "Close Call!" text near the player when narrowly avoiding a trail.

### Implementation
1.  **Screen Shake**: Existing `screenShake` in `NewGameView` seems implemented; verify it triggers on death.
2.  **Vignette**: Add a CSS-based red vignette overlay in `index.html` or `NewGameView` that fades in on death.
3.  **Floating Text**: Implement a simple floating text system for "Close Call" or "+100" (score/energy).

### Acceptance Criteria
- [ ] Screen shakes on player death.
- [ ] Red vignette effect on death.
- [ ] Visual feedback for eliminating an opponent.

---

## Task 4: Responsive Dashboard (Ralph Dashboard)
**Branch: fix/ralph-dashboard**

Ensure the Ralph Dashboard (`http://...:3333`) correctly displays agent status during this batch.

### Requirements
- The dashboard should show active agents working on these tasks.
- No file access errors in the dashboard logs.

### Implementation
- (This is a meta-task to ensure our tooling works; verify `server.js` fixes from previous batch are persisted/effective).

### Acceptance Criteria
- [ ] Dashboard shows agents connecting and working.
- [ ] No "ENOENT" errors in dashboard console.