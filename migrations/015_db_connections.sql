CREATE TABLE IF NOT EXISTS db_connections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  db_type          VARCHAR(50) NOT NULL,
  service_name     VARCHAR(255) NOT NULL,
  service_port     INT NOT NULL,
  database_name    VARCHAR(255),
  username         VARCHAR(255),
  k8s_secret_name  VARCHAR(255),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
