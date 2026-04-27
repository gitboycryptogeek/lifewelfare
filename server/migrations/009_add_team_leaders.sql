-- Extend role CHECK constraint to include team_leader
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('member', 'agent', 'admin', 'super_admin', 'team_leader'));

-- Add team_leader_id FK on users (each agent points to their team leader)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_leader_id UUID
    REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_team_leader ON users(team_leader_id);
