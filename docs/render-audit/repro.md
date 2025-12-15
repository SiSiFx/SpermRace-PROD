# Render repro (client)

- Run: `pnpm -C packages/client dev` then open `http://localhost:5174/`.
- Enter **Practice** or **Tournament** and wait for the game view.
- Symptom reported: the React UI/overlays render, but the Pixi world canvas appears empty (black / no entities visible).
- Use `?debug=1` to enable the render debug overlay and confirm if the world is actually rendering or off-screen.
