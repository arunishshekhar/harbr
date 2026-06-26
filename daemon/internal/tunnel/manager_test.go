package tunnel

import (
	"testing"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

func TestNew(t *testing.T) {
	cfg := &config.Config{}
	logger, _ := zap.NewProduction()
	m := New(cfg, logger)
	if m == nil {
		t.Error("expected non-nil manager")
	}
}
