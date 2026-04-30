CREATE TABLE IF NOT EXISTS prospects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           VARCHAR(255) NOT NULL,
  phone               VARCHAR(20) NOT NULL,
  email               VARCHAR(255),
  notes               TEXT,
  status              VARCHAR(20) DEFAULT 'prospect'
                      CHECK (status IN ('prospect', 'approved')),
  registered_by_agent UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_agent  ON prospects(registered_by_agent);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
