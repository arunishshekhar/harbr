package health

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
	"github.com/arunishshekhar/harbr/internal/hardware"
)

// Server exposes health, hardware, and metrics endpoints on :7700.
type Server struct {
	cfg     *config.Config
	logger  *zap.Logger
	watcher *hardware.Watcher
	server  *http.Server
}

func New(cfg *config.Config, logger *zap.Logger, watcher *hardware.Watcher) *Server {
	mux := http.NewServeMux()

	s := &Server{
		cfg:     cfg,
		logger:  logger,
		watcher: watcher,
	}

	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/hardware", s.handleHardware)
	mux.HandleFunc("/metrics", s.handleMetrics)

	s.server = &http.Server{
		Addr:         ":7700",
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	return s
}

func (s *Server) Start(ctx context.Context) {
	s.logger.Info("health server starting on :7700")
	go func() {
		<-ctx.Done()
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		s.server.Shutdown(shutCtx)
	}()
	if err := s.server.ListenAndServe(); err != http.ErrServerClosed {
		s.logger.Error("health server error", zap.Error(err))
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"status": "ok",
		"node":   s.cfg.Node.Name,
		"role":   s.cfg.Node.Role,
		"time":   time.Now().UTC(),
	})
}

func (s *Server) handleHardware(w http.ResponseWriter, r *http.Request) {
	if s.watcher == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"error": "hardware watcher not running"})
		return
	}
	snap := s.watcher.Snapshot()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snap)
}

// handleMetrics emits Prometheus-style text metrics.
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if s.watcher == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		return
	}
	snap := s.watcher.Snapshot()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")

	labels := fmt.Sprintf(`node="%s"`, snap.NodeID)
	fmt.Fprintf(w, "harbr_cpu_pct{%s} %.2f\n", labels, snap.CPUPCT)
	fmt.Fprintf(w, "harbr_mem_pct{%s} %.2f\n", labels, snap.MemPCT)
	fmt.Fprintf(w, "harbr_disk_pct{%s} %.2f\n", labels, snap.DiskPCT)
	if snap.TempC != nil {
		fmt.Fprintf(w, "harbr_temp_c{%s} %.1f\n", labels, *snap.TempC)
	}
	fmt.Fprintf(w, "harbr_gpu_count{%s} %d\n", labels, countDevices(snap.Devices, hardware.DeviceGPU))
	fmt.Fprintf(w, "harbr_tpu_count{%s} %d\n", labels, countDevices(snap.Devices, hardware.DeviceTPU))
}

func countDevices(devices []hardware.Device, t hardware.DeviceType) int {
	n := 0
	for _, d := range devices {
		if d.Type == t {
			n++
		}
	}
	return n
}
