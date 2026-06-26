package leader

import (
	"context"
	"time"
	"go.uber.org/zap"
)

type Leader struct {
	logger    *zap.Logger
	isLeader  bool
}

func New(logger *zap.Logger) *Leader {
	return &Leader{logger: logger}
}

func (l *Leader) Acquire(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			l.tryAcquire(ctx)
		}
	}
}

func (l *Leader) tryAcquire(ctx context.Context) {
	// Acquire lease via PostgreSQL advisory lock or table
	l.isLeader = true
}
