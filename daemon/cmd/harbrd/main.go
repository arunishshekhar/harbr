package main

import (
	"context"
	"os/signal"
	"os"
	"syscall"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
	"github.com/arunishshekhar/harbr/internal/reconciler"
	"github.com/arunishshekhar/harbr/internal/health"
	"github.com/arunishshekhar/harbr/internal/tunnel"
	"github.com/arunishshekhar/harbr/internal/leader"
	"github.com/arunishshekhar/harbr/internal/dns_failover"
)

var Version = "dev"

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	cfg, err := config.Load(os.Getenv("HARBR_CONFIG"))
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	ctx, cancel := signal.NotifyContext(context.Background(),
		syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	logger.Info("harbrd starting",
		zap.String("version", Version),
		zap.String("node", cfg.Node.Name),
		zap.String("role", cfg.Node.Role))

	hlth := health.New(cfg, logger)
	go hlth.Start(ctx)

	if cfg.Node.Role == "primary" {
		ldr := leader.New(cfg, logger)
		rec := reconciler.New(cfg, logger)
		go ldr.Acquire(ctx)
		go rec.Start(ctx)
	}

	if cfg.Node.AccessMode == "tunnel" {
		tun := tunnel.New(cfg, logger)
		go tun.Start(ctx)
	} else {
		dnsAgent := dns_failover.New(cfg, logger)
		go dnsAgent.Start(ctx)
	}

	<-ctx.Done()
	logger.Info("harbrd shutting down")
}
