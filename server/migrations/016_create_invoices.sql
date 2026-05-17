CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  member_id UUID REFERENCES members(id),
  client_name VARCHAR(255) NOT NULL,
  cover_option INTEGER CHECK (cover_option BETWEEN 1 AND 6),
  plan_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  membership_fee NUMERIC(10,2) NOT NULL DEFAULT 200,
  total_amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_member_id ON invoices(member_id);
