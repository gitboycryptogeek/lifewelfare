const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');

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

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { phone: rawPhone, password } = req.body;

    // Normalise phone: accept 07XX, 254XX, +254XX — store/query as +254XX
    function normalisePhone(p) {
      const digits = p.replace(/\D/g, '');
      if (digits.startsWith('254')) return '+' + digits;
      if (digits.startsWith('0')) return '+254' + digits.slice(1);
      return p; // already has + or unknown format — pass through
    }
    const phone = normalisePhone(rawPhone);

    // Try exact match first, then normalised
    const result = await pool.query(
      'SELECT * FROM users WHERE (phone = $1 OR phone = $2) AND is_active = true',
      [rawPhone, phone]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const payload = { id: user.id, role: user.role, phone: user.phone };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No refresh token' });
    }

    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const result = await pool.query(
      'SELECT id, role, phone, full_name, email FROM users WHERE id = $1 AND is_active = true',
      [payload.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const user = result.rows[0];
    const newPayload = { id: user.id, role: user.role, phone: user.phone };
    const accessToken = signAccessToken(newPayload);

    return res.json({ success: true, data: { token: accessToken }, message: 'Token refreshed' });
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
}

async function logout(req, res) {
  res.clearCookie('refreshToken');
  return res.json({ success: true, message: 'Logged out successfully' });
}

async function me(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, role, is_active, last_login, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, refresh, logout, me };
