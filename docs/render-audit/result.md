# Render audit result

- Added a render debug mode enabled by `?debug=1`:
  - On-canvas overlay (FPS/dt, renderer size/resolution/DPR, stage/world children, known vs rendered entities, sample entity positions).
  - Throttled console logs every ~2s with world/camera transforms and a sample entity.
  - Debug shapes in world space: world bounds rect, origin axes, world-viewport rect, and player crosshair.
- Applied minimal hardening so the world cannot silently disappear:
  - Force Pixi canvas to fill the mount node (`position:absolute; width/height:100%`).
  - Tournament starts with server-synced world bounds (avoids extreme zoom-out before first server snapshot).
  - Guard against NaN/Infinity camera transforms.
  - Fail-safe `app.render()` call in the ticker callback.

Expected definition of "fixed": with `?debug=1`, stage/world are non-empty, camera values stay finite, and at least one entity (player) is visible and follows updates for >2 minutes.
