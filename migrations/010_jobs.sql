CREATE TABLE IF NOT EXISTS jobs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type         VARCHAR(50) NOT NULL,
  payload      JSONB NOT NULL,
  status       VARCHAR(20) DEFAULT 'queued'
               CHECK (status IN ('queued','active','completed','failed','stalled')),
  result       JSONB,
  error        TEXT,
  retries      INT DEFAULT 0,
  max_retries  INT DEFAULT 3,
  bullmq_id    VARCHAR(255),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by   UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
