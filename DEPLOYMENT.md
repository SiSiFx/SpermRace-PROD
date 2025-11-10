# Skidr.io Deployment Guide

## Architecture Overview

- **Frontend (Client)**: Deployed on Vercel
- **Backend (Server)**: Deployed on VPS with PM2
- **Blockchain**: Solana mainnet/devnet

## Pre-Deployment Security Checklist

### ✅ Critical Security Fixes Required

Before deploying to production with real cryptocurrency:

1. **Private Key Management** (P0 - CRITICAL)
   - [ ] Generate NEW keypair for production (never reuse dev keys)
   - [ ] Use AWS KMS, Google Cloud KMS, or Azure Key Vault
   - [ ] OR use PM2 encrypted environment variables
   - [ ] Verify `.env` files are in `.gitignore`
   - [ ] Rotate all keys if repository was ever public

2. **Payment Security** (P0 - CRITICAL)
   - [ ] Implement signature deduplication (prevent double-spend)
   - [ ] Add payment processing lock per transaction
   - [ ] Make payout atomic with game state
   - [ ] Test failed payout recovery procedure

3. **Authentication** (P0 - CRITICAL)
   - [ ] Set `WS_UNAUTH_MAX=0` (zero tolerance)
   - [ ] Implement global nonce tracking
   - [ ] Add authentication logging

4. **Input Validation** (P1 - HIGH)
   - [ ] Validate all player inputs (position, acceleration)
   - [ ] Add anti-cheat detection
   - [ ] Implement server-side movement validation

## VPS Deployment (Backend)

### 1. Server Requirements

- **OS**: Ubuntu 20.04+ or Debian 11+
- **RAM**: Minimum 2GB (4GB recommended for 32+ players)
- **CPU**: 2+ cores
- **Storage**: 20GB SSD
- **Network**: 100 Mbps minimum

### 2. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PM2
npm install -g pm2

# Install git
sudo apt install -y git

# Create deployment user (optional but recommended)
sudo adduser deploy
sudo usermod -aG sudo deploy
```

### 3. Clone Repository

```bash
# Switch to deploy user
su - deploy

# Clone repository
git clone https://github.com/your-username/skidr.io.git
cd skidr.io

# Install dependencies
pnpm install
```

### 4. Environment Configuration

```bash
# Copy production environment template
cp packages/server/.env.production.example packages/server/.env.production

# Edit with secure values
nano packages/server/.env.production
```

**CRITICAL**: Use secure secret management:

```bash
# Option 1: PM2 Environment Variables (encrypted)
pm2 set pm2-server-monit:secret_key YOUR_SECRET_KEY

# Option 2: AWS KMS (recommended for production)
# Install AWS CLI and configure
aws kms decrypt --ciphertext-blob fileb://encrypted-key.bin --output text --query Plaintext | base64 --decode

# Option 3: Docker Secrets (if using Docker)
echo "your-secret-key" | docker secret create prize_pool_key -
```

### 5. Build Application

```bash
# Build all packages
pnpm build

# Verify build succeeded
ls -lh packages/server/dist/index.js
ls -lh packages/client/dist/
```

### 6. Configure PM2

Edit `ops/pm2/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'skidr-server',
      script: 'packages/server/dist/index.js',
      cwd: '/home/deploy/skidr.io',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
        SOLANA_RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
        ALLOWED_ORIGINS: 'https://your-game.vercel.app',
        ENABLE_DEV_BOTS: 'false',
        SKIP_ENTRY_FEE: 'false',
        LOG_LEVEL: 'info',
      },
      max_memory_restart: '500M',
      out_file: '/var/log/pm2/skidr-out.log',
      error_file: '/var/log/pm2/skidr-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
```

### 7. Start Server

```bash
# Create log directory
sudo mkdir -p /var/log/pm2
sudo chown -R deploy:deploy /var/log/pm2

# Start with PM2
pm2 start ops/pm2/ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
# Copy and run the command PM2 outputs

# Check status
pm2 status
pm2 logs skidr-server
```

### 8. Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (if using reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow game server port
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable
```

