const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const { createOtp, verifyOtp } = require('../../utils/otp');
const { sendEmail } = require('../../utils/email');
const { normalisePhone } = require('../../utils/phone');
const {
  loginOtpEmail,
  memberLoginOtpEmail,
  forgotPasswordOtpEmail,
  actionOtpEmail,
} = require('../../utils/otpEmails');

// ─── Shared token helpers (same as auth.controller) ─────────────────────────

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function issueTokensAndRespond(res, user, message = 'Login successful') {
  const payload = { id: user.id, role: user.role, phone: user.phone };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  setRefreshCookie(res, refreshToken);
  return res.json({
    success: true,
    data: {
      token: accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    },
    message,
  });
}

// ─── Step 1: agent / admin / team_leader login ───────────────────────────────
// Replaces the old auth.controller.login — validates credentials then sends OTP
async function requestLoginOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { phone: rawPhone, password } = req.body;
    const phone = normalisePhone(rawPhone);

    const result = await pool.query(
      'SELECT * FROM users WHERE (phone = $1 OR phone = $2) AND is_active = true',
      [rawPhone, phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        error: 'This account uses email/phone login. Please use the Member tab.',
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.email) {
      return res.status(422).json({
        success: false,
        error: 'No email address on file. Please contact an administrator.',
      });
    }

    if (process.env.DISABLE_OTP === 'true') {
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
      return issueTokensAndRespond(res, user);
    }

    const { code } = await createOtp({ userId: user.id, purpose: 'login' });
    const { subject, html } = loginOtpEmail({ fullName: user.full_name, code });
    await sendEmail({ to: user.email, subject, html });

    const otpSessionToken = jwt.sign(
      { sub: user.id, purpose: 'login' },
      process.env.JWT_OTP_SECRET,
      { expiresIn: '5m' }
    );

    return res.json({
      success: true,
      data: { otpSessionToken },
      message: 'OTP sent to your registered email',
    });
  } catch (err) {
    next(err);
  }
}

// ─── Step 2: verify OTP and issue real JWT (agents / admins) ─────────────────
async function verifyLoginOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { otpSessionToken, code } = req.body;

    let payload;
    try {
      payload = jwt.verify(otpSessionToken, process.env.JWT_OTP_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
    }

    if (payload.purpose !== 'login') {
      return res.status(401).json({ success: false, error: 'Invalid session token' });
    }

    try {
      await verifyOtp({ userId: payload.sub, purpose: 'login', code });
    } catch (err) {
      return res.status(401).json({ success: false, error: err.message });
    }

    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, is_active FROM users WHERE id = $1',
      [payload.sub]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(401).json({ success: false, error: 'Account not found or deactivated' });
    }

    const user = result.rows[0];
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    return issueTokensAndRespond(res, user);
  } catch (err) {
    next(err);
  }
}

