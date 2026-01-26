# SpermRace.io - Gameplay & UX Polish

## Overview
We want to improve the "juice" and feedback of the game. Players should feel every elimination and victory. The UI needs to be responsive and accurate, especially regarding bots in practice mode.

---

## Task 1: Real-time HUD Updates for Bots
**Branch: feat/hud-updates**

The HUD currently feels disconnected when playing against bots. We need it to be instant and accurate.

### Desired Outcome
- **Accurate Counter:** The "Alive" count at the top of the screen must update *immediately* when any car (player or bot) is eliminated.
- **Kill Feed:** When a bot dies (to a player, another bot, or the zone), it should appear in the kill feed. e.g., "Bot_123 eliminated".
- **Visual Feedback:** The "Alive" counter should pulse (flash red/white) briefly whenever the number drops, drawing the eye to the progress.

---

## Task 2: Enhanced Results Screen
**Branch: feat/enhanced-results**

The end-of-game experience needs to be clearer about who won and how the player performed.

### Desired Outcome
- **Winner Identity:** The Results screen must clearly state *who* won. If a bot won, say "Winner: Bot [Name]". Do not just say "Eliminated" if the player lost; show who bested them.
- **Player Stats:** Display the player's final **Rank** (e.g., "Placed #5 / 8") and **Kills** count prominently.
- **Play Again:** Ensure the "Play Again" button works reliably in both Practice and Tournament modes to restart the loop instantly.

---

## Task 3: Gameplay "Juice" (Feedback)
**Branch: feat/game-juice**

Make the combat feel impactful.

### Desired Outcome
- **Elimination Impact:** When the player is eliminated, the screen should shake significantly, and a red vignette/flash should overlay the screen to emphasize the hit.
- **Kill Satisfaction:** When the player eliminates an opponent, play a specific "success" sound or visual effect (like a gold flash or particle burst) to reward the aggression.
- **Near Misses:** If the player narrowly avoids a trail (within a few pixels), float a "Close Call!" text near their car to highlight the skill moment.

---

## Task 4: Ralph Dashboard
**Branch: fix/dashboard**

Ensure the `ralph-dashboard` (running on port 3333) is stable and correctly reporting agent status without errors. (Note: This is a tooling task to ensure smooth development).