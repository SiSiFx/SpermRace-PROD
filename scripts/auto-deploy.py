#!/usr/bin/env python3
"""
SpermRace.io - Automated VPS Deployment
Uploads tarball and deployment script, then runs deployment
"""
import os
import sys
import time

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
        print("❌ ERROR: Required packages not installed.")
        print("\nPlease run:")
        print("  pip install paramiko scp")
        sys.exit(1)

    # Check files exist
    if not os.path.exists(TARBALL_LOCAL):
        print(f"❌ ERROR: Tarball not found at {TARBALL_LOCAL}")
        sys.exit(1)

    if not os.path.exists(DEPLOY_SCRIPT_LOCAL):
        print(f"❌ ERROR: Deploy script not found at {DEPLOY_SCRIPT_LOCAL}")
        sys.exit(1)

    tarball_size = os.path.getsize(TARBALL_LOCAL) / (1024 * 1024)
    print(f"✓ Tarball found: {tarball_size:.2f} MB")
    print(f"✓ Deploy script found")
    print()

    # Get deployment configuration
    print("Deployment Configuration:")
    print("-" * 70)
    domain = input("Domain name (e.g., spermrace.io): ").strip()
    if not domain:
        print("❌ Domain is required")
        sys.exit(1)

    email = input("Email for Let's Encrypt: ").strip()
    if not email:
        print("❌ Email is required")
        sys.exit(1)

    solana_rpc = input("Solana RPC [https://api.mainnet-beta.solana.com]: ").strip()
    if not solana_rpc:
        solana_rpc = "https://api.mainnet-beta.solana.com"

    prize_wallet = input("Prize Pool Wallet (public key): ").strip()
    if not prize_wallet:
        print("❌ Prize pool wallet is required")
        sys.exit(1)

    prize_secret = input("Prize Pool Secret Key: ").strip()
    if not prize_secret:
        print("❌ Prize pool secret is required")
        sys.exit(1)

    vercel_origin = input("Additional frontend origin (optional): ").strip()

    print()
    print_header("Connecting to VPS")

    # Connect to VPS
    print(f"Connecting to {VPS_USER}@{VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD, timeout=30)
        print("✓ Connected to VPS\n")

        # Upload tarball
        print_header("Step 1: Upload Tarball")
        print(f"Uploading {tarball_size:.2f} MB to {TARBALL_REMOTE}...")
        with SCPClient(ssh.get_transport(), progress=progress) as scp:
            scp.put(TARBALL_LOCAL, TARBALL_REMOTE)
        print("\n✓ Tarball uploaded\n")

        # Upload deployment script
        print_header("Step 2: Upload Deployment Script")
        print(f"Uploading deploy script...")
        with SCPClient(ssh.get_transport()) as scp:
            scp.put(DEPLOY_SCRIPT_LOCAL, DEPLOY_SCRIPT_REMOTE)
        print("✓ Deploy script uploaded\n")

        # Make script executable
        print("Making script executable...")
        ssh.exec_command(f"chmod +x {DEPLOY_SCRIPT_REMOTE}")
        print("✓ Script is executable\n")

        # Run deployment
        print_header("Step 3: Running Deployment")
        print("Starting deployment on VPS...")
        print("(This will take several minutes)")
        print()

        # Prepare deployment command with inputs
        deploy_cmd = f"""
bash {DEPLOY_SCRIPT_REMOTE} << 'DEPLOY_INPUT'
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
        while True:
            line = stdout.readline()
            if not line:
                break
            print(line, end='')

        # Check exit status
        exit_status = stdout.channel.recv_exit_status()

        print()
        if exit_status == 0:
            print_header("🎉 DEPLOYMENT SUCCESSFUL!")
            print(f"✓ Frontend:       https://{domain}")
            print(f"✓ WebSocket:      wss://{domain}/ws")
            print(f"✓ Health Check:   https://{domain}/api/healthz")
            print()
            print("Useful Commands:")
            print(f"  ssh {VPS_USER}@{VPS_IP}")
            print(f"  pm2 status")
            print(f"  pm2 logs spermrace-server-ws")
            print()
        else:
            print("❌ Deployment failed with exit code:", exit_status)
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
    bar_length = 40
    filled = int(bar_length * percent / 100)
    bar = '█' * filled + '░' * (bar_length - filled)

    sys.stdout.write(f"\r  [{bar}] {percent:.1f}% ({sent}/{size} bytes)")
    sys.stdout.flush()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Deployment cancelled by user")
        sys.exit(1)
