ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company VARCHAR(20) NOT NULL DEFAULT 'mlc';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_company_check') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_company_check CHECK (company IN ('mlc', 'francis'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company);
