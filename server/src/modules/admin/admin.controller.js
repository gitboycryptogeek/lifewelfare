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
      `SELECT id, full_name, email, phone, role, is_active, last_login, created_at, team_leader_id
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

async function listTeamLeaders(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT u.id, u.full_name, u.phone, u.email, u.is_active, u.created_at,
              COUNT(a.id) AS agent_count
       FROM users u
       LEFT JOIN users a ON a.team_leader_id = u.id AND a.role = 'agent'
       WHERE u.role = 'team_leader'
       GROUP BY u.id, u.full_name, u.phone, u.email, u.is_active, u.created_at
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'team_leader'`);

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

async function assignTeamLeader(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { agentId } = req.params;
    const { teamLeaderId } = req.body;

    const agentResult = await pool.query('SELECT id, role, team_leader_id FROM users WHERE id = $1', [agentId]);
    if (agentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    if (agentResult.rows[0].role !== 'agent') {
      return res.status(400).json({ success: false, error: 'User is not an agent' });
    }

    const leaderResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [teamLeaderId]);
    if (leaderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Team leader not found' });
    }
    if (leaderResult.rows[0].role !== 'team_leader') {
      return res.status(400).json({ success: false, error: 'User is not a team leader' });
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE team_leader_id = $1 AND role = 'agent'`,
      [teamLeaderId]
    );
    const currentCount = parseInt(countResult.rows[0].count);

    const agentCurrentLeader = agentResult.rows[0].team_leader_id;
    const isAlreadyOnThisLeader = agentCurrentLeader === teamLeaderId;

    if (currentCount >= 10 && !isAlreadyOnThisLeader) {
      return res.status(409).json({ success: false, error: 'Team leader already has the maximum of 10 agents' });
    }

    const result = await pool.query(
      `UPDATE users SET team_leader_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, full_name, team_leader_id`,
      [teamLeaderId, agentId]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function unassignTeamLeader(req, res, next) {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      `UPDATE users SET team_leader_id = NULL, updated_at = NOW()
       WHERE id = $1 AND role = 'agent'
       RETURNING id, full_name, team_leader_id`,
      [agentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, deactivateUser, getAuditLogs, listTeamLeaders, assignTeamLeader, unassignTeamLeader };
