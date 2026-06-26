CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('admin','operator','deployer','viewer')),
  token_version INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
