CREATE TABLE IF NOT EXISTS membership_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID UNIQUE NOT NULL REFERENCES members(id),
  membership_number VARCHAR(30) NOT NULL,
  qr_code_data TEXT,
  card_url TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  emailed_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cards_member ON membership_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_cards_membership_no ON membership_cards(membership_number);
