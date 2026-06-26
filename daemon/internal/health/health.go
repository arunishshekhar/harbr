package health

import (
	"context"
	"encoding/json"
	"net/http"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

type Server struct {
	cfg    *config.Config
	logger *zap.Logger
	server *http.Server
}

func New(cfg *config.Config, logger *zap.Logger) *Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	return &Server{
		cfg:    cfg,
		logger: logger,
		server: &http.Server{Addr: ":7700", Handler: mux},
	}
}

func (s *Server) Start(ctx context.Context) {
	s.logger.Info("health server starting on :7700")
	go func() {
		<-ctx.Done()
		s.server.Shutdown(context.Background())
	}()
	if err := s.server.ListenAndServe(); err != http.ErrServerClosed {
		s.logger.Error("health server error", zap.Error(err))
	}
}
