#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[harbr]${NC} $1"; }
error() { echo -e "${RED}[harbr]${NC} $1" >&2; exit 1; }

[ "$EUID" -eq 0 ] || error "Run as root: sudo bash setup-tailscale.sh"

if command -v tailscale &>/dev/null; then
  info "Tailscale already installed. Status:"
  tailscale status
  exit 0
fi

curl -fsSL https://tailscale.com/install.sh | sh

info "Tailscale installed. Join your tailnet:"
echo "  sudo tailscale up --accept-routes --advertise-routes=10.42.0.0/16,10.43.0.0/16"
echo ""
echo "After joining, note your 100.x.x.x IP for K3s configuration."
