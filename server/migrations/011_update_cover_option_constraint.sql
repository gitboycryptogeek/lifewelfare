ALTER TABLE members DROP CONSTRAINT IF EXISTS members_cover_option_check;
ALTER TABLE members ADD CONSTRAINT members_cover_option_check CHECK (cover_option BETWEEN 1 AND 6);
