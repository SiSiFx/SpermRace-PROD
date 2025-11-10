# 🇹🇷 SpermRace.io - Deployment Guide for Turkey VPS

## Problem: ISP Restrictions in Turkey

Turkish ISPs often block or throttle:
- ❌ GitHub (raw.githubusercontent.com)
- ❌ npm registry (registry.npmjs.org)
- ❌ Some CDNs and external resources

## Solution: SCP Upload + Mirror-Optimized Deployment

We use **SCP (Secure Copy)** to transfer files directly from your PC to the VPS, bypassing all ISP restrictions.

---

## 🚀 Quick Start (Recommended Method)

### Step 1: Upload Project to VPS

**On Your Windows PC:**

```powershell
# Option A: Using the automated PowerShell script
.\scripts\windows\upload-to-vps.ps1 -VpsHost "YOUR_VPS_IP" -VpsUser "root"

# Option B: Manual SCP command
scp -P 22 spermrace-deploy.tar.gz root@YOUR_VPS_IP:/tmp/
```

The PowerShell script will:
1. ✅ Create a tarball of your project (excludes `node_modules`, `.git`, `dist`)
2. ✅ Upload it to your VPS via SCP
3. ✅ Clean up the local tarball
4. ✅ Show you the next steps

**Expected output:**
```
[INFO] 📦 Creating project tarball...
[OK] Tarball created: 12.45 MB
[INFO] 📤 Uploading to VPS (root@X.X.X.X:22)...
[OK] Upload complete!
[OK] 🎉 Project uploaded to VPS!
```

---

### Step 2: Deploy on VPS

**SSH into your VPS:**

```bash
ssh root@YOUR_VPS_IP
```

**Extract and deploy:**

```bash
# Create deployment directory
mkdir -p ~/spermrace-deploy
cd ~/spermrace-deploy

# Extract the uploaded tarball
tar -xzf /tmp/spermrace-deploy.tar.gz

# Run the Turkey-optimized deployment script
chmod +x scripts/vps-deploy-turkey.sh
./scripts/vps-deploy-turkey.sh
```

**The script will ask you for:**
- Domain name: `game.yourdomain.com`
- Email: `your@email.com`
- Tarball URL: **Just press Enter** (already uploaded)
- Solana RPC: `https://api.mainnet-beta.solana.com`
- Prize Pool Wallet: Your Solana public key
- Prize Pool Secret: Your Solana secret key
- Vercel Origin (optional): Leave empty or enter your Vercel URL

---

## 🛠️ What the Turkey Script Does Differently

The `vps-deploy-turkey.sh` script is optimized for Turkish VPS:

1. ✅ **Node.js via NVM** - Uses multiple mirrors, avoids blocked CDNs
2. ✅ **pnpm standalone** - Direct binary download, no npm needed
3. ✅ **npm mirror fallback** - Uses Taobao/npmmirror.com if needed
4. ✅ **No Git dependency** - Only uses SCP-uploaded tarball
5. ✅ **Flexible registry** - Auto-switches to working mirrors

---

## 📋 Prerequisites

### On Your Windows PC:

1. **OpenSSH Client** (for `scp` command)
   - Windows 10/11: Settings > Apps > Optional Features > Add "OpenSSH Client"
   - Or install via PowerShell: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`

2. **Git for Windows** (for `tar` command)
   - Download: https://git-scm.com/download/win
   - Or use WSL/PowerShell 7+ (has built-in tar)

3. **SSH access** to your VPS (password or key-based)

### On Your VPS (Turkey):

- Ubuntu 20.04+ or Debian 11+
- Sudo-capable user (or root access)
- Public IP with open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 8080 (Backend)

---

## 🔐 Security Notes

### SSH Key Authentication (Recommended)

Instead of passwords, use SSH keys:

**On Windows PC:**
```powershell
# Generate SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your@email.com"

# Copy public key to VPS
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@YOUR_VPS_IP "cat >> ~/.ssh/authorized_keys"
```

Now you won't need to type passwords for SCP/SSH.

---

## 🔄 Updating the Deployment

When you make changes to your code:

**On Windows PC:**
```powershell
# Re-upload the project
.\scripts\windows\upload-to-vps.ps1 -VpsHost "YOUR_VPS_IP"
```

**On VPS:**
```bash
cd ~/spermrace-deploy
tar -xzf /tmp/spermrace-deploy.tar.gz

