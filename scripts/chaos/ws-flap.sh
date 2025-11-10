#!/usr/bin/env bash
# Randomly kill TCP connections to simulate network flapping (requires root and tc/netem)
# CAUTION: Run only in test/staging. This does not fabricate data; it manipulates the network.

set -euo pipefail

IFACE=${1:-eth0}
DURATION=${2:-60}

echo "Applying 2% packet loss and 100ms jitter to ${IFACE} for ${DURATION}s..."
sudo tc qdisc add dev "$IFACE" root netem loss 2% 25% delay 100ms 40ms distribution normal || true
sleep "$DURATION"
echo "Cleaning up netem on ${IFACE}..."
sudo tc qdisc del dev "$IFACE" root netem || true
echo "Done."



