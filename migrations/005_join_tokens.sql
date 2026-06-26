CREATE TABLE IF NOT EXISTS join_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash      VARCHAR(255) NOT NULL UNIQUE,
  used            BOOLEAN DEFAULT FALSE,
  used_by_node_id UUID REFERENCES nodes(id),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
