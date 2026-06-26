package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type Config struct {
	Node struct {
		ID         string `json:"id"`
		Name       string `json:"name"`
		Role       string `json:"role"`
		TailscaleIP string `json:"tailscale_ip"`
		PublicIP   string `json:"public_ip"`
		AccessMode string `json:"access_mode"`
		Arch       string `json:"arch"`
	} `json:"node"`

	Postgres struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		User     string `json:"user"`
		Password string `json:"password"`
		Database string `json:"database"`
	} `json:"postgres"`

	Redis struct {
		Host string `json:"host"`
		Port int    `json:"port"`
	} `json:"redis"`

	Cloudflare struct {
		Token     string            `json:"token"`
		AccountID string            `json:"account_id"`
		Zones     map[string]string `json:"zones"`
	} `json:"cloudflare"`

	K3s struct {
		Version     string `json:"version"`
		DataStoreDSN string `json:"datastore_dsn"`
	} `json:"k3s"`

	Registry struct {
		IP   string `json:"ip"`
		Port int    `json:"port"`
	} `json:"registry"`
}

func Load(path string) (*Config, error) {
	if path == "" {
		path = os.Getenv("HARBR_CONFIG")
	}
	if path == "" {
		path = "/etc/harbr/harbr.config.json"
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("config load failed: %w", err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("config parse failed: %w", err)
	}
	return &cfg, nil
}

func (c *Config) PostgresDSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s",
		c.Postgres.User, c.Postgres.Password,
		c.Postgres.Host, c.Postgres.Port, c.Postgres.Database)
}

func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Redis.Host, c.Redis.Port)
}
