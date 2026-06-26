CREATE TABLE IF NOT EXISTS nodes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           VARCHAR(100) NOT NULL UNIQUE,
  tailscale_ip   INET NOT NULL,
  public_ip      INET,
  role           VARCHAR(20) NOT NULL CHECK (role IN ('primary','worker')),
  status         VARCHAR(20) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','online','offline','draining')),
  access_mode    VARCHAR(20) DEFAULT 'tunnel'
                 CHECK (access_mode IN ('tunnel','direct','local')),
  cpu_cores      INT,
  ram_mb         INT,
  disk_gb        INT,
  arch           VARCHAR(20) DEFAULT 'amd64',
  gpu_info       JSONB,
  k3s_version    VARCHAR(50),
  harbr_version  VARCHAR(50),
  ssh_public_key TEXT,
  last_seen_at   TIMESTAMPTZ,
  joined_at      TIMESTAMPTZ DEFAULT NOW(),
  metadata       JSONB DEFAULT '{}'
);
