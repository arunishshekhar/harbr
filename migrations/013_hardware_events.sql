CREATE TABLE IF NOT EXISTS hardware_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  node_id      UUID REFERENCES nodes(id) ON DELETE CASCADE,
  event_type   VARCHAR(20) NOT NULL CHECK (event_type IN ('added','removed','changed')),
  device_type  VARCHAR(30),
  device_info  JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
