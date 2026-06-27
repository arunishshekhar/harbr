-- 016_system_settings.sql
-- Key-value store for global cluster configuration.

CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT        PRIMARY KEY,
  value       TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO system_settings (key, value) VALUES
  ('access_mode',     '"tunnel"'),
  ('domain',          '""'),
  ('registry_ip',     '"localhost"')
ON CONFLICT (key) DO NOTHING;
