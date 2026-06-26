package tunnel

import (
	"context"
	"fmt"
	"os"
	"os/exec"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

type Manager struct {
	cfg    *config.Config
	logger *zap.Logger
}

func New(cfg *config.Config, logger *zap.Logger) *Manager {
	return &Manager{
		cfg:    cfg,
		logger: logger,
	}
}

func (m *Manager) Start(ctx context.Context) {
	m.logger.Info("tunnel manager starting")
	if m.cfg.Node.AccessMode != "tunnel" {
		m.logger.Info("not in tunnel mode, skipping")
		return
	}
	tunnelID := os.Getenv("CLOUDFLARE_TUNNEL_ID")
	credsJSON := os.Getenv("CLOUDFLARE_TUNNEL_CREDENTIALS")
	if tunnelID != "" && credsJSON != "" {
		if err := m.Setup(ctx, tunnelID, credsJSON); err != nil {
			m.logger.Error("tunnel setup failed", zap.Error(err))
		}
	}
	<-ctx.Done()
}

func (m *Manager) Setup(ctx context.Context, tunnelID, credentialsJSON string) error {
	if err := os.WriteFile("/etc/cloudflared/credentials.json",
		[]byte(credentialsJSON), 0600); err != nil {
		return err
	}

	localIP := m.cfg.Node.TailscaleIP
	if localIP == "" {
		localIP = "127.0.0.1"
	}
	caddyURL := fmt.Sprintf("http://%s:80", localIP)

	domain := m.cfg.Cloudflare.Zones["primary"]
	if domain == "" {
		domain = os.Getenv("HARBR_DOMAIN")
	}

	config := fmt.Sprintf(`
tunnel: %s
credentials-file: /etc/cloudflared/credentials.json
ingress:
  - hostname: "*.%s"
    service: %s
    originRequest:
      noTLSVerify: true
  - hostname: "%s"
    service: %s
    originRequest:
      noTLSVerify: true
  - service: http_status:404
`, tunnelID, domain, caddyURL, domain, caddyURL)

	if err := os.WriteFile("/etc/cloudflared/config.yml", []byte(config), 0644); err != nil {
		return err
	}

	cmds := []string{
		"cloudflared service install",
		"systemctl enable cloudflared",
		"systemctl start cloudflared",
	}
	for _, cmd := range cmds {
		if err := exec.CommandContext(ctx, "bash", "-c", cmd).Run(); err != nil {
			m.logger.Warn("cloudflared cmd failed (may be ok if already running)",
				zap.String("cmd", cmd), zap.Error(err))
		}
	}
	return nil
}
