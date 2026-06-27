// Package hardware provides real-time hardware monitoring for the Harbr daemon.
// It polls CPU, RAM, disk, temperature, NVIDIA GPUs and Coral TPU/USB devices,
// reports changes to Postgres, and exposes a snapshot for the health API.
package hardware

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// DeviceType identifies the class of hardware device.
type DeviceType string

const (
	DeviceGPU DeviceType = "gpu_nvidia"
	DeviceTPU DeviceType = "tpu_coral"
	DeviceUSB DeviceType = "usb"
)

// Device represents a detected hardware accelerator or peripheral.
type Device struct {
	Type    DeviceType        `json:"type"`
	Name    string            `json:"name"`
	Details map[string]string `json:"details,omitempty"`
}

// Snapshot is the complete hardware state at a point in time.
type Snapshot struct {
	NodeID  string   `json:"node_id"`
	CPUPCT  float64  `json:"cpu_pct"`
	MemPCT  float64  `json:"mem_pct"`
	DiskPCT float64  `json:"disk_pct"`
	TempC   *float64 `json:"temp_c,omitempty"`
	Devices []Device `json:"devices"`
}

// Watcher polls hardware metrics and tracks connected devices.
type Watcher struct {
	nodeID   string
	db       *pgxpool.Pool
	logger   *zap.Logger
	mu       sync.RWMutex
	snapshot Snapshot
}

// New creates a Watcher.  db may be nil (metrics only, no Postgres writes).
func New(nodeID string, db *pgxpool.Pool, logger *zap.Logger) *Watcher {
	return &Watcher{nodeID: nodeID, db: db, logger: logger}
}

// Start polls hardware every 10 seconds until ctx is cancelled.
func (w *Watcher) Start(ctx context.Context) {
	w.logger.Info("hardware watcher starting", zap.String("node", w.nodeID))
	w.poll(ctx)
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.poll(ctx)
		}
	}
}

// Snapshot returns the most recent hardware snapshot (safe for concurrent use).
func (w *Watcher) Snapshot() Snapshot {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.snapshot
}

func (w *Watcher) poll(ctx context.Context) {
	snap := Snapshot{NodeID: w.nodeID}
	snap.CPUPCT = w.cpuPercent()
	snap.MemPCT = w.memPercent()
	snap.DiskPCT = w.diskPercent("/")
	snap.TempC = w.temperature()
	snap.Devices = w.detectDevices(ctx)

	w.mu.Lock()
	prev := w.snapshot
	w.snapshot = snap
	w.mu.Unlock()

	// Emit hardware_events for device add/remove
	if w.db != nil {
		w.emitDeviceEvents(ctx, prev.Devices, snap.Devices)
	}
}

// ─── CPU ─────────────────────────────────────────────────────────────────────

// cpuPercent reads two samples of /proc/stat and computes usage.
func (w *Watcher) cpuPercent() float64 {
	read := func() (idle, total uint64) {
		f, err := os.Open("/proc/stat")
		if err != nil {
			return
		}
		defer f.Close()
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "cpu ") {
				continue
			}
			fields := strings.Fields(line)
			var vals []uint64
			for _, s := range fields[1:] {
				n, _ := strconv.ParseUint(s, 10, 64)
				vals = append(vals, n)
			}
			if len(vals) >= 4 {
				idle = vals[3]
				for _, v := range vals {
					total += v
				}
			}
			break
		}
		return
	}

	idle1, total1 := read()
	time.Sleep(100 * time.Millisecond)
	idle2, total2 := read()

	dTotal := total2 - total1
	dIdle := idle2 - idle1
	if dTotal == 0 {
		return 0
	}
	return (1.0 - float64(dIdle)/float64(dTotal)) * 100.0
}

// ─── Memory ──────────────────────────────────────────────────────────────────

func (w *Watcher) memPercent() float64 {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0
	}
	defer f.Close()

	vals := map[string]uint64{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 2 {
			n, _ := strconv.ParseUint(fields[1], 10, 64)
			vals[strings.TrimSuffix(fields[0], ":")] = n
		}
	}
	total := vals["MemTotal"]
	available := vals["MemAvailable"]
	if total == 0 {
		return 0
	}
	return (1.0 - float64(available)/float64(total)) * 100.0
}

// ─── Disk ─────────────────────────────────────────────────────────────────────

func (w *Watcher) diskPercent(mount string) float64 {
	out, err := exec.Command("df", "-P", mount).Output()
	if err != nil {
		return 0
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) < 2 {
		return 0
	}
	fields := strings.Fields(lines[1])
	if len(fields) < 5 {
		return 0
	}
	pct := strings.TrimSuffix(fields[4], "%")
	v, _ := strconv.ParseFloat(pct, 64)
	return v
}

// ─── Temperature ─────────────────────────────────────────────────────────────

