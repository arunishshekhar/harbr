package tunnel

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"go.uber.org/zap"
)

type Manager struct {
	tunnelID string
	nodeRole string
	localIP  string
	domain   string
	logger   *zap.Logger
}

func New(logger *zap.Logger) *Manager {
	return &Manager{
		logger: logger,
	}
}

func (m *Manager) Start(ctx context.Context) {
	m.logger.Info("tunnel manager starting")
	<-ctx.Done()
}

func (m *Manager) Setup(ctx context.Context, tunnelID, credentialsJSON string) error {
	if err := os.WriteFile("/etc/cloudflared/credentials.json",
		[]byte(credentialsJSON), 0600); err != nil {
		return err
	}

	caddyURL := fmt.Sprintf("http://%s:80", m.localIP)

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
`, tunnelID, m.domain, caddyURL, m.domain, caddyURL)

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
