UPDATE members SET cover_option = 2 WHERE cover_option = 1;
UPDATE members SET cover_option = 5 WHERE cover_option = 6;
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_cover_option_check;
ALTER TABLE members ADD CONSTRAINT members_cover_option_check CHECK (cover_option BETWEEN 2 AND 5);
