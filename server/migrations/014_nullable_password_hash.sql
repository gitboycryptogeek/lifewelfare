-- Allow members to log in without a password (OTP-only passwordless flow).
-- Existing staff rows retain their password_hash value; only the NOT NULL
-- constraint is removed so new member user rows can store NULL.
ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;
