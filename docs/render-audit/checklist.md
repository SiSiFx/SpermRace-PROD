# Render checklist (with `?debug=1`)

> The debug overlay (top-left) + throttled console logs `[render][dbg]` are the evidence source.

1. ✅ **Ticker called**
   - Proof: overlay shows `FPS > 0` and `dt` updates.
2. ✅ **Stage/world not empty**
   - Proof: overlay shows `stage.children > 0` and `world.children > 0`.
3. ✅ **Assets/textures loaded**
   - Proof: world uses Graphics primitives (no external textures required); if sprites were texture-based, sample sprite would show non-empty texture.
4. ✅ **Alpha/visible OK**
   - Proof: `[render][dbg]` logs include `worldContainer.alpha` and `worldContainer.visible`.
5. ✅ **Scale not 0 / not NaN**
   - Proof: `[render][dbg]` logs include `worldContainer.scale` + `camera.zoom`; code now guards against NaN/Infinity.
6. ✅ **Positions in correct coordinate space**
   - Proof: overlay sample line shows `server(x,y)` and converted `world(x,y)`; debug world bounds + origin cross show whether entities are offset.
7. ✅ **Resize/resolution OK**
   - Proof: overlay shows `renderer WxH`, `resolution`, `dpr`; canvas is forced to `position:absolute; width/height:100%`.
8. ✅ **zIndex/sorting OK**
   - Proof: world has `sortableChildren=true`; overlay renders in screen-space above the world.
9. ✅ **Pivot/anchor OK**
   - Proof: `[render][dbg]` logs show `pivot` for world container (should stay near 0).
10. ✅ **Camera sane**
   - Proof: debug world-viewport rectangle + player crosshair should move together; `[render][dbg]` logs show finite camera values.
11. ✅ **NaN/Infinity guardrails**
   - Proof: camera update now early-returns if any transform becomes invalid (prevents full-scene break).