// temperature reads the first available CPU thermal zone from sysfs.
func (w *Watcher) temperature() *float64 {
	// Try hwmon first (more accurate)
	matches, _ := filepath.Glob("/sys/class/hwmon/hwmon*/temp1_input")
	for _, path := range matches {
		raw, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		millideg, err := strconv.ParseFloat(strings.TrimSpace(string(raw)), 64)
		if err != nil || millideg == 0 {
			continue
		}
		t := millideg / 1000.0
		if t > 0 && t < 120 {
			return &t
		}
	}

	// Fallback: thermal_zone
	matches, _ = filepath.Glob("/sys/class/thermal/thermal_zone*/temp")
	for _, path := range matches {
		raw, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		millideg, err := strconv.ParseFloat(strings.TrimSpace(string(raw)), 64)
		if err != nil || millideg == 0 {
			continue
		}
		t := millideg / 1000.0
		if t > 0 && t < 120 {
			return &t
		}
	}
	return nil
}

// ─── Devices ─────────────────────────────────────────────────────────────────

func (w *Watcher) detectDevices(ctx context.Context) []Device {
	var devices []Device
	devices = append(devices, w.detectNvidiaGPUs(ctx)...)
	devices = append(devices, w.detectCoralTPU()...)
	return devices
}

// detectNvidiaGPUs calls nvidia-smi if available.
func (w *Watcher) detectNvidiaGPUs(ctx context.Context) []Device {
	out, err := exec.CommandContext(ctx, "nvidia-smi",
		"--query-gpu=name,memory.total,temperature.gpu,utilization.gpu",
		"--format=csv,noheader,nounits").Output()
	if err != nil {
		return nil
	}
	var gpus []Device
	scanner := bufio.NewScanner(strings.NewReader(string(out)))
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), ", ", 4)
		if len(parts) < 1 {
			continue
		}
		d := Device{
			Type: DeviceGPU,
			Name: strings.TrimSpace(parts[0]),
			Details: map[string]string{},
		}
		if len(parts) > 1 {
			d.Details["vram_mb"] = strings.TrimSpace(parts[1])
		}
		if len(parts) > 2 {
			d.Details["temp_c"] = strings.TrimSpace(parts[2])
		}
		if len(parts) > 3 {
			d.Details["util_pct"] = strings.TrimSpace(parts[3])
		}
		gpus = append(gpus, d)
	}
	return gpus
}

// detectCoralTPU scans USB for Google Coral (vendor 18d1, product 9302 or 9310).
func (w *Watcher) detectCoralTPU() []Device {
	const coralVendor = "18d1"
	coralProducts := map[string]string{
		"9302": "Coral USB Accelerator",
		"9310": "Coral Dev Board",
	}

	entries, err := os.ReadDir("/sys/bus/usb/devices")
	if err != nil {
		return nil
	}

	var devices []Device
	for _, entry := range entries {
		base := filepath.Join("/sys/bus/usb/devices", entry.Name())
		vid, _ := os.ReadFile(filepath.Join(base, "idVendor"))
		pid, _ := os.ReadFile(filepath.Join(base, "idProduct"))
		vendor := strings.TrimSpace(string(vid))
		product := strings.TrimSpace(string(pid))
		if vendor == coralVendor {
			name, ok := coralProducts[product]
			if !ok {
				name = fmt.Sprintf("Coral USB (pid %s)", product)
			}
			devices = append(devices, Device{
				Type: DeviceTPU,
				Name: name,
				Details: map[string]string{"usb_product": product},
			})
		}
	}
	return devices
}

// ─── Event emission ───────────────────────────────────────────────────────────

func (w *Watcher) emitDeviceEvents(ctx context.Context, prev, curr []Device) {
	// Build lookup sets
	prevSet := map[string]bool{}
	for _, d := range prev {
		prevSet[d.Name] = true
	}
	currSet := map[string]bool{}
	for _, d := range curr {
		currSet[d.Name] = true
	}

	// Added devices
	for _, d := range curr {
		if !prevSet[d.Name] {
			w.writeEvent(ctx, "device_added", d)
		}
	}
	// Removed devices
	for _, d := range prev {
		if !currSet[d.Name] {
			w.writeEvent(ctx, "device_removed", d)
		}
	}
}

func (w *Watcher) writeEvent(ctx context.Context, eventType string, d Device) {
	raw, _ := json.Marshal(d.Details)
	_, err := w.db.Exec(ctx,
		`INSERT INTO hardware_events (node_id, event_type, device_type, device_name, details)
		 VALUES ($1, $2, $3, $4, $5)`,
		w.nodeID, eventType, string(d.Type), d.Name, string(raw),
	)
	if err != nil {
		w.logger.Error("failed to write hardware event", zap.Error(err))
		return
	}
	w.logger.Info("hardware event",
		zap.String("type", eventType),
		zap.String("device", d.Name),
	)
}
