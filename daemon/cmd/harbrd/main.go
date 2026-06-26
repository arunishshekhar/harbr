package main

import (
	"context"
	"os/signal"
	"os"
	"syscall"

	"go.uber.org/zap"
	"github.com/YOUR_USERNAME/harbr/internal/reconciler"
	"github.com/YOUR_USERNAME/harbr/internal/health"
	"github.com/YOUR_USERNAME/harbr/internal/tunnel"
	"github.com/YOUR_USERNAME/harbr/internal/leader"
	"github.com/YOUR_USERNAME/harbr/internal/dns_failover"
)

func main() {
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	ctx, cancel := signal.NotifyContext(context.Background(),
		syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	logger.Info("harbrd starting",
		zap.String("version", Version),
		zap.String("node", os.Getenv("HARBR_NODE_NAME")))

	rec := reconciler.New(logger)
	hlth := health.New(logger)
	tun := tunnel.New(logger)
	ldr := leader.New(logger)
	dns := dns_failover.New(logger)

	go hlth.Start(ctx)
	go ldr.Acquire(ctx)
	go rec.Start(ctx)

	if os.Getenv("ACCESS_MODE") == "tunnel" {
		go tun.Start(ctx)
	} else {
		go dns.Start(ctx)
	}

	<-ctx.Done()
	logger.Info("harbrd shutting down")
}

var Version = "dev"
