#!/usr/bin/env python3
"""
SpermRace.io - Quick Automated Deployment
Non-interactive version for testing
"""
import os
import sys

# VPS Configuration
VPS_IP = "93.180.133.94"
VPS_USER = "root"
VPS_PASSWORD = "yELys6TZvJzT!"

# Paths
BASE_DIR = r"C:\Users\SISI\Documents\skidr.io fork"
TARBALL_LOCAL = os.path.join(BASE_DIR, "spermrace-deploy.tar.gz")
DEPLOY_SCRIPT_LOCAL = os.path.join(BASE_DIR, "scripts", "deploy-from-root.sh")

TARBALL_REMOTE = "/tmp/spermrace-deploy.tar.gz"
DEPLOY_SCRIPT_REMOTE = "/tmp/deploy-from-root.sh"

# Default configuration (will prompt if you want)
DEFAULT_DOMAIN = "spermrace.io"
DEFAULT_EMAIL = "admin@spermrace.io"
DEFAULT_SOLANA_RPC = "https://api.devnet.solana.com"  # Using devnet for testing
DEFAULT_PRIZE_WALLET = "11111111111111111111111111111111"  # Placeholder
DEFAULT_PRIZE_SECRET = "dummy-secret-for-testing"  # Placeholder
DEFAULT_VERCEL_ORIGIN = ""

def print_header(text):
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")

def main():
    print_header("SpermRace.io - Quick VPS Deployment")

    # Check dependencies
    try:
        import paramiko
        from scp import SCPClient
    except ImportError:
        print("❌ ERROR: Required packages not installed.")
        print("\nThis should have been installed already.")
        sys.exit(1)

    # Check files exist
    if not os.path.exists(TARBALL_LOCAL):
        print(f"❌ ERROR: Tarball not found at {TARBALL_LOCAL}")
        sys.exit(1)

    if not os.path.exists(DEPLOY_SCRIPT_LOCAL):
        print(f"❌ ERROR: Deploy script not found at {DEPLOY_SCRIPT_LOCAL}")
        sys.exit(1)

    tarball_size = os.path.getsize(TARBALL_LOCAL) / (1024 * 1024)
    print(f"[OK] Tarball found: {tarball_size:.2f} MB")
    print(f"[OK] Deploy script found")
    print()

    # Get configuration
    print("Configuration (press Enter for defaults):")
    print("-" * 70)

    domain = input(f"Domain [{DEFAULT_DOMAIN}]: ").strip() or DEFAULT_DOMAIN
    email = input(f"Email [{DEFAULT_EMAIL}]: ").strip() or DEFAULT_EMAIL
    solana_rpc = input(f"Solana RPC [{DEFAULT_SOLANA_RPC}]: ").strip() or DEFAULT_SOLANA_RPC
    prize_wallet = input(f"Prize Wallet [{DEFAULT_PRIZE_WALLET}]: ").strip() or DEFAULT_PRIZE_WALLET
    prize_secret = input(f"Prize Secret [hidden]: ").strip() or DEFAULT_PRIZE_SECRET
    vercel_origin = input(f"Vercel Origin [{DEFAULT_VERCEL_ORIGIN}]: ").strip() or DEFAULT_VERCEL_ORIGIN

    print()
    print("Deployment Configuration:")
    print(f"  Domain: {domain}")
    print(f"  Email: {email}")
    print(f"  Solana RPC: {solana_rpc}")
    print(f"  Prize Wallet: {prize_wallet}")
    print(f"  Prize Secret: {'*' * len(prize_secret)}")
    print(f"  Vercel Origin: {vercel_origin if vercel_origin else '(none)'}")
    print()

    response = input("Continue with deployment? (y/n): ").lower()
    if response != 'y':
        print("Deployment cancelled.")
        sys.exit(0)

    print()
    print_header("Connecting to VPS")

    # Connect to VPS
    print(f"Connecting to {VPS_USER}@{VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD, timeout=30, banner_timeout=30)
        print("[OK] Connected to VPS\n")

        # Upload tarball
        print_header("Step 1: Upload Tarball")
        print(f"Uploading {tarball_size:.2f} MB to {TARBALL_REMOTE}...")
        with SCPClient(ssh.get_transport(), progress=progress) as scp:
            scp.put(TARBALL_LOCAL, TARBALL_REMOTE)
        print("\n[OK] Tarball uploaded\n")

        # Upload deployment script
        print_header("Step 2: Upload Deployment Script")
        print(f"Uploading deploy script...")
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(DEPLOY_SCRIPT_LOCAL, DEPLOY_SCRIPT_REMOTE)
        print("[OK] Deploy script uploaded\n")

        # Make script executable
        print("Making script executable...")
        ssh.exec_command(f"chmod +x {DEPLOY_SCRIPT_REMOTE}")
        print("[OK] Script is executable\n")

        # Run deployment
        print_header("Step 3: Running Deployment")
        print("Starting deployment on VPS...")
        print("(This will take 5-10 minutes - installing Node.js, building, etc.)")
        print()

        # Prepare deployment command with inputs
        deploy_cmd = f"""bash {DEPLOY_SCRIPT_REMOTE} << 'DEPLOY_INPUT'
{domain}
{email}

{solana_rpc}
{prize_wallet}
{prize_secret}
{vercel_origin}
DEPLOY_INPUT
"""

        # Execute deployment
        stdin, stdout, stderr = ssh.exec_command(deploy_cmd, get_pty=True)

        # Stream output in real-time
        print("=" * 70)
        while True:
            line = stdout.readline()
            if not line:
                break
            print(line, end='')

        # Check exit status
        exit_status = stdout.channel.recv_exit_status()

        print()
        if exit_status == 0:
            print_header("DEPLOYMENT SUCCESSFUL!")
            print(f"[OK] Frontend:       https://{domain}")
            print(f"[OK] WebSocket:      wss://{domain}/ws")
            print(f"[OK] Health Check:   https://{domain}/api/healthz")
            print()
            print("Next Steps:")
            print("  1. Point your domain DNS to: " + VPS_IP)
            print("  2. Wait for DNS propagation (5-30 minutes)")
            print("  3. Visit your site!")
            print()
            print("Useful Commands:")
            print(f"  ssh {VPS_USER}@{VPS_IP}")
            print(f"  pm2 status")
            print(f"  pm2 logs spermrace-server-ws")
            print()
        else:
            print("=" * 70)
            print("❌ Deployment failed with exit code:", exit_status)
            print("=" * 70)
            print("\nCheck the output above for errors.")
            print(f"\nYou can SSH manually to investigate:")
            print(f"  ssh {VPS_USER}@{VPS_IP}")

    except paramiko.AuthenticationException:
        print("❌ ERROR: Authentication failed")
        print("Please check VPS credentials")
        sys.exit(1)
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        ssh.close()

def progress(filename, size, sent):
    """Progress callback for SCP"""
    percent = float(sent) / float(size) * 100
    bar_length = 50
    filled = int(bar_length * percent / 100)
    bar = '█' * filled + '░' * (bar_length - filled)

    sys.stdout.write(f"\r  [{bar}] {percent:.1f}%")
    sys.stdout.flush()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Deployment cancelled by user")
        sys.exit(1)
