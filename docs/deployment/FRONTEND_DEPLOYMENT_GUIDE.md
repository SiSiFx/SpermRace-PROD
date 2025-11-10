## SpermRace.io Frontend – Production Deployment (Vercel)

This guide explains for anyone (no prior context needed) how to deploy the frontend to Vercel and keep `www.spermrace.io` pointing to the latest production build.

### Prerequisites
- Node.js and Vercel CLI installed:
  ```bash
  npm i -g vercel
  ```
- Login or token:
  ```bash
  vercel login
  # or
  export VERCEL_TOKEN="<your-token>"
  ```
- DNS is set (once):
  - `www.spermrace.io` CNAME → `cname.vercel-dns.com`
- Backend API is already live at `https://spermrace.io/api` (on the VPS).

### Environment variables (set once on the Vercel project)
Run these once (already set, but here for reference):
```bash
vercel env add VITE_WS_URL production             # wss://spermrace.io/ws
vercel env add VITE_API_BASE production           # https://spermrace.io/api
vercel env add VITE_SOLANA_NETWORK production     # mainnet-beta
vercel env add VITE_SOLANA_RPC_ENDPOINT production# https://api.mainnet-beta.solana.com
```

### Where to run commands
- The repo root is `/opt/spermrace` on the VPS.
- The frontend code is in `/opt/spermrace/packages/client`.
- The Vercel project for source builds is `spermrace-frontend`.

---

## Quick redeploy after any change (recommended)
Use this when you modify files under `packages/client`.

```bash
cd /opt/spermrace
vercel deploy --prod --yes
```
What this does:
- Uses the repo-root `vercel.json` to install/build the frontend (`packages/client`) with pnpm.
- Publishes `packages/client/dist` as the production deployment.
- If `www.spermrace.io` is attached to the `spermrace-frontend` project, it will automatically point to the latest production deployment.

Verify:
```bash
curl -I https://www.spermrace.io
```

If the domain didn’t move automatically, attach it once:
```bash
# Move/attach the domain to the project (one-time)
vercel domains move www.spermrace.io spermrace-frontend
# Point the domain at the latest prod deploy
vercel alias set <the-new-prod-url> www.spermrace.io
```

---

## Alternative: Deploy a prebuilt static bundle (fallback)
If a source build fails for any reason, you can deploy the already built assets.

```bash
cd /opt/spermrace/packages/client
pnpm build
vercel deploy --prod ./dist
# If needed (one-time), alias the domain:
vercel alias set <dist-prod-url> www.spermrace.io
```

---

## Local testing (optional)
```bash
cd /opt/spermrace/packages/client
pnpm dev
# open http://localhost:5174
```

---

## Troubleshooting
- “Unsupported URL Type \"workspace:*\"” on Vercel: the repo-root `vercel.json` instructs Vercel to build with pnpm. Always deploy from the repo root with `vercel deploy --prod`.
- “No access to domain/Already assigned”: run the command from the Vercel account that owns `www.spermrace.io`, then do a one-time `vercel domains move www.spermrace.io spermrace-frontend`.
- Mobile fit on iPhone: already configured via `viewport-fit=cover` and CSS safe-area insets in `packages/client/index.html` and `packages/client/style.css`.

---

## Summary
- Make changes under `packages/client`.
- Run at repo root: `vercel deploy --prod --yes`.
- `www.spermrace.io` auto-updates if it’s attached to `spermrace-frontend`. If not, run the one-time `domains move` + `alias set`.
