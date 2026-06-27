package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"go.uber.org/zap"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/arunishshekhar/harbr/internal/config"
	"github.com/arunishshekhar/harbr/internal/ddns"
	"github.com/arunishshekhar/harbr/internal/dns_failover"
	"github.com/arunishshekhar/harbr/internal/hardware"
	"github.com/arunishshekhar/harbr/internal/health"
	"github.com/arunishshekhar/harbr/internal/leader"
	"github.com/arunishshekhar/harbr/internal/reconciler"
	"github.com/arunishshekhar/harbr/internal/tunnel"
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

	// Postgres connection pool (shared across subsystems)
	var db *pgxpool.Pool
	if dsn := cfg.PostgresDSN(); dsn != "" {
		db, err = pgxpool.New(ctx, dsn)
		if err != nil {
			logger.Warn("postgres connection failed — hardware events will not be persisted", zap.Error(err))
		}
	}

	// Hardware watcher — polls CPU/RAM/disk/GPU/TPU every 10s
	hw := hardware.New(cfg.Node.Name, db, logger)
	go hw.Start(ctx)

	// Health + metrics API on :7700
	hlth := health.New(cfg, logger, hw)
	go hlth.Start(ctx)

	// Primary-only subsystems
	if cfg.Node.Role == "primary" {
		ldr := leader.New(cfg, logger)
		rec := reconciler.New(cfg, logger)
		go ldr.Acquire(ctx)
		go rec.Start(ctx)
	}

	// Access mode routing
	if cfg.Node.AccessMode == "tunnel" {
		tun := tunnel.New(cfg, logger)
		go tun.Start(ctx)
	} else {
		// Direct mode: DDNS updates + multi-node DNS failover
		ddnsUpdater := ddns.New(cfg, logger)
		go ddnsUpdater.Start(ctx)
		dnsAgent := dns_failover.New(cfg, logger)
		go dnsAgent.Start(ctx)
	}

	<-ctx.Done()
	logger.Info("harbrd shutting down")
	if db != nil {
		db.Close()
	}
}
