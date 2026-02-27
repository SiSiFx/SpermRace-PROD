#!/usr/bin/env python3
"""
Upload tarball and deploy SpermRace.io to Turkey VPS
"""
import os
import sys

# VPS configuration (read from environment; do not hardcode secrets)
VPS_IP = os.environ.get("VPS_IP")
VPS_USER = os.environ.get("VPS_USER", "root")
VPS_PASSWORD = os.environ.get("VPS_PASSWORD")

# Paths (repo‑relative by default; override via env if needed)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
TARBALL_LOCAL = os.environ.get("TARBALL_LOCAL", os.path.join(REPO_ROOT, "spermrace-deploy.tar.gz"))
TARBALL_REMOTE = os.environ.get("TARBALL_REMOTE", "/tmp/spermrace-deploy.tar.gz")
DEPLOY_SCRIPT = os.environ.get("DEPLOY_SCRIPT", os.path.join(REPO_ROOT, "scripts", "vps-deploy-turkey.sh"))

def main():
    print("=" * 70)
    print("  SpermRace.io VPS Deployment Automation")
    print("=" * 70)
    print()

    # Check if paramiko is installed
    try:
        import paramiko
        from scp import SCPClient
    except ImportError:
        print("ERROR: Required packages not installed.")
        print("Please run: pip install paramiko scp")
        sys.exit(1)

    # Validate configuration
    if not VPS_IP or not VPS_PASSWORD:
        print("ERROR: Set VPS_IP and VPS_PASSWORD in environment (no secrets in code).")
        sys.exit(1)

    # Check if tarball exists
    if not os.path.exists(TARBALL_LOCAL):
        print(f"ERROR: Tarball not found at {TARBALL_LOCAL}")
        sys.exit(1)

    tarball_size = os.path.getsize(TARBALL_LOCAL) / (1024 * 1024)
    print(f"✓ Tarball found: {tarball_size:.2f} MB")
    print()

    # Connect to VPS
    print(f"Connecting to {VPS_IP}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASSWORD, timeout=30)
        print("✓ Connected to VPS")
        print()

        # Upload tarball
        print(f"Uploading tarball to {TARBALL_REMOTE}...")
        with SCPClient(ssh.get_transport(), progress=progress) as scp:
            scp.put(TARBALL_LOCAL, TARBALL_REMOTE)
        print()
        print("✓ Upload complete")
        print()

        # Verify upload
        stdin, stdout, stderr = ssh.exec_command(f"ls -lh {TARBALL_REMOTE}")
        output = stdout.read().decode()
        if output:
            print("Uploaded file:")
            print(output.strip())
            print()

        # Prompt for deployment
        print("=" * 70)
        print("READY TO DEPLOY")
        print("=" * 70)
        print()
        print("The tarball has been uploaded to your VPS.")
        print()
        print("To complete deployment, run the following commands:")
        print()
        print(f"  ssh {VPS_USER}@{VPS_IP}")
        print(f"  bash <(curl -fsSL https://raw.githubusercontent.com/yourusername/spermrace/main/scripts/vps-deploy-turkey.sh)")
        print()
        print("OR manually:")
        print()
        print(f"  cd /tmp")
        print(f"  # Upload the vps-deploy-turkey.sh script to VPS")
        print(f"  bash vps-deploy-turkey.sh")
        print()

        # Ask if user wants to start interactive session
        response = input("Start SSH session now? (y/n): ").lower()
        if response == 'y':
            print()
            print("Starting interactive SSH session...")
            print("(Use 'exit' to disconnect)")
            print()
            import subprocess
            subprocess.call(f"ssh {VPS_USER}@{VPS_IP}", shell=True)

    except paramiko.AuthenticationException:
        print("ERROR: Authentication failed. Please check credentials.")
        sys.exit(1)
    except paramiko.SSHException as e:
        print(f"ERROR: SSH connection failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        ssh.close()

def progress(filename, size, sent):
    """Progress callback for SCP"""
    percent = float(sent) / float(size) * 100
    sys.stdout.write(f"\r  {filename}: {percent:.1f}% ({sent}/{size} bytes)")
    sys.stdout.flush()

if __name__ == "__main__":
    main()
