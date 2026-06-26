CREATE TABLE IF NOT EXISTS alert_configs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  node_id      UUID REFERENCES nodes(id) ON DELETE CASCADE,
  metric       VARCHAR(50) NOT NULL,
  threshold    NUMERIC,
  channels     JSONB DEFAULT '["email"]',
  enabled      BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
