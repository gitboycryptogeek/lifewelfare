CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID REFERENCES users(id),
  channel VARCHAR(10) CHECK (channel IN ('sms', 'email', 'both')),
  recipient_type VARCHAR(20) CHECK (recipient_type IN ('all', 'member', 'agent', 'group')),
  recipient_ids UUID[],
  subject VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communications_sent_by ON communications(sent_by);
CREATE INDEX IF NOT EXISTS idx_communications_created ON communications(created_at DESC);
