#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[harbr]${NC} $1"; }
warn()  { echo -e "${YELLOW}[harbr]${NC} $1"; }
error() { echo -e "${RED}[harbr]${NC} $1" >&2; exit 1; }

detect_install_state() {
  if systemctl is-active --quiet harbrd 2>/dev/null; then echo "running"
  elif [ -f /usr/local/bin/harbr ]; then echo "installed"
  elif command -v k3s &>/dev/null; then echo "partial"
  else echo "clean"
  fi
}

STATE=$(detect_install_state)

if [ "$STATE" != "clean" ]; then
  warn "Existing installation detected (state: $STATE)"
  echo ""
  echo "  Options:"
  echo "  1) Resume/repair installation"
  echo "  2) Upgrade to latest version"
  echo "  3) Fresh install (DELETES ALL DATA)"
  echo "  4) Exit"
  echo ""
  read -rp "Choice [1-4]: " CHOICE
  case $CHOICE in
    1) MODE="resume" ;;
    2) MODE="upgrade" ;;
    3) read -rp "Type DELETE to confirm: " CONF
       [ "$CONF" = "DELETE" ] || { info "Cancelled."; exit 0; }
       MODE="fresh" ;;
    *) exit 0 ;;
  esac
else
  MODE="fresh"
fi

. /etc/os-release
[[ "$ID" == "ubuntu" ]] || error "Ubuntu required. Detected: $PRETTY_NAME"
[[ "$VERSION_ID" == "22.04" || "$VERSION_ID" == "24.04" ]] ||
  error "Ubuntu 22.04 or 24.04 required. Detected: $VERSION_ID"
[ "$EUID" -eq 0 ] || error "Run as root: sudo bash install.sh"

case "$(uname -m)" in
  x86_64)  ARCH="amd64" ;;
  aarch64) ARCH="arm64" ;;
  *)       error "Unsupported architecture: $(uname -m)" ;;
esac

VERSION="${HARBR_VERSION:-$(curl -fsSL https://api.github.com/repos/YOUR_USERNAME/harbr/releases/latest | grep '"tag_name"' | cut -d'"' -f4)}"

info "Downloading Harbr ${VERSION} (${ARCH})..."
curl -fsSL "https://github.com/YOUR_USERNAME/harbr/releases/download/${VERSION}/harbr-linux-${ARCH}" -o /tmp/harbr-new

EXPECTED=$(curl -fsSL "https://github.com/YOUR_USERNAME/harbr/releases/download/${VERSION}/harbr-linux-${ARCH}.sha256")
ACTUAL=$(sha256sum /tmp/harbr-new | awk '{print $1}')
[ "$ACTUAL" = "$EXPECTED" ] || error "SHA256 mismatch! Download may be corrupted."

install /tmp/harbr-new /usr/local/bin/harbr
info "Harbr installed. Launching setup wizard..."
exec /usr/local/bin/harbr setup --mode="$MODE"