### 9. Setup Reverse Proxy (Optional but Recommended)

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/skidr
```

Add configuration:

```nginx
upstream skidr_backend {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name game.yourdomain.com;

    location / {
        proxy_pass http://skidr_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket timeout
        proxy_read_timeout 75s;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/skidr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 10. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d game.yourdomain.com
```

## Vercel Deployment (Frontend)

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Configure Environment Variables

Create `.env.production` in `packages/client/`:

```bash
# WebSocket URL (your VPS)
VITE_WS_URL=wss://game.yourdomain.com

# Solana Network
VITE_SOLANA_NETWORK=mainnet-beta

# Enable production mode
VITE_NODE_ENV=production
```

### 3. Update Vite Config

Edit `packages/client/vite.config.ts` to remove local proxies:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Disable in production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs
      },
    },
  },
});
```

### 4. Deploy to Vercel

```bash
# From project root
cd packages/client

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

**Or use Vercel Dashboard:**

1. Go to https://vercel.com/new
2. Import GitHub repository
3. Set **Root Directory**: `packages/client`
4. Set **Build Command**: `pnpm build`
5. Set **Output Directory**: `dist`
6. Add Environment Variables (from step 2)
7. Click **Deploy**

### 5. Update CORS on VPS

After Vercel deployment, update VPS environment:

```bash
# Edit PM2 config
nano ops/pm2/ecosystem.config.js

# Update ALLOWED_ORIGINS
ALLOWED_ORIGINS: 'https://your-actual-vercel-url.vercel.app'

# Restart server
pm2 restart skidr-server
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check server is running
curl http://your-vps-ip:8080/health

# Check WebSocket connection
wscat -c ws://your-vps-ip:8080
```

### 2. Test Payment Flow

1. Connect wallet on frontend
2. Join lobby (use devnet for testing first)
3. Submit entry fee
4. Verify transaction on Solscan
5. Confirm player admitted to game
6. Win game and verify payout

### 3. Monitoring Setup

```bash
# Monitor PM2 logs
pm2 logs skidr-server --lines 100

# Monitor system resources
pm2 monit

# Check error logs
tail -f /var/log/pm2/skidr-err.log
```

### 4. Load Testing

```bash
# Install Artillery
npm install -g artillery

# Create load test config (test-load.yml)
artillery run test-load.yml
```

## Maintenance

### Update Deployment

```bash
# On VPS
cd ~/skidr.io
git pull origin main
pnpm install
pnpm build
pm2 restart skidr-server

# On Vercel
# Push to main branch (auto-deploys)
# OR manually: vercel --prod
```

### Backup Prize Pool Wallet

```bash
# Backup keypair securely
gpg -c prize-pool-keypair.json
scp prize-pool-keypair.json.gpg your-backup-location:/
```

### Monitoring & Alerts

Set up alerts for:
- Server downtime
- High memory usage (>400MB)
- Failed payouts
- RPC rate limit errors
- Unusual player behavior

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use KMS** for production keys
3. **Rotate keys** regularly (quarterly)
4. **Enable 2FA** on all admin accounts
5. **Run security audits** before mainnet
6. **Monitor logs** for suspicious activity
7. **Keep dependencies updated**: `pnpm update`
8. **Use HTTPS/WSS** in production
9. **Implement rate limiting** at Nginx level
10. **Backup wallet keypairs** to multiple secure locations

## Troubleshooting

### Server Won't Start

```bash
# Check logs
pm2 logs skidr-server --err

# Check port availability
sudo netstat -tulpn | grep 8080

# Check environment variables
pm2 env 0
```

### WebSocket Connection Failed

```bash
# Check firewall
sudo ufw status

# Check Nginx config
sudo nginx -t

# Test direct connection (bypass Nginx)
wscat -c ws://localhost:8080
```

### Payment Verification Fails

```bash
# Check RPC endpoint
curl https://api.mainnet-beta.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Check wallet balance
solana balance YOUR_PRIZE_POOL_WALLET
```

## Rollback Procedure

```bash
# On VPS
cd ~/skidr.io
git log --oneline # Find previous commit
git checkout <previous-commit-hash>
pnpm install
pnpm build
pm2 restart skidr-server

# On Vercel
# Use Vercel Dashboard -> Deployments -> Rollback
```

## Support

- **Documentation**: See README.md
- **Issues**: GitHub Issues
- **Security**: Report privately to security@yourdomain.com
