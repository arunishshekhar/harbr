package leader

import (
	"context"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

type Leader struct {
	cfg       *config.Config
	logger    *zap.Logger
	pool      *pgxpool.Pool
	isLeader  bool
	mu        sync.RWMutex
	nodeName  string
	leaseID   int64
}

func New(cfg *config.Config, logger *zap.Logger) *Leader {
	return &Leader{
		cfg:      cfg,
		logger:   logger,
		isLeader: false,
		nodeName: cfg.Node.Name,
		leaseID:  1,
	}
}

func (l *Leader) Acquire(ctx context.Context) {
	pool, err := pgxpool.New(ctx, l.cfg.PostgresDSN())
	if err != nil {
		l.logger.Error("failed to connect to postgres for leader election", zap.Error(err))
		return
	}
	defer pool.Close()

	l.pool = pool
	l.ensureLeaseTable(ctx)

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	l.tryAcquire(ctx)
	for {
		select {
		case <-ctx.Done():
			l.release(ctx)
			return
		case <-ticker.C:
			l.tryAcquire(ctx)
		}
	}
}

func (l *Leader) ensureLeaseTable(ctx context.Context) {
	_, err := l.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS leader_leases (
			id          BIGINT PRIMARY KEY,
			holder      VARCHAR(255),
			holder_ip   INET,
			renewed_at  TIMESTAMPTZ DEFAULT NOW(),
			expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 seconds'
		)
	`)
	if err != nil {
		l.logger.Error("failed to create leader_leases table", zap.Error(err))
	}
}

func (l *Leader) tryAcquire(ctx context.Context) {
	tx, err := l.pool.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	var currentHolder string
	var expiresAt time.Time
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(holder, ''), COALESCE(expires_at, NOW())
		 FROM leader_leases WHERE id = $1 FOR UPDATE`, l.leaseID,
	).Scan(&currentHolder, &expiresAt)

	if err != nil {
		_, err = tx.Exec(ctx,
			`INSERT INTO leader_leases (id, holder, renewed_at, expires_at)
			 VALUES ($1, $2, NOW(), NOW() + INTERVAL '30 seconds')
			 ON CONFLICT (id) DO UPDATE
			 SET holder = EXCLUDED.holder, renewed_at = NOW(),
			     expires_at = NOW() + INTERVAL '30 seconds'
			 WHERE leader_leases.holder = $2 OR leader_leases.expires_at < NOW()`,
			l.leaseID, l.nodeName,
		)
		if err != nil {
			l.logger.Error("failed to insert/update lease", zap.Error(err))
			return
		}
		l.mu.Lock()
		l.isLeader = true
		l.mu.Unlock()
		tx.Commit(ctx)
		l.logger.Info("acquired leader lease", zap.String("node", l.nodeName))
		return
	}

	if currentHolder == l.nodeName || time.Now().After(expiresAt) {
		_, err = tx.Exec(ctx,
			`UPDATE leader_leases SET holder = $1, renewed_at = NOW(),
			 expires_at = NOW() + INTERVAL '30 seconds' WHERE id = $2`,
			l.nodeName, l.leaseID,
		)
		if err == nil {
			l.mu.Lock()
			l.isLeader = true
			l.mu.Unlock()
		}
		tx.Commit(ctx)
		return
	}

	l.mu.Lock()
	l.isLeader = false
	l.mu.Unlock()
	tx.Commit(ctx)
}

func (l *Leader) IsLeader() bool {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.isLeader
}

func (l *Leader) release(ctx context.Context) {
	if l.pool == nil {
		return
	}
	_, err := l.pool.Exec(ctx,
		`UPDATE leader_leases SET expires_at = NOW() WHERE id = $1 AND holder = $2`,
		l.leaseID, l.nodeName,
	)
	if err != nil {
		l.logger.Error("failed to release lease", zap.Error(err))
	}
	l.mu.Lock()
	l.isLeader = false
	l.mu.Unlock()
	l.logger.Info("released leader lease")
}
