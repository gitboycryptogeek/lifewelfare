CREATE TABLE IF NOT EXISTS agent_commissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  cover_option       INTEGER NOT NULL CHECK (cover_option BETWEEN 1 AND 6),
  commission_amount  NUMERIC(10,2) NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'disbursed')),
  disbursed_at       TIMESTAMPTZ,
  disbursed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  disbursement_notes TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_member_unique ON agent_commissions(member_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agent_id ON agent_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON agent_commissions(status);

-- Backfill commissions for all already-approved members registered by agents
-- Commission: KES 180 for cover options 1-2, KES 250 for options 3-6
INSERT INTO agent_commissions (agent_id, member_id, cover_option, commission_amount, status, created_at, updated_at)
SELECT
  m.registered_by_agent,
  m.id,
  m.cover_option,
  CASE WHEN m.cover_option <= 2 THEN 180.00 ELSE 250.00 END,
  'pending',
  COALESCE(m.approval_date, m.updated_at),
  NOW()
FROM members m
JOIN users u ON u.id = m.registered_by_agent
WHERE m.status = 'active'
  AND m.registered_by_agent IS NOT NULL
  AND u.role = 'agent'
ON CONFLICT (member_id) DO NOTHING;
