# SpermRace.io - Design System Overhaul & Visual Polish

## Overview
We are executing a complete visual overhaul of SpermRace.io to align with a **High-Fidelity Bio-Cyberpunk** aesthetic. The goal is to make the game feel like a premium, AA-quality indie title.

**Core Aesthetic:**
*   **Theme:** "Neon Biological Warfare"
*   **Colors:** Deep Void Black (#030712), Electric Cyan (#00f5ff), Toxic Green (#00ff88), Warning Yellow (#facc15).
*   **Style:** Glassmorphism, glowing borders, glitch effects, scanlines, and crisp typography.

---

## Task 1: Typography & Design Tokens
**Branch: design/tokens**

Establish the visual foundation.

### Requirements
*   **Fonts:** Implement `Orbitron` (Headers) and `Inter/JetBrains Mono` (UI/Data) globally.
*   **Variables:** Define CSS variables for all neon colors, glow effects, and glass panels.
*   **Global Reset:** Ensure all buttons, inputs, and modals use the new "Tech" style (angled corners, borders).

---

## Task 2: Main Menu & Landing Experience
**Branch: design/landing**

The first impression must be striking.

### Requirements
*   **Hero Section:** Redesign the "SPERM RACE" logo with a massive, animated neon glow and "glitch" entry effect.
*   **Buttons:** Replace standard buttons with "Cyber-Buttons" (clip-path corners, hover slide effects, sound on hover).
*   **Background:** Enhance the particle background to feel deeper (parallax layers).

---

## Task 3: HUD & In-Game UI Reskin
**Branch: design/hud**

The interface player sees 90% of the time.

### Requirements
*   **Top Bar:** Convert the HUD bar into a "floating tech capsule" with a blurred glass background.
*   **Minimap/Radar:** Give it a circular "sonar" look with a scanning sweep animation.
*   **Boost Bar:** Replace the simple bar with a segmented, glowing energy meter that "surges" when full.
*   **Kill Feed:** Style it like a terminal log (monospaced font, fade-in lines).

---

## Task 4: Lobby & Matchmaking UI
**Branch: design/lobby**

The anticipation phase.

### Requirements
*   **Player List:** Display players as "Data Cards" in a grid, not just a text list.
*   **Countdown:** The pre-game countdown should be a massive, screen-filling typographic animation (3... 2... 1... GO!).
*   **Tournament Select:** Redesign the tier selection cards to look like "Holographic Keycards" with 3D tilt effects on hover.

---

## Task 5: Post-Game Results Screen
**Branch: design/results**

Celebrating victory (or defeat).

### Requirements
*   **Victory:** If won, trigger a "God Ray" effect behind the results card. Gold/Neon text.
*   **Defeat:** Red/Glitch aesthetic. "SYSTEM FAILURE" style text.
*   **Stats:** Display stats (Kills, Time) in tech-styled progress bars.

---

## Task 6: Mobile Optimizations
**Branch: design/mobile**

Ensure the new design sings on small screens.

### Requirements
*   **Touch Controls:** Style the virtual joysticks to look like HUD elements, not generic circles.
*   **Scaling:** Ensure text and buttons remain tap-friendly but use the new aesthetic.
*   **Orientation:** Polish the "Rotate Device" warning screen with the new theme.