const { pool } = require('../config/db');

function generateOtpCode() {
  return Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

async function createOtp({ userId, purpose, contextRef = null }) {
  const code = generateOtpCode();

  // Remove any existing unused+unexpired OTPs for this user+purpose to prevent accumulation
  await pool.query(
    `DELETE FROM otps
     WHERE user_id = $1 AND purpose = $2 AND used = false AND expires_at > NOW()`,
    [userId, purpose]
  );

  const result = await pool.query(
    `INSERT INTO otps (user_id, purpose, code, context_ref, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '10 minutes')
     RETURNING expires_at`,
    [userId, purpose, code, contextRef ? JSON.stringify(contextRef) : null]
  );

  return { code, expiresAt: result.rows[0].expires_at };
}

async function verifyOtp({ userId, purpose, code, contextRef = null }) {
  if (process.env.DISABLE_OTP === 'true') return { bypassed: true };

  // Fire-and-forget cleanup — keeps the table lean
  deleteExpiredOtps().catch(() => {});

  let query;
  let params;

  if (contextRef) {
    query = `
      UPDATE otps SET used = true
      WHERE user_id = $1
        AND purpose = $2
        AND code = $3
        AND used = false
        AND expires_at > NOW()
        AND context_ref @> $4::jsonb
      RETURNING *`;
    params = [userId, purpose, code, JSON.stringify(contextRef)];
  } else {
    query = `
      UPDATE otps SET used = true
      WHERE user_id = $1
        AND purpose = $2
        AND code = $3
        AND used = false
        AND expires_at > NOW()
      RETURNING *`;
    params = [userId, purpose, code];
  }

  const result = await pool.query(query, params);

  if (result.rowCount === 0) {
    // Distinguish expired vs not found for better error messages
    const check = await pool.query(
      `SELECT used, expires_at FROM otps
       WHERE user_id = $1 AND purpose = $2 AND code = $3
       ORDER BY created_at DESC LIMIT 1`,
      [userId, purpose, code]
    );

    if (check.rows.length === 0) {
      const err = new Error('Invalid verification code');
      err.code = 'OTP_NOT_FOUND';
      throw err;
    }

    if (check.rows[0].used) {
      const err = new Error('This code has already been used');
      err.code = 'OTP_ALREADY_USED';
      throw err;
    }

    const err = new Error('Verification code has expired');
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  return result.rows[0];
}

async function deleteExpiredOtps() {
  await pool.query(`DELETE FROM otps WHERE expires_at < NOW() OR used = true`);
}

module.exports = { generateOtpCode, createOtp, verifyOtp, deleteExpiredOtps };
