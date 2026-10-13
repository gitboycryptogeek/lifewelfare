ALTER TABLE invoices ADD COLUMN IF NOT EXISTS policy_number VARCHAR(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS dependants JSONB;
CREATE SEQUENCE IF NOT EXISTS francis_policy_seq START 1;

-- Backfill policy numbers for existing Francis Funeral plan invoices
UPDATE invoices
SET policy_number = 'FFH-POL-' || EXTRACT(YEAR FROM created_at)::int || '-' || LPAD(nextval('francis_policy_seq')::text, 5, '0')
WHERE company = 'francis' AND cover_option IS NOT NULL AND policy_number IS NULL;
