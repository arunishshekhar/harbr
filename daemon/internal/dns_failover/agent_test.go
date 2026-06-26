package dns_failover

import (
	"context"
	"testing"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

func TestFailoverSkipsInTunnelMode(t *testing.T) {
	cfg := &config.Config{}
	cfg.Node.AccessMode = "tunnel"
	logger, _ := zap.NewProduction()
	a := New(cfg, logger)
	a.Start(context.Background())
}
