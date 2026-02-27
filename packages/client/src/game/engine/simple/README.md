# Simple Pixi Runtime

Purpose: keep gameplay runtime small, fast, and easy to maintain.

## File layout

- `types.ts`: shared runtime types and callback contracts
- `constants.ts`: gameplay constants and tuning knobs
- `math.ts`: vector/angle helpers
- `render.ts`: Pixi drawing helpers (arena, actors, trails, zone)
- `world.ts`: runtime construction and actor creation
- `simulation.ts`: deterministic frame-step simulation
- `SimplePixiRuntime.ts`: orchestration (init, tick, snapshots, end state)
- `index.ts`: public module exports

## Maintenance rules

- Keep frame loop orchestration in `SimplePixiRuntime.ts` only.
- Add new gameplay rules in `simulation.ts` first, then expose via snapshots.
- Keep rendering side effects in `render.ts` and avoid mixing with UI state.
- Tune constants only in `constants.ts`.
