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
if [ -f /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
fi
if [ "$ID" = "ubuntu" ] && [ "${VERSION_ID}" = "24.04" ]; then
  pass "Ubuntu 24.04 detected"
else
  fail "Not Ubuntu 24.04"
fi

# 2. Architecture
case "$(uname -m)" in
  x86_64)  pass "amd64 architecture" ;;
  aarch64) pass "arm64 architecture" ;;
  *)       fail "Unsupported architecture: $(uname -m)" ;;
esac

# 3. Root access
if [ "$EUID" -eq 0 ]; then
  pass "Running as root"
else
  fail "Not running as root"
fi

# 4. Internet connectivity
if curl -fsSL https://google.com > /dev/null; then
  pass "Internet connectivity"
else
  fail "No internet"
fi

# 5. PostgreSQL 16 install
apt-get install -y postgresql postgresql-client 2>/dev/null
if pg_isready -q; then
  pass "PostgreSQL running"
else
  fail "PostgreSQL not running"
fi

# 6. Tailscale install
curl -fsSL https://tailscale.com/install.sh | sh 2>/dev/null
if which tailscale; then
  pass "Tailscale installed"
else
  fail "Tailscale not installed"
fi

# 7. K3s install
curl -sfL https://get.k3s.io | sh -s - --cluster-init 2>/dev/null
if which k3s; then
  pass "K3s installed"
else
  fail "K3s not installed"
fi

# 8. Harbr download and verify
VERSION="${HARBR_VERSION:-v0.1.0}"
ARCH="amd64"
curl -fsSL "https://github.com/arunishshekhar/harbr/releases/download/${VERSION}/harbr-linux-${ARCH}" -o /tmp/harbr-test
if file /tmp/harbr-test | grep -q ELF; then
  pass "Harbr binary downloaded"
else
  fail "Harbr binary invalid"
fi

echo ""
echo "=== All fresh VM tests passed ==="
