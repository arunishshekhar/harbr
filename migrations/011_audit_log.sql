CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES users(id),
  actor_name    VARCHAR(100),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   UUID,
  resource_name VARCHAR(255),
  changes       JSONB,
  job_id        UUID,
  request_id    VARCHAR(100),
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
) PARTITION BY RANGE (created_at);

CREATE OR REPLACE FUNCTION create_audit_log_partition() RETURNS void AS $$
DECLARE
  next_month DATE := date_trunc('month', NOW() + INTERVAL '1 month');
  pname TEXT := 'audit_log_' || to_char(next_month, 'YYYY_MM');
  s TEXT := to_char(next_month, 'YYYY-MM-DD');
  e TEXT := to_char(next_month + INTERVAL '1 month', 'YYYY-MM-DD');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_log FOR VALUES FROM (%L) TO (%L)',
    pname, s, e);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION drop_old_audit_log_partitions() RETURNS void AS $$
DECLARE
  cutoff DATE := date_trunc('month', NOW() - INTERVAL '90 days');
  pname TEXT;
BEGIN
  FOR pname IN SELECT tablename FROM pg_tables
    WHERE tablename LIKE 'audit_log_%'
    AND tablename < 'audit_log_' || to_char(cutoff, 'YYYY_MM')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', pname);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT create_audit_log_partition();
SELECT create_audit_log_partition();
