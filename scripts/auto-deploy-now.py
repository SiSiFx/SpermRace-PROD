#!/usr/bin/env python3
"""
SpermRace.io - Fully Automated Deployment (No Prompts)
"""
import os
import sys
import time
from pathlib import Path

# VPS Configuration
VPS_IP = (os.environ.get("VPS_IP") or "").strip()
VPS_USER = (os.environ.get("VPS_USER") or "root").strip()
VPS_PASSWORD = (os.environ.get("VPS_PASSWORD") or "").strip()

# Deployment Configuration
DOMAIN = (os.environ.get("DEPLOY_DOMAIN") or "").strip()
EMAIL = (os.environ.get("DEPLOY_EMAIL") or "").strip()
SOLANA_RPC = (os.environ.get("SOLANA_RPC_ENDPOINT") or "https://api.mainnet-beta.solana.com").strip()
PRIZE_WALLET = (os.environ.get("PRIZE_POOL_WALLET") or "").strip()
PRIZE_SECRET = (os.environ.get("PRIZE_POOL_SECRET_KEY") or "").strip()
VERCEL_ORIGIN = (os.environ.get("VERCEL_ORIGIN") or "").strip()

# Paths
REPO_ROOT = Path(__file__).resolve().parents[1]
TARBALL_LOCAL = Path(os.environ.get("TARBALL_LOCAL") or (REPO_ROOT / "spermrace-deploy.tar.gz"))
DEPLOY_SCRIPT_LOCAL = Path(os.environ.get("DEPLOY_SCRIPT_LOCAL") or (REPO_ROOT / "scripts" / "deploy-from-root.sh"))

TARBALL_REMOTE = "/tmp/spermrace-deploy.tar.gz"
DEPLOY_SCRIPT_REMOTE = "/tmp/deploy-from-root.sh"

def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")

def main():
    print_header("SpermRace.io - Automated VPS Deployment")

    # Check dependencies
    try:
        import paramiko
        from scp import SCPClient
    except ImportError:
        print("[ERROR] Required packages not installed.")
        sys.exit(1)

    missing = []
    if not VPS_IP:
        missing.append("VPS_IP")
    if not VPS_PASSWORD:
        missing.append("VPS_PASSWORD")
    if not DOMAIN:
        missing.append("DEPLOY_DOMAIN")
    if not EMAIL:
        missing.append("DEPLOY_EMAIL")
    if not PRIZE_WALLET:
        missing.append("PRIZE_POOL_WALLET")
    if not PRIZE_SECRET:
        missing.append("PRIZE_POOL_SECRET_KEY")
    if missing:
        print("[ERROR] Missing required env vars:", ", ".join(missing))
        sys.exit(1)

    # Check files
    if not TARBALL_LOCAL.exists():
        print(f"[ERROR] Tarball not found: {TARBALL_LOCAL}")
        sys.exit(1)

    if not DEPLOY_SCRIPT_LOCAL.exists():
        print(f"[ERROR] Deploy script not found: {DEPLOY_SCRIPT_LOCAL}")
        sys.exit(1)

    tarball_size = TARBALL_LOCAL.stat().st_size / (1024 * 1024)
    print(f"[OK] Tarball: {tarball_size:.2f} MB")
    print(f"[OK] Deploy script found")
    print()

    print("Deployment Configuration:")
    print(f"  VPS IP: {VPS_IP}")
    print(f"  Domain: {DOMAIN}")
    print(f"  Email: {EMAIL}")
    print(f"  Solana: {SOLANA_RPC}")
    print(f"  Wallet: {PRIZE_WALLET}")
    print()

    print_header("Connecting to VPS")
    print(f"Connecting to {VPS_USER}@{VPS_IP}...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD, timeout=30)
        print("[OK] Connected\n")

        # Upload tarball
        print_header("Step 1: Upload Tarball")
        print(f"Uploading {tarball_size:.2f} MB...")
        with SCPClient(ssh.get_transport(), progress=progress) as scp:
            scp.put(str(TARBALL_LOCAL), TARBALL_REMOTE)
        print("\n[OK] Tarball uploaded\n")

        # Upload script
        print_header("Step 2: Upload Deploy Script")
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(str(DEPLOY_SCRIPT_LOCAL), DEPLOY_SCRIPT_REMOTE)
        print("[OK] Script uploaded\n")

        # Make executable
        ssh.exec_command(f"chmod +x {DEPLOY_SCRIPT_REMOTE}")
        time.sleep(1)

        # Run deployment
        print_header("Step 3: Running Deployment")
        print("This will take 5-10 minutes...")
        print("=" * 70)

        deploy_cmd = f"""bash {DEPLOY_SCRIPT_REMOTE} << 'DEPLOY_INPUT'
{DOMAIN}
{EMAIL}

{SOLANA_RPC}
{PRIZE_WALLET}
{PRIZE_SECRET}
{VERCEL_ORIGIN}
DEPLOY_INPUT
"""

        stdin, stdout, stderr = ssh.exec_command(deploy_cmd, get_pty=True)

        # Stream output
        while True:
            line = stdout.readline()
            if not line:
                break
            # Handle encoding issues with emojis
            try:
                print(line, end='')
            except UnicodeEncodeError:
                print(line.encode('ascii', 'ignore').decode('ascii'), end='')

        exit_status = stdout.channel.recv_exit_status()

        print()
        if exit_status == 0:
            print_header("DEPLOYMENT SUCCESSFUL!")
            print(f"[OK] Frontend:    https://{DOMAIN}")
            print(f"[OK] WebSocket:   wss://{DOMAIN}/ws")
            print(f"[OK] Health:      https://{DOMAIN}/api/healthz")
            print()
            print("Next Steps:")
            print(f"  1. Point DNS for {DOMAIN} to {VPS_IP}")
            print("  2. Wait 5-30 minutes for DNS propagation")
            print("  3. Visit your site!")
            print()
            print("Management:")
            print(f"  ssh {VPS_USER}@{VPS_IP}")
            print("  pm2 status")
            print("  pm2 logs spermrace-server-ws")
            print()
        else:
            print("=" * 70)
            print(f"[ERROR] Deployment failed: exit code {exit_status}")
            print("=" * 70)

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        ssh.close()

def progress(filename, size, sent):
    """Progress bar"""
    percent = float(sent) / float(size) * 100
    bar_len = 50
    filled = int(bar_len * percent / 100)
    bar = '#' * filled + '-' * (bar_len - filled)
    sys.stdout.write(f"\r  [{bar}] {percent:.1f}%")
    sys.stdout.flush()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[CANCELLED]")
        sys.exit(1)
