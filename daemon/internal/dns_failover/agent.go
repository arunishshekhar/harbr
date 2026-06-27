package dns_failover

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

// Agent monitors peer node health and triggers Cloudflare DNS failover
// after 3 consecutive unreachability checks (direct mode only).
type Agent struct {
	cfg       *config.Config
	logger    *zap.Logger
	db        *pgxpool.Pool
	failCount map[string]int
	client    *http.Client
}

func New(cfg *config.Config, logger *zap.Logger) *Agent {
	return &Agent{
		cfg:       cfg,
		logger:    logger,
		failCount: make(map[string]int),
		client:    &http.Client{Timeout: 8 * time.Second},
	}
}

func (a *Agent) Start(ctx context.Context) {
	if a.cfg.Node.AccessMode == "tunnel" {
		a.logger.Info("skipping DNS failover: running in tunnel mode")
		return
	}
	a.logger.Info("DNS failover agent starting (mode: direct)")

	// Connect to Postgres to read peer node IPs
	if dsn := a.cfg.PostgresDSN(); dsn != "" {
		db, err := pgxpool.New(ctx, dsn)
		if err == nil {
			a.db = db
			defer a.db.Close()
		} else {
			a.logger.Warn("postgres unavailable for DNS failover peer discovery", zap.Error(err))
		}
	}

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			a.checkNodes(ctx)
		}
	}
}

func (a *Agent) checkNodes(ctx context.Context) {
	peers := a.getPeerIPs(ctx)
	for _, peer := range peers {
		if peer.tailscaleIP == a.cfg.Node.TailscaleIP || peer.tailscaleIP == "" {
			continue
		}
		if a.isReachable(peer.tailscaleIP) {
			a.failCount[peer.tailscaleIP] = 0
			continue
		}
		a.failCount[peer.tailscaleIP]++
		a.logger.Warn("peer node unreachable",
			zap.String("node", peer.name),
			zap.String("ip", peer.tailscaleIP),
			zap.Int("consecutive_fails", a.failCount[peer.tailscaleIP]))

		if a.failCount[peer.tailscaleIP] >= 3 {
			a.logger.Error("initiating DNS failover",
				zap.String("failed_node", peer.name),
				zap.String("failed_ip", peer.tailscaleIP))
			a.performFailover(ctx, peer.tailscaleIP)
			a.failCount[peer.tailscaleIP] = 0
		}
	}
}

type peerNode struct {
	name        string
	tailscaleIP string
}

func (a *Agent) getPeerIPs(ctx context.Context) []peerNode {
	if a.db == nil {
		return nil
	}
	rows, err := a.db.Query(ctx,
		"SELECT name, tailscale_ip FROM nodes WHERE status = 'online' AND tailscale_ip IS NOT NULL")
	if err != nil {
		return nil
	}
	defer rows.Close()
	var peers []peerNode
	for rows.Next() {
		var p peerNode
		if err := rows.Scan(&p.name, &p.tailscaleIP); err == nil {
			peers = append(peers, p)
		}
	}
	return peers
}

func (a *Agent) isReachable(ip string) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:7700", ip), 5*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func (a *Agent) performFailover(ctx context.Context, failedIP string) {
	publicIP, err := a.getPublicIP()
	if err != nil {
		a.logger.Error("cannot get own public IP for failover", zap.Error(err))
		return
	}

	token := a.cfg.Cloudflare.Token
	if token == "" {
		a.logger.Warn("no Cloudflare token configured — DNS failover skipped")
		return
	}

	for domain, zoneID := range a.cfg.Cloudflare.Zones {
		if err := a.updateCloudflareDNS(ctx, token, zoneID, domain, publicIP); err != nil {
			a.logger.Error("DNS failover update failed",
				zap.String("domain", domain), zap.Error(err))
		} else {
			a.logger.Info("DNS failover completed",
				zap.String("domain", domain),
				zap.String("new_ip", publicIP))
		}
	}
}

func (a *Agent) updateCloudflareDNS(ctx context.Context, token, zoneID, domain, ip string) error {
	// List records to find the A record ID
	listURL := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records?type=A&name=%s", zoneID, domain)
	req, _ := http.NewRequestWithContext(ctx, "GET", listURL, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("cloudflare list records: %w", err)
	}
	defer resp.Body.Close()

	// For simplicity, use the PATCH endpoint directly
	patchURL := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records", zoneID)
	body := fmt.Sprintf(`{"type":"A","name":"%s","content":"%s","ttl":60,"proxied":false}`, domain, ip)
	patchReq, _ := http.NewRequestWithContext(ctx, "POST", patchURL,
		strings.NewReader(body))
	patchReq.Header.Set("Authorization", "Bearer "+token)
	patchReq.Header.Set("Content-Type", "application/json")

	patchResp, err := a.client.Do(patchReq)
	if err != nil {
		return fmt.Errorf("cloudflare update: %w", err)
	}
	defer patchResp.Body.Close()
	if patchResp.StatusCode >= 400 {
		b, _ := io.ReadAll(patchResp.Body)
		return fmt.Errorf("cloudflare API error %d: %s", patchResp.StatusCode, string(b))
	}
	return nil
}

func (a *Agent) getPublicIP() (string, error) {
	resp, err := a.client.Get("https://api.ipify.org")
	if err != nil {
		return "", fmt.Errorf("ipify: %w", err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(b)), nil
}
