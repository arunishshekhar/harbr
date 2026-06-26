package dns_failover

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

type Agent struct {
	cfg       *config.Config
	logger    *zap.Logger
	failCount map[string]int
}

func New(cfg *config.Config, logger *zap.Logger) *Agent {
	return &Agent{
		cfg:       cfg,
		logger:    logger,
		failCount: make(map[string]int),
	}
}

func (a *Agent) Start(ctx context.Context) {
	if a.cfg.Node.AccessMode == "tunnel" {
		a.logger.Info("skipping DNS failover agent: running in tunnel mode (Cloudflare handles failover)")
		return
	}
	a.logger.Info("DNS failover agent starting (mode: direct)")
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
	for _, ipStr := range a.getPeerIPs() {
		if ipStr == a.cfg.Node.TailscaleIP || ipStr == "" {
			continue
		}
		if a.isReachable(ipStr) {
			a.failCount[ipStr] = 0
			continue
		}
		a.failCount[ipStr]++
		a.logger.Warn("node unreachable",
			zap.String("ip", ipStr),
			zap.Int("consecutive_fails", a.failCount[ipStr]))
		if a.failCount[ipStr] >= 3 {
			a.logger.Error("initiating DNS failover", zap.String("failed_ip", ipStr))
			a.performFailover(ctx, ipStr)
			a.failCount[ipStr] = 0
		}
	}
}

func (a *Agent) getPeerIPs() []string {
	return nil
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
	a.logger.Info("DNS failover would update records",
		zap.String("failed_ip", failedIP),
		zap.String("new_ip", publicIP))
}

func (a *Agent) getPublicIP() (string, error) {
	resp, err := http.Get("https://api.ipify.org")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b := make([]byte, 64)
	n, _ := resp.Body.Read(b)
	return string(b[:n]), nil
}
