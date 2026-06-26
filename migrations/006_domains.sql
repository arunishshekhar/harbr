CREATE TABLE IF NOT EXISTS domains (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain                      VARCHAR(255) NOT NULL UNIQUE,
  cloudflare_zone_id          VARCHAR(100),
  cloudflare_a_record_id      VARCHAR(100),
  cloudflare_cname_record_id  VARCHAR(100),
  current_ip                  INET,
  tunnel_id                   VARCHAR(100),
  ssl_status                  VARCHAR(20) DEFAULT 'pending',
  ssl_expires_at              TIMESTAMPTZ,
  ssl_strategy                VARCHAR(30) DEFAULT 'cloudflare_edge'
                              CHECK (ssl_strategy IN
                                ('cloudflare_edge','dns01_wildcard','none')),
  ddns_enabled                BOOLEAN DEFAULT FALSE,
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);
