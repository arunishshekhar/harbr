// Package ddns provides a DDNS updater that monitors the machine's public IP
// and updates Cloudflare A records whenever the IP changes.
package ddns

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
	"github.com/arunishshekhar/harbr/internal/config"
)

// Updater polls the public IP every 5 minutes and updates Cloudflare DNS
// for all configured zones when a change is detected.
type Updater struct {
	cfg    *config.Config
	logger *zap.Logger
	lastIP string
	client *http.Client
}

func New(cfg *config.Config, logger *zap.Logger) *Updater {
	return &Updater{
		cfg:    cfg,
		logger: logger,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// Start runs the DDNS update loop until ctx is cancelled.
func (u *Updater) Start(ctx context.Context) {
	if u.cfg.Node.AccessMode == "tunnel" {
		u.logger.Info("DDNS updater skipped: tunnel mode handles public access")
		return
	}
	if u.cfg.Cloudflare.Token == "" {
		u.logger.Warn("DDNS updater: no Cloudflare token configured, skipping")
		return
	}

	u.logger.Info("DDNS updater starting")

	// Run immediately on start, then on interval
	u.tryUpdate(ctx)

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			u.tryUpdate(ctx)
		}
	}
}

func (u *Updater) tryUpdate(ctx context.Context) {
	ip, err := u.getPublicIP()
	if err != nil {
		u.logger.Warn("DDNS: cannot resolve public IP", zap.Error(err))
		return
	}

	if ip == u.lastIP {
		return // no change
	}

	u.logger.Info("DDNS: public IP changed",
		zap.String("old", u.lastIP),
		zap.String("new", ip))

	for domain, zoneID := range u.cfg.Cloudflare.Zones {
		if err := u.updateRecord(ctx, domain, zoneID, ip); err != nil {
			u.logger.Error("DDNS update failed",
				zap.String("domain", domain),
				zap.Error(err))
		} else {
			u.logger.Info("DDNS updated",
				zap.String("domain", domain),
				zap.String("ip", ip))
		}
	}

	u.lastIP = ip
}

func (u *Updater) getPublicIP() (string, error) {
	resp, err := u.client.Get("https://api.ipify.org")
	if err != nil {
		return "", fmt.Errorf("ipify: %w", err)
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(b)), nil
}

// updateRecord creates or patches an A record in Cloudflare.
// It lists existing records first so it can PATCH (not duplicate-create).
func (u *Updater) updateRecord(ctx context.Context, domain, zoneID, ip string) error {
	token := u.cfg.Cloudflare.Token

	// 1. List existing A records for this domain
	listURL := fmt.Sprintf(
		"https://api.cloudflare.com/client/v4/zones/%s/dns_records?type=A&name=%s",
		zoneID, domain)
	listReq, _ := http.NewRequestWithContext(ctx, "GET", listURL, nil)
	listReq.Header.Set("Authorization", "Bearer "+token)

	listResp, err := u.client.Do(listReq)
	if err != nil {
		return fmt.Errorf("list records: %w", err)
	}
	defer listResp.Body.Close()
	listBody, _ := io.ReadAll(listResp.Body)

	// Crude extraction of first record ID from JSON response
	recordID := extractRecordID(string(listBody))

	payload := fmt.Sprintf(
		`{"type":"A","name":"%s","content":"%s","ttl":120,"proxied":false}`,
		domain, ip)

	var method, endpoint string
	if recordID != "" {
		// PATCH existing record
		method = "PATCH"
		endpoint = fmt.Sprintf(
			"https://api.cloudflare.com/client/v4/zones/%s/dns_records/%s",
			zoneID, recordID)
	} else {
		// POST new record
		method = "POST"
		endpoint = fmt.Sprintf(
			"https://api.cloudflare.com/client/v4/zones/%s/dns_records",
			zoneID)
	}

	req, _ := http.NewRequestWithContext(ctx, method, endpoint,
		strings.NewReader(payload))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := u.client.Do(req)
	if err != nil {
		return fmt.Errorf("upsert record: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("cloudflare API %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

// extractRecordID is a minimal JSON scanner that finds the first "id" value
// in the Cloudflare list-records response without importing encoding/json.
func extractRecordID(body string) string {
	// Look for: "result":[{"id":"<uuid>"
	idx := strings.Index(body, `"result":[{"id":"`)
	if idx < 0 {
		return ""
	}
	start := idx + len(`"result":[{"id":"`)
	end := strings.Index(body[start:], `"`)
	if end < 0 {
		return ""
	}
	return body[start : start+end]
}
