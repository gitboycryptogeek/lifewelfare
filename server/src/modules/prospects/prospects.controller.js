const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');

async function registerProspect(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { full_name, phone, email, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO prospects (full_name, phone, email, notes, registered_by_agent)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [full_name, phone, email || null, notes || null, req.user.id]
    );

    return res.status(201).json({ success: true, data: result.rows[0], message: 'Prospect registered successfully' });
  } catch (err) {
    next(err);
  }
}

async function listProspects(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    const params = [limit, offset];
    let where = '';
    if (status) {
      where = 'WHERE p.status = $3';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT p.*, u.full_name AS agent_name
       FROM prospects p
       LEFT JOIN users u ON u.id = p.registered_by_agent
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM prospects ${status ? 'WHERE status = $1' : ''}`,
      status ? [status] : []
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

async function getMyProspects(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT * FROM prospects
       WHERE registered_by_agent = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getAgentProspects(req, res, next) {
  try {
    const { agentId } = req.params;

    // Verify agent belongs to this team leader
    const agentCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND team_leader_id = $2 AND role = 'agent'`,
      [agentId, req.user.id]
    );
    if (agentCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Agent not found or not in your team' });
    }

    const result = await pool.query(
      `SELECT * FROM prospects
       WHERE registered_by_agent = $1
       ORDER BY created_at DESC`,
      [agentId]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function approveProspect(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE prospects
       SET status = 'approved', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Prospect not found' });
    }

    return res.json({ success: true, data: result.rows[0], message: 'Prospect approved' });
  } catch (err) {
    next(err);
  }
}

module.exports = { registerProspect, listProspects, getMyProspects, getAgentProspects, approveProspect };
