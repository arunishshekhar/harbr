CREATE TABLE IF NOT EXISTS webhooks (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  endpoint_path        VARCHAR(255) NOT NULL UNIQUE,
  secret_hash          VARCHAR(255) NOT NULL,
  git_url              VARCHAR(500) NOT NULL,
  branch_rules         JSONB NOT NULL DEFAULT '{}',
  enabled              BOOLEAN DEFAULT TRUE,
  last_triggered_at    TIMESTAMPTZ,
  last_trigger_status  VARCHAR(20),
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id   VARCHAR(255) PRIMARY KEY,
  webhook_id    UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  processed_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX IF NOT EXISTS idx_wh_deliveries_expires
  ON webhook_deliveries(expires_at);
