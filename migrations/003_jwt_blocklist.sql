CREATE TABLE IF NOT EXISTS jwt_blocklist (
  jti        VARCHAR(255) PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jwt_blocklist_expires ON jwt_blocklist(expires_at);
