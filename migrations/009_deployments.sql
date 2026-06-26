CREATE TABLE IF NOT EXISTS deployments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  build_id            UUID REFERENCES builds(id),
  image_tag           VARCHAR(255) NOT NULL,
  status              VARCHAR(20) DEFAULT 'pending',
  previous_image_tag  VARCHAR(255),
  is_rollback         BOOLEAN DEFAULT FALSE,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  error_message       TEXT,
  triggered_by        VARCHAR(50) DEFAULT 'manual',
  triggered_by_user   UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);
