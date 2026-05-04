const { pool } = require('../../config/db');

async function getMyCommissions(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         ac.id,
         ac.cover_option,
         ac.commission_amount,
         ac.status,
         ac.disbursed_at,
         ac.disbursement_notes,
         ac.created_at,
         m.full_name       AS member_name,
         m.membership_number,
         m.phone           AS member_phone
       FROM agent_commissions ac
       JOIN members m ON m.id = ac.member_id
       WHERE ac.agent_id = $1
       ORDER BY ac.created_at DESC`,
      [req.user.id]
    );

    const totals = await pool.query(
      `SELECT
         COALESCE(SUM(commission_amount), 0)                                        AS total_earned,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'disbursed'), 0)    AS disbursed,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0)      AS pending
       FROM agent_commissions
       WHERE agent_id = $1`,
      [req.user.id]
    );

    return res.json({
      success: true,
      data: {
        commissions: result.rows,
        summary: totals.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getCommissionsSummary(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(commission_amount), 0)                                        AS total_earned,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'disbursed'), 0)    AS total_disbursed,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0)      AS pending_disbursement,
         COUNT(*) FILTER (WHERE status = 'pending')                                 AS pending_count,
         COUNT(DISTINCT agent_id)                                                   AS agents_with_commissions
       FROM agent_commissions`
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getAllCommissions(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT
         u.id                                                                             AS agent_id,
         u.full_name                                                                      AS agent_name,
         u.phone                                                                          AS agent_phone,
         COUNT(ac.id)                                                                     AS total_commissions,
         COALESCE(SUM(ac.commission_amount), 0)                                          AS total_earned,
         COALESCE(SUM(ac.commission_amount) FILTER (WHERE ac.status = 'pending'), 0)     AS pending_amount,
         COALESCE(SUM(ac.commission_amount) FILTER (WHERE ac.status = 'disbursed'), 0)   AS disbursed_amount,
         MAX(ac.disbursed_at)                                                             AS last_disbursement
       FROM users u
       JOIN agent_commissions ac ON ac.agent_id = u.id
       WHERE u.role = 'agent'
       GROUP BY u.id, u.full_name, u.phone
       ORDER BY pending_amount DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT agent_id) FROM agent_commissions`
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

async function getAgentCommissions(req, res, next) {
  try {
    const { agentId } = req.params;

    const result = await pool.query(
      `SELECT
         ac.id,
         ac.cover_option,
         ac.commission_amount,
         ac.status,
         ac.disbursed_at,
         ac.disbursement_notes,
         ac.created_at,
         m.full_name       AS member_name,
         m.membership_number,
         m.phone           AS member_phone
       FROM agent_commissions ac
       JOIN members m ON m.id = ac.member_id
       WHERE ac.agent_id = $1
       ORDER BY ac.created_at DESC`,
      [agentId]
    );

    const totals = await pool.query(
      `SELECT
         COALESCE(SUM(commission_amount), 0)                                        AS total_earned,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'disbursed'), 0)    AS disbursed,
         COALESCE(SUM(commission_amount) FILTER (WHERE status = 'pending'), 0)      AS pending
       FROM agent_commissions
       WHERE agent_id = $1`,
      [agentId]
    );

    return res.json({
      success: true,
      data: {
        commissions: result.rows,
        summary: totals.rows[0],
      },
    });
  } catch (err) {
    next(err);
  }
}

async function disburseCommissions(req, res, next) {
  try {
    const { agent_id, notes, from_date, to_date } = req.body;

    if (!agent_id) {
      return res.status(400).json({ success: false, error: 'agent_id is required' });
    }

    const agentCheck = await pool.query(
      `SELECT id, full_name FROM users WHERE id = $1 AND role = 'agent'`,
      [agent_id]
    );
    if (agentCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    let query = `
      UPDATE agent_commissions
      SET status = 'disbursed',
          disbursed_at = NOW(),
          disbursed_by = $1,
          disbursement_notes = $2,
          updated_at = NOW()
      WHERE agent_id = $3
        AND status = 'pending'
    `;
    const params = [req.user.id, notes || null, agent_id];

    if (from_date) {
      params.push(from_date);
      query += ` AND created_at >= $${params.length}`;
    }
    if (to_date) {
      params.push(to_date);
      query += ` AND created_at <= $${params.length}`;
    }

    query += ' RETURNING id';

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      message: `${result.rowCount} commission(s) marked as disbursed for ${agentCheck.rows[0].full_name}`,
      data: { disbursed_count: result.rowCount },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyCommissions,
  getCommissionsSummary,
  getAllCommissions,
  getAgentCommissions,
  disburseCommissions,
};