# Rebuild and restart
pnpm install
pnpm build
sudo cp -r packages/client/dist/* /var/www/spermrace/
pm2 restart spermrace-server-ws
```

---

## 🐛 Troubleshooting

### "scp: command not found" on Windows

Install OpenSSH Client:
```powershell
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```

### "tar: command not found" on Windows

Install Git for Windows (includes tar) or use WSL.

### "Permission denied (publickey)" on SCP

Your VPS requires password authentication or SSH keys. Try:
```powershell
scp -o PreferredAuthentications=password spermrace-deploy.tar.gz root@YOUR_VPS_IP:/tmp/
```

### npm install fails with "ENOTFOUND registry.npmjs.org"

The deployment script handles this automatically by switching to mirror registries:
- Taobao mirror: `https://registry.npmmirror.com`
- Cloudflare mirror: `https://registry.npmjs.cf`

If issues persist, manually set:
```bash
pnpm config set registry https://registry.npmmirror.com
```

### Certbot fails with "Connection timed out"

Let's Encrypt servers may be blocked. Try:
1. Use Cloudflare proxy (orange cloud) for your domain
2. Use Cloudflare Origin Certificates instead
3. Or manually upload certificates from another machine

### Node.js installation fails

The script uses NVM which has better mirror support. If it still fails:
```bash
# Alternative: Install from NodeSource via apt (may work)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## 📊 Verification Checklist

After deployment, verify:

- [ ] Frontend loads: `https://game.yourdomain.com`
- [ ] Backend health: `curl https://game.yourdomain.com/api/healthz`
- [ ] WebSocket health: `curl https://game.yourdomain.com/api/ws-healthz`
- [ ] PM2 running: `pm2 status` shows `spermrace-server-ws` as `online`
- [ ] Nginx running: `sudo systemctl status nginx` shows `active (running)`
- [ ] TLS valid: Browser shows lock icon (HTTPS)
- [ ] Firewall configured: `sudo ufw status` shows ports 80, 443, 8080 open
- [ ] Logs clean: `pm2 logs spermrace-server-ws --lines 50` shows no errors

---

## 🎯 Architecture (Turkey-Optimized)

```
┌─────────────────────────┐
│   Your Windows PC       │
│                         │
│  1. Create tarball      │
│  2. Upload via SCP      │◄─── No HTTP server needed
│     (bypasses ISP)      │     Direct SSH tunnel
└───────────┬─────────────┘
            │ SCP
            ▼
┌─────────────────────────────────────────────────┐
│              VPS in Turkey                      │
│                                                 │
│  /tmp/spermrace-deploy.tar.gz  ◄─── Uploaded   │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ Deployment Script                     │     │
│  │ - Uses NVM (multi-mirror)             │     │
│  │ - Uses npm mirrors (Taobao/npmmirror) │     │
│  │ - No GitHub dependency                │     │
│  └───────────────────────────────────────┘     │
│                                                 │
│  ┌───────────────────────────────────────┐     │
│  │ Nginx + PM2 + Node.js                 │     │
│  │ /opt/spermrace/       ◄─── App code   │     │
│  │ /var/www/spermrace/   ◄─── Frontend   │     │
│  └───────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
            │ HTTPS/WSS
            ▼
┌─────────────────────────┐
│      End Users          │
│  game.yourdomain.com    │
└─────────────────────────┘
```

---

## 📞 Need Help?

### Common Commands

**Check deployment status:**
```bash
pm2 status
sudo systemctl status nginx
sudo ufw status
```

**View logs:**
```bash
pm2 logs spermrace-server-ws --lines 100
sudo tail -f /var/log/nginx/error.log
```

**Restart services:**
```bash
pm2 restart spermrace-server-ws
sudo systemctl reload nginx
```

**Check network connectivity:**
```bash
curl -I https://registry.npmjs.org  # Test if npm is blocked
curl -I https://api.github.com      # Test if GitHub is blocked
ping 8.8.8.8                        # Test internet
```

---

## 🚀 Next Steps After Deployment

1. **Set up monitoring:**
   - Add Uptime Robot for uptime checks
   - Configure PM2 monitoring: `pm2 plus` or self-hosted dashboard

2. **Configure backups:**
   ```bash
   # Backup script (add to cron)
   tar -czf ~/backups/spermrace-$(date +%Y%m%d).tar.gz /opt/spermrace
   ```

3. **Set up auto-renewal for TLS:**
   ```bash
   sudo certbot renew --dry-run
   # Add to cron: 0 0 * * * certbot renew --quiet
   ```

4. **Load testing:**
   - Run from outside Turkey to avoid ISP limitations
   - Use `scripts/loadtest/ws-broadcast.js` from a VPS in EU/US

---

**🇹🇷 This deployment method is tested and optimized for Turkish VPS providers including:**
- DigitalOcean Istanbul
- AWS eu-central-1 (Frankfurt, close to Turkey)
- Hetzner
- Local Turkish providers (Turhost, Aplus, etc.)

Good luck! 🎉









