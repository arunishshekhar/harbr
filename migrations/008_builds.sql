CREATE TABLE IF NOT EXISTS builds (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  git_commit          VARCHAR(40),
  git_branch          VARCHAR(100),
  image_tag           VARCHAR(255),
  status              VARCHAR(20) DEFAULT 'queued'
                      CHECK (status IN
                        ('queued','running','success','failed','cancelled')),
  kaniko_job_name     VARCHAR(255),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  error_message       TEXT,
  triggered_by        VARCHAR(50) DEFAULT 'manual',
  triggered_by_user   UUID REFERENCES users(id),
  webhook_delivery_id VARCHAR(255),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_builds_project_id ON builds(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_webhook_delivery
  ON builds(webhook_delivery_id) WHERE webhook_delivery_id IS NOT NULL;