// ─── Shared helper: find or create a member user row ────────────────────────
async function findOrCreateMemberUser(identifier) {
  const isEmail = identifier.includes('@');
  const normalised = isEmail ? identifier.trim().toLowerCase() : normalisePhone(identifier);

  // 1. Try users table first (member role)
  const userResult = await pool.query(
    `SELECT id, full_name, email, phone, role, is_active
     FROM users WHERE (email = $1 OR phone = $1) AND role = 'member'`,
    [normalised]
  );

  if (userResult.rows.length > 0) {
    const u = userResult.rows[0];
    if (!u.is_active) {
      const err = new Error('Account is deactivated. Please contact support.');
      err.status = 401;
      throw err;
    }
    return u;
  }

  // 2. Fall back to members table
  const memberResult = await pool.query(
    `SELECT id, full_name, email, phone, user_id
     FROM members WHERE email = $1 OR phone = $1
     ORDER BY created_at ASC LIMIT 1`,
    [normalised]
  );

  if (memberResult.rows.length === 0) {
    const err = new Error(
      'No registered member found with that email or phone. Please contact your agent or call +254-118-043-715.'
    );
    err.status = 404;
    throw err;
  }

  const member = memberResult.rows[0];

  // 3. If member already has a linked user, fetch and return it
  if (member.user_id) {
    const linkedUser = await pool.query(
      'SELECT id, full_name, email, phone, role, is_active FROM users WHERE id = $1',
      [member.user_id]
    );
    if (linkedUser.rows.length > 0) {
      const u = linkedUser.rows[0];
      if (!u.is_active) {
        const err = new Error('Account is deactivated. Please contact support.');
        err.status = 401;
        throw err;
      }
      return u;
    }
  }

  // 4. Create a new user row for this member
  const newUser = await pool.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
     VALUES ($1, $2, $3, NULL, 'member', true)
     RETURNING id, full_name, email, phone, role, is_active`,
    [member.full_name, member.email, member.phone]
  );

  await pool.query('UPDATE members SET user_id = $1 WHERE id = $2', [
    newUser.rows[0].id,
    member.id,
  ]);

  return newUser.rows[0];
}

// ─── Step 1: member passwordless login ──────────────────────────────────────
async function requestMemberOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { identifier } = req.body;

    let user;
    try {
      user = await findOrCreateMemberUser(identifier);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, error: err.message });
    }

    if (!user.email) {
      return res.status(422).json({
        success: false,
        error: 'No email address on file. Please contact your agent or call +254-118-043-715.',
      });
    }

    if (process.env.DISABLE_OTP === 'true') {
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
      return issueTokensAndRespond(res, user);
    }

    const { code } = await createOtp({ userId: user.id, purpose: 'member_login' });
    const { subject, html } = memberLoginOtpEmail({ fullName: user.full_name, code });
    await sendEmail({ to: user.email, subject, html });

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    next(err);
  }
}

// ─── Step 2: verify OTP and issue JWT for member ─────────────────────────────
async function verifyMemberOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { identifier, code } = req.body;

    let user;
    try {
      user = await findOrCreateMemberUser(identifier);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, error: err.message });
    }

    try {
      await verifyOtp({ userId: user.id, purpose: 'member_login', code });
    } catch (err) {
      return res.status(401).json({ success: false, error: err.message });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    return issueTokensAndRespond(res, user);
  } catch (err) {
    next(err);
  }
}

// ─── Forgot password: send OTP ───────────────────────────────────────────────
async function requestForgotPasswordOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { identifier } = req.body;
    const isEmail = identifier.includes('@');
    const normalised = isEmail ? identifier.trim().toLowerCase() : normalisePhone(identifier);

    const GENERIC_MSG = 'If that account exists, an OTP has been sent to the registered email.';

    const result = await pool.query(
      `SELECT id, full_name, email, role FROM users
       WHERE (email = $1 OR phone = $1) AND is_active = true LIMIT 1`,
      [normalised]
    );

    // Always respond 200 to prevent enumeration
    if (result.rows.length === 0) {
      return res.json({ success: true, message: GENERIC_MSG });
    }

    const user = result.rows[0];

    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Super admin accounts cannot use self-service password reset. Contact the system owner.',
      });
    }

    if (!user.email) {
      return res.json({ success: true, message: GENERIC_MSG });
    }

    const { code } = await createOtp({ userId: user.id, purpose: 'forgot_password' });
    const { subject, html } = forgotPasswordOtpEmail({ fullName: user.full_name, code });
    await sendEmail({ to: user.email, subject, html });

    return res.json({ success: true, message: GENERIC_MSG });
  } catch (err) {
    next(err);
  }
}

// ─── Forgot password: verify OTP and set new password ───────────────────────
async function resetPasswordWithOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { identifier, code, new_password } = req.body;
    const isEmail = identifier.includes('@');
    const normalised = isEmail ? identifier.trim().toLowerCase() : normalisePhone(identifier);

    const result = await pool.query(
      `SELECT id, role FROM users
       WHERE (email = $1 OR phone = $1) AND is_active = true LIMIT 1`,
      [normalised]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }

    const user = result.rows[0];

    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'Super admin accounts cannot use self-service password reset.',
      });
    }

    try {
      await verifyOtp({ userId: user.id, purpose: 'forgot_password', code });
    } catch (err) {
      return res.status(401).json({ success: false, error: err.message });
    }

    const hash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [hash, user.id]
    );

    return res.json({ success: true, message: 'Password reset successfully. Please log in.' });
  } catch (err) {
    next(err);
  }
}

// ─── Request OTP for a protected action (requires auth middleware) ────────────
async function requestActionOtp(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { purpose, context_ref } = req.body;
    const userId = req.user.id;

    // Role checks for sensitive actions
    if (purpose === 'edit_member' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: 'Only super admin can perform this action' });
    }
    if (purpose === 'disburse' && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const userResult = await pool.query(
      'SELECT full_name, email FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const { full_name, email } = userResult.rows[0];

    if (!email) {
      return res.status(422).json({
        success: false,
        error: 'No email address on file. Please contact an administrator.',
      });
    }

    if (process.env.DISABLE_OTP === 'true') {
      return res.json({ success: true, message: 'OTP bypassed (DISABLE_OTP=true)' });
    }

    const { code } = await createOtp({ userId, purpose, contextRef: context_ref || null });
    const { subject, html } = actionOtpEmail({ fullName: full_name, code, purpose });
    await sendEmail({ to: email, subject, html });

    return res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requestLoginOtp,
  verifyLoginOtp,
  requestMemberOtp,
  verifyMemberOtp,
  requestForgotPasswordOtp,
  resetPasswordWithOtp,
  requestActionOtp,
};
