# Edgegap deployment (server)

This repo includes a container build for running the Node server on Edgegap, plus a Vercel `/api/edgegap/session` matchmaker function that keeps the Edgegap token off the client.

## 1) Build and push the image

Build from the repo root:

```bash
docker build -f ops/edgegap/Dockerfile -t <registry>/spermrace-server:<tag> .
docker push <registry>/spermrace-server:<tag>
```

## 2) Configure the Edgegap app/version

In Edgegap, create an app + version pointing at your pushed image and expose the server port:

- **Internal port**: `8080`
- **Protocol**: TCP
- **TLS upgrade**: enable if you want `wss://` from browsers

Minimum env vars for the container:

- `PORT=8080`
- `ALLOWED_ORIGINS=https://your-frontend-domain,...`
- `SOLANA_RPC_ENDPOINT=...`

Production safety flags (recommended):

- `NODE_ENV=production`
- `ENABLE_DEV_BOTS=false`
- `SKIP_ENTRY_FEE=false`

Note: the server defaults its SQLite + audit directory to `./data/` inside the container. On Edgegap this is ephemeral unless you add persistence on their side.

## 3) Configure the matchmaker (Vercel)

The repo defines a Vercel serverless function at `api/edgegap/session.js` that:

- Creates an Edgegap session
- Polls until ready
- Returns `{ wsUrl }` to the client

Set these Vercel env vars (server-side, **not** `VITE_*`):

- `EDGEGAP_TOKEN`
- `EDGEGAP_APP_NAME`
- `EDGEGAP_VERSION_NAME`

Optional:

- `EDGEGAP_WS_SCHEME` (`wss` default)
- `EDGEGAP_WS_PATH` (`/ws` default)
- `EDGEGAP_PORT_KEY` (e.g. `8080` or `80`)

## 4) Keep VPS for testing

For VPS testing/staging, keep using the direct WebSocket path:

- Frontend: set `VITE_NETWORK_BACKEND=websocket`
- Backend: point `VITE_WS_URL` at your VPS (or use same-origin `/ws` with your reverse proxy)

