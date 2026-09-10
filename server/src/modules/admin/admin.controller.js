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

async function updateUser(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { full_name, phone, email, role, password } = req.body;

    const existing = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Prevent an admin from demoting their own super_admin account (lock-out guard)
    if (id === req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ success: false, error: 'You cannot change your own role' });
    }

    if (phone) {
      const dup = await pool.query('SELECT id FROM users WHERE phone = $1 AND id <> $2', [phone, id]);
      if (dup.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'Another user already uses this phone' });
      }
    }
    if (email) {
      const dup = await pool.query('SELECT id FROM users WHERE email = $1 AND id <> $2', [email, id]);
      if (dup.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'Another user already uses this email' });
      }
    }

    const fields = [];
    const params = [];
    let i = 1;
    if (full_name !== undefined) { fields.push(`full_name = $${i++}`); params.push(full_name); }
    if (phone !== undefined) { fields.push(`phone = $${i++}`); params.push(phone); }
    if (email !== undefined) { fields.push(`email = $${i++}`); params.push(email || null); }
    if (role !== undefined) { fields.push(`role = $${i++}`); params.push(role); }
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      fields.push(`password_hash = $${i++}`); params.push(hash);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, full_name, phone, email, role, is_active, last_login, created_at, team_leader_id`,
      params
    );

    return res.json({ success: true, data: result.rows[0], message: 'User updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    const existing = await pool.query('SELECT id, full_name FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Guard against orphaning historical records tied to this user via
    // restricting foreign keys. If any exist, deactivation is the safe path.
    const refs = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM members WHERE registered_by_agent = $1) AS registered_members,
         (SELECT COUNT(*) FROM members WHERE approved_by = $1)         AS approved_members,
         (SELECT COUNT(*) FROM members WHERE user_id = $1)             AS linked_member,
         (SELECT COUNT(*) FROM prospects WHERE registered_by_agent = $1) AS prospects,
         (SELECT COUNT(*) FROM invoices WHERE created_by = $1)          AS invoices,
         (SELECT COUNT(*) FROM claims WHERE reviewed_by = $1 OR submitted_by = $1) AS claims,
         (SELECT COUNT(*) FROM communications WHERE sent_by = $1)       AS communications,
         (SELECT COUNT(*) FROM audit_logs WHERE user_id = $1)           AS audit_logs`,
      [id]
    );
    const r = refs.rows[0];
    const blocking = Object.entries(r).filter(([, v]) => parseInt(v) > 0);
    if (blocking.length > 0) {
      const detail = blocking.map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ');
      return res.status(409).json({
        success: false,
        error: `Cannot delete: user has linked records (${detail}). Deactivate the user instead.`,
      });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    return res.json({ success: true, message: 'User deleted' });
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

async function bulkCreateUsers(req, res, next) {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, error: 'users array is required and must not be empty' });
    }
    if (users.length > 100) {
      return res.status(400).json({ success: false, error: 'Maximum 100 users per bulk request' });
    }

    const validRoles = ['agent', 'admin', 'super_admin', 'team_leader'];
    const created = [];
    const failed = [];
    const byRole = {};

    for (let i = 0; i < users.length; i++) {
      const { full_name, phone, email, password, role } = users[i];
      const rowLabel = `Row ${i + 1}`;

      if (!full_name || !phone || !password || !role) {
        failed.push({ index: i, full_name: full_name || '(blank)', reason: 'Missing required fields (name, phone, password, role)' });
        continue;
      }
      if (password.length < 8) {
        failed.push({ index: i, full_name, reason: 'Password must be at least 8 characters' });
        continue;
      }
      if (!validRoles.includes(role)) {
        failed.push({ index: i, full_name, reason: `Invalid role: ${role}` });
        continue;
      }

      try {
        const dupCheck = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
        if (dupCheck.rows.length > 0) {
          failed.push({ index: i, full_name, reason: `Phone ${phone} already exists` });
          continue;
        }

        const hash = await bcrypt.hash(password, 12);
        const result = await pool.query(
          `INSERT INTO users (full_name, phone, email, password_hash, role)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, full_name, phone, email, role`,
          [full_name.trim(), phone.trim(), email?.trim() || null, hash, role]
        );

        const user = result.rows[0];
        created.push(user);
        byRole[role] = (byRole[role] || 0) + 1;
      } catch (err) {
        failed.push({ index: i, full_name, reason: err.message });
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        created,
        failed,
        summary: {
          total: users.length,
          created_count: created.length,
          failed_count: failed.length,
          by_role: byRole,
        },
      },
      message: `${created.length} of ${users.length} users created successfully`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser, bulkCreateUsers, updateUser, deleteUser, deactivateUser, getAuditLogs, listTeamLeaders, assignTeamLeader, unassignTeamLeader };
