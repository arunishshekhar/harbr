-- External proxy rules: allow project paths to proxy to external services
CREATE TABLE IF NOT EXISTS external_proxies (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  project_id     UUID REFERENCES projects(id) ON DELETE CASCADE,
  target_address TEXT NOT NULL,
  target_port    INT NOT NULL DEFAULT 80,
  path_prefix    TEXT NOT NULL DEFAULT '/proxy',
  enabled        BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_external_proxies_project ON external_proxies(project_id);
