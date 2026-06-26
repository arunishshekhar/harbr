CREATE TABLE IF NOT EXISTS projects (
  id                               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                             VARCHAR(100) NOT NULL UNIQUE,
  namespace                        VARCHAR(100) NOT NULL UNIQUE,
  git_url                          TEXT,
  git_branch                       VARCHAR(100) DEFAULT 'main',
  docker_image                     TEXT,
  dockerfile_path                  VARCHAR(255) DEFAULT 'Dockerfile',
  port                             INT NOT NULL DEFAULT 3000
                                   CHECK (port > 0 AND port < 65536),
  domain                           VARCHAR(255),
  node_selector                    VARCHAR(50) DEFAULT 'auto',
  cpu_request                      VARCHAR(20) DEFAULT '0.25',
  cpu_limit                        VARCHAR(20) DEFAULT '2.0',
  memory_request                   VARCHAR(20) DEFAULT '128Mi',
  memory_limit                     VARCHAR(20) DEFAULT '1Gi',
  gpu_enabled                      BOOLEAN DEFAULT FALSE,
  storage_size                     VARCHAR(20) DEFAULT '5Gi',
  storage_replicas                 INT DEFAULT 1,
  env_vars                         JSONB DEFAULT '{}',
  project_status                   VARCHAR(20) NOT NULL DEFAULT 'idle'
                                   CHECK (project_status IN
                                     ('idle','building','deploying','running',
                                      'failed','stopped','crashloop')),
  desired_status                   VARCHAR(20) DEFAULT 'running',
  observed_status                  VARCHAR(20) DEFAULT 'unknown',
  current_image_tag                VARCHAR(255),
  git_credentials_secret           VARCHAR(255),
  git_credentials_type             VARCHAR(20) DEFAULT 'none'
                                   CHECK (git_credentials_type IN
                                     ('none','token','ssh')),
  build_secrets_secret             VARCHAR(255),
  healthcheck_path                 VARCHAR(255) DEFAULT '/health',
  healthcheck_port                 INT,
  healthcheck_initial_delay_secs   INT DEFAULT 10,
  runtime_version                  VARCHAR(50),
  created_at                       TIMESTAMPTZ DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ DEFAULT NOW(),
  created_by                       UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_projects_namespace ON projects(namespace);
CREATE INDEX IF NOT EXISTS idx_projects_status    ON projects(project_status);
