-- One-time password table for all OTP-gated flows.
-- purpose pins the code to a specific flow so a login OTP cannot be
-- reused for a password reset.
CREATE TABLE IF NOT EXISTS otps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     VARCHAR(30) NOT NULL
              CHECK (purpose IN (
                'login', 'member_login', 'forgot_password',
                'change_password', 'edit_member', 'disburse'
              )),
  code        VARCHAR(6) NOT NULL,
  -- Optional JSON ref that pins an action OTP to a specific resource
  -- e.g. {"member_id":"..."} or {"agent_id":"..."}
  context_ref JSONB,
  used        BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otps_user_purpose
  ON otps(user_id, purpose, used, expires_at);
