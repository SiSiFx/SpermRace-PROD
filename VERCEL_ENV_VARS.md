# Vercel Environment Variables Configuration

## Required Environment Variables

Add these to your Vercel project settings (Settings → Environment Variables):

```bash
# API Configuration
VITE_API_BASE=https://api.spermrace.io

# WebSocket Configuration
VITE_WS_URL=wss://api.spermrace.io

# Solana Network Configuration
VITE_SOLANA_NETWORK=mainnet-beta
VITE_SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# WalletConnect Project ID
VITE_WALLETCONNECT_PROJECT_ID=bb9a0a1b7780594c6a2bf915afe27cae
```

## Steps to Configure

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable above
3. Set scope to "Production" (and "Preview" if needed)
4. Redeploy after adding all variables

## Verification

After deployment, test the following:

1. **Client loads correctly**: https://spermrace.io
2. **Wallet connection works**: Connect with Phantom/Backpack
3. **WebSocket connects**: Check browser console for WS connection
4. **Entry fee transactions**: Test with small amount first

## Health Check Endpoints

```bash
# Server Health
curl https://api.spermrace.io/api/healthz

# Readiness Check
curl https://api.spermrace.io/api/readyz

# Prize Pool Preflight (verify wallet configuration)
curl https://api.spermrace.io/api/prize-preflight
```

## Security Notes

- Never commit `.env` files to git
- Rotate secret keys if exposed
- Monitor Solana wallet balance regularly
- Set up alerts for failed payouts
