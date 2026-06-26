#!/usr/bin/env bash
# STEP 44: Fresh VM test procedure
# Run this on a fresh Ubuntu 24.04 VM to validate the install path
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

echo "=== Harbr Fresh VM Test ==="
echo ""

# 1. OS check
. /etc/os-release
[ "$ID" = "ubuntu" ] && [ "${VERSION_ID}" = "24.04" ] && pass "Ubuntu 24.04 detected" || fail "Not Ubuntu 24.04"

# 2. Architecture
case "$(uname -m)" in
  x86_64)  pass "amd64 architecture" ;;
  aarch64) pass "arm64 architecture" ;;
  *)       fail "Unsupported architecture: $(uname -m)" ;;
esac

# 3. Root access
[ "$EUID" -eq 0 ] && pass "Running as root" || fail "Not running as root"

# 4. Internet connectivity
curl -fsSL https://google.com > /dev/null && pass "Internet connectivity" || fail "No internet"

# 5. PostgreSQL 16 install
apt-get install -y postgresql postgresql-client 2>/dev/null
pg_isready -q && pass "PostgreSQL running" || fail "PostgreSQL not running"

# 6. Tailscale install
curl -fsSL https://tailscale.com/install.sh | sh 2>/dev/null
which tailscale && pass "Tailscale installed" || fail "Tailscale not installed"

# 7. K3s install
curl -sfL https://get.k3s.io | sh -s - --cluster-init 2>/dev/null
which k3s && pass "K3s installed" || fail "K3s not installed"

# 8. Harbr download and verify
VERSION="${HARBR_VERSION:-v0.1.0}"
ARCH="amd64"
curl -fsSL "https://github.com/arunishshekhar/harbr/releases/download/${VERSION}/harbr-linux-${ARCH}" -o /tmp/harbr-test
file /tmp/harbr-test | grep -q ELF && pass "Harbr binary downloaded" || fail "Harbr binary invalid"

echo ""
echo "=== All fresh VM tests passed ==="
