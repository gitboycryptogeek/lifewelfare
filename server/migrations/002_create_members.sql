CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  membership_number VARCHAR(30) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  id_passport_no VARCHAR(50) UNIQUE NOT NULL,
  kra_pin VARCHAR(20),
  dob DATE NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  physical_address TEXT,
  cover_option INTEGER CHECK (cover_option BETWEEN 1 AND 6),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'suspended', 'deceased', 'claim_pending', 'claim_settled')),
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  approval_date TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  registered_by_agent UUID REFERENCES users(id),
  medical_declaration BOOLEAN DEFAULT false,
  medical_conditions TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_agent ON members(registered_by_agent);
CREATE INDEX IF NOT EXISTS idx_members_membership_no ON members(membership_number);
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
