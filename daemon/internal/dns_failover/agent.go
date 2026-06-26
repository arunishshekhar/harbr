package dns_failover

import (
	"context"
	"go.uber.org/zap"
)

type Agent struct {
	logger *zap.Logger
	cfg    *Config
}

type Config struct {
	AccessMode string
}

func New(logger *zap.Logger) *Agent {
	return &Agent{logger: logger}
}

func (a *Agent) Start(ctx context.Context) {
	if a.cfg != nil && a.cfg.AccessMode == "tunnel" {
		if a.logger != nil {
			a.logger.Info("skipping DNS failover agent: running in tunnel mode")
		}
		return
	}
	if a.logger != nil {
		a.logger.Info("DNS failover agent starting")
	}
	<-ctx.Done()
}
