#!/usr/bin/env python3
"""
SpermRace.io - Fully Automated Deployment (No Prompts)
"""
import os
import sys
import time

# VPS Configuration
VPS_IP = "93.180.133.94"
VPS_USER = "root"
VPS_PASSWORD = "yELys6TZvJzT!"

# Deployment Configuration
DOMAIN = "spermrace.io"
EMAIL = "admin@spermrace.io"
SOLANA_RPC = "https://api.devnet.solana.com"  # Using devnet for initial testing
PRIZE_WALLET = "11111111111111111111111111111111"  # Placeholder for testing
PRIZE_SECRET = "test-secret-key"  # Placeholder for testing
VERCEL_ORIGIN = ""  # Optional

# Paths
BASE_DIR = r"C:\Users\SISI\Documents\skidr.io fork"
TARBALL_LOCAL = os.path.join(BASE_DIR, "spermrace-deploy.tar.gz")
DEPLOY_SCRIPT_LOCAL = os.path.join(BASE_DIR, "scripts", "deploy-from-root.sh")

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

    # Check files
    if not os.path.exists(TARBALL_LOCAL):
        print(f"[ERROR] Tarball not found: {TARBALL_LOCAL}")
        sys.exit(1)

    if not os.path.exists(DEPLOY_SCRIPT_LOCAL):
        print(f"[ERROR] Deploy script not found: {DEPLOY_SCRIPT_LOCAL}")
        sys.exit(1)

    tarball_size = os.path.getsize(TARBALL_LOCAL) / (1024 * 1024)
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
            scp.put(TARBALL_LOCAL, TARBALL_REMOTE)
        print("\n[OK] Tarball uploaded\n")

        # Upload script
        print_header("Step 2: Upload Deploy Script")
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(DEPLOY_SCRIPT_LOCAL, DEPLOY_SCRIPT_REMOTE)
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
