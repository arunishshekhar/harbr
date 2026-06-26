package health

import (
	"context"
	"net/http"
	"go.uber.org/zap"
)

type Server struct {
	logger *zap.Logger
	server *http.Server
}

func New(logger *zap.Logger) *Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	return &Server{
		logger: logger,
		server: &http.Server{Addr: ":8080", Handler: mux},
	}
}

func (s *Server) Start(ctx context.Context) {
	s.logger.Info("health server starting on :8080")
	go func() {
		<-ctx.Done()
		s.server.Shutdown(context.Background())
	}()
	if err := s.server.ListenAndServe(); err != http.ErrServerClosed {
		s.logger.Error("health server error", zap.Error(err))
	}
}
