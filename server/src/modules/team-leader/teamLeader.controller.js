const { pool } = require('../../config/db');

async function getTeamLeaderDashboard(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT a.id)                                   AS total_agents,
         COUNT(m.id)                                            AS total_recruits,
         COUNT(m.id) FILTER (WHERE m.status = 'active')        AS approved,
         COUNT(m.id) FILTER (WHERE m.status = 'pending')       AS pending,
         MAX(m.created_at)                                      AS last_registration
       FROM users a
       LEFT JOIN members m ON m.registered_by_agent = a.id
       WHERE a.team_leader_id = $1
         AND a.role = 'agent'
         AND a.is_active = true`,
      [req.user.id]
    );

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getTeamLeaderAgents(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT
         a.id,
         a.full_name AS agent_name,
         a.phone,
         a.is_active,
         COUNT(m.id)                                            AS total_recruits,
         COUNT(m.id) FILTER (WHERE m.status = 'active')        AS approved,
         COUNT(m.id) FILTER (WHERE m.status = 'pending')       AS pending,
         MAX(m.created_at)                                      AS last_registration
       FROM users a
       LEFT JOIN members m ON m.registered_by_agent = a.id
       WHERE a.team_leader_id = $1
         AND a.role = 'agent'
       GROUP BY a.id, a.full_name, a.phone, a.is_active
       ORDER BY total_recruits DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE team_leader_id = $1 AND role = 'agent'`,
      [req.user.id]
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

async function getAgentDetail(req, res, next) {
  try {
    const { agentId } = req.params;

    const agentResult = await pool.query(
      `SELECT
         a.id, a.full_name, a.phone, a.email, a.is_active, a.created_at,
         COUNT(m.id)                                            AS total_recruits,
         COUNT(m.id) FILTER (WHERE m.status = 'active')        AS approved,
         COUNT(m.id) FILTER (WHERE m.status = 'pending')       AS pending
       FROM users a
       LEFT JOIN members m ON m.registered_by_agent = a.id
       WHERE a.id = $1 AND a.team_leader_id = $2 AND a.role = 'agent'
       GROUP BY a.id, a.full_name, a.phone, a.email, a.is_active, a.created_at`,
      [agentId, req.user.id]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Agent not found or not in your team' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const membersResult = await pool.query(
      `SELECT
         m.id, m.full_name, m.membership_number, m.phone, m.id_passport_no,
         m.cover_option, m.status, m.registration_date, m.approval_date
       FROM members m
       WHERE m.registered_by_agent = $1
       ORDER BY m.registration_date DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM members WHERE registered_by_agent = $1',
      [agentId]
    );

    return res.json({
      success: true,
      data: {
        agent: agentResult.rows[0],
        members: membersResult.rows,
        meta: {
          total: parseInt(countResult.rows[0].count),
          page,
          limit,
          pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTeamLeaderDashboard, getTeamLeaderAgents, getAgentDetail };
