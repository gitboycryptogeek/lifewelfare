const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');

async function listUsers(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const role = req.query.role;

    let where = '';
    const params = [limit, offset];
    if (role) {
      where = 'WHERE role = $3';
      params.push(role);
    }

    const result = await pool.query(
      `SELECT id, full_name, email, phone, role, is_active, last_login, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${role ? 'WHERE role = $1' : ''}`,
      role ? [role] : []
    );

    return res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { full_name, phone, email, password, role } = req.body;

    const dupCheck = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'User with this phone already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, phone, email, password_hash, role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, full_name, phone, email, role, is_active, created_at`,
      [full_name, phone, email || null, passwordHash, role]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: `${role} account created successfully`,
    });
  } catch (err) {
    next(err);
  }
}

async function deactivateUser(req, res, next) {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
    }

    const result = await pool.query(
      `UPDATE users SET is_active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, full_name, role, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    return res.json({ success: true, data: result.rows[0], message: 'User deactivated' });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT a.*, u.full_name AS user_name, u.role AS user_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM audit_logs');

    return res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, deactivateUser, getAuditLogs };
