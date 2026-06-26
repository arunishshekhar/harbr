# Harbr

Homelab Application Deployment Platform — deploy any app on your own hardware with one command.

## Features

- **One-command deploy** — git push triggers build + deploy via webhooks
- **50+ templates** — Next.js, Postgres, WordPress, Ollama, Jellyfin, and more
- **High availability** — Cloudflare Tunnel failover, Longhorn replicated storage
- **Self-hosted** — runs on your hardware via K3s, no cloud vendor lock-in
- **Built-in monitoring** — Loki logs, Prometheus metrics, system alerts
- **Access modes** — Cloudflare Tunnel (default), Direct DNS-01, or Local-only

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  React UI   │────▶│  NestJS API  │◀────│  PostgreSQL  │
│  (Browser)  │     │  (K8s Pod)   │     │  (Host/Virtual Machine)  │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐     ┌──────────────┐
                    │  BullMQ      │◀───▶│  Redis       │
                    │  Worker Pod  │     │  (K8s+Dokploy Volume)  │
                    └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Kaniko      │
                    │  Build Job   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐     ┌──────────────┐
                    │  Registry    │     │  K3s + Cilium│
                    │  Pod         │     │  + Longhorn  │
                    └──────────────┘     └──────────────┘
```

## Quick Start

### Prerequisites

- 2+ nodes running Ubuntu 22.04 or 24.04
- 4GB RAM, 2 CPUs, 20GB disk per node
- Tailscale installed and authenticated
- Cloudflare account with a domain (for Tunnel mode)

### Install

```bash
# On the primary node
curl -fsSL https://github.com/arunishshekhar/harbr/releases/latest/download/harbr-linux-amd64 -o harbr
sudo install harbr /usr/local/bin/
sudo harbr setup

# On worker nodes
sudo harbr join <join-token-from-primary>
```

The install script is idempotent — run it again to resume, upgrade, or reinstall.

### Deploy Your First App

```bash
# Via CLI
harbr projects create --name myapp --git https://github.com/user/myapp.git --port 3000

# Via Web UI
# Open your Harbr dashboard (URL shown after setup) → Deploy → fill in details

# Via Git push (after configuring webhook)
git push origin main  # triggers auto-build and deploy
```

## Project Structure

```
harbr/
├── daemon/           # Go CLI + background daemon (harbr + harbrd)
├── api/              # NestJS REST API + BullMQ worker
├── ui/               # React dashboard (Vite)
├── k8s/              # Kubernetes manifests
├── templates/        # 42 application templates
├── migrations/       # PostgreSQL schema (15 migrations)
├── scripts/          # Install, migrate, setup scripts
└── .github/          # CI/CD pipeline
```

## All 35 Audit Fixes

| ID | Issue | Fix |
|---|---|---|
| C1 | No K8s Service resource | Every deploy creates Deployment + Service |
| C2 | No port field | `port` required on all projects |
| C3 | Tunnel failover broken | Both nodes run cloudflared as replicas |
| C4 | Private repos unsupported | git_credentials_secret + SSH/token auth in Kaniko |
| C5 | Redis SPOF | AOF persistence on Longhorn PVC + stuck-job reconciler |
| C6 | Reconciler conflicts | project_status enum; reconciler skips building/deploying |
| C7 | Caddy certs lost | Longhorn PVC mounted at cert storage path |
| C8 | DB string not surfaced | db_connections table + inject feature |
| A1 | SSL redundant in tunnel | Tunnel=Cloudflare edge; Direct=DNS-01 only |
| A2 | Single CF token too broad | dns_token + tunnel_token separate secrets |
| M1 | No SSH key | ED25519 keygen in join flow |
| M2 | Logs undefined | Loki + Promtail, 30-day retention |
| M3 | Template deps undefined | Stack deploy mode + auto connection injection |
| M4 | No probes | healthcheck_path + healthcheck_port required |
| M5 | Webhook not idempotent | X-GitHub-Delivery stored in webhook_deliveries |
| M6 | Build cache unbounded | Weekly cleanup cron + 80% storage alert |
| M7 | Audit log unbounded | Monthly partitions + 90-day auto-drop |
| S1 | Caddy admin exposed | CiliumNetworkPolicy restricts port 2019 |
| S2 | JWT not revocable | jwt_blocklist table with jti-based revocation |
| S3 | Proxy blocks ports, not CIDRs | Blocks K3s pod/service + Tailscale CIDRs |
| S4 | Build secrets not injectable | build_secrets_secret mounted in Kaniko |

## Development

```bash
# API
cd api && npm install && npm run start:dev

# UI
cd ui && npm install && npm run dev

# Daemon
cd daemon && go run ./cmd/harbr

# Tests
cd api && npm test              # Unit tests
cd api && npm run test:e2e      # Integration + security + failure tests
cd daemon && go test ./...      # Go tests
```

## License

MIT
