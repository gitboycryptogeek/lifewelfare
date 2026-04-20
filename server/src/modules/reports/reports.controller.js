const { pool } = require('../../config/db');
const PDFDocument = require('pdfkit');

async function getSummary(req, res, next) {
  try {
    const [members, claims, agents, recentRegs] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'suspended') AS suspended,
          COUNT(*) FILTER (WHERE status = 'deceased') AS deceased,
          COUNT(*) FILTER (WHERE status IN ('claim_pending','claim_settled')) AS claim_related
        FROM members
      `),
      pool.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending,
          COUNT(*) FILTER (WHERE status = 'approved') AS approved,
          COUNT(*) FILTER (WHERE status = 'paid') AS paid,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
          COALESCE(SUM(claim_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid_amount
        FROM claims
      `),
      pool.query(`SELECT COUNT(*) AS total FROM users WHERE role = 'agent' AND is_active = true`),
      pool.query(`
        SELECT m.full_name, m.membership_number, m.status, m.registration_date, u.full_name AS agent_name
        FROM members m
        LEFT JOIN users u ON u.id = m.registered_by_agent
        ORDER BY m.created_at DESC
        LIMIT 10
      `),
    ]);

    return res.json({
      success: true,
      data: {
        members: members.rows[0],
        claims: claims.rows[0],
        agents: agents.rows[0],
        recent_registrations: recentRegs.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getAgentLeaderboard(req, res, next) {
  try {
    const { period } = req.query; // 'month', 'week', 'all'
    let dateFilter = '';

    if (period === 'month') {
      dateFilter = "AND m.created_at >= DATE_TRUNC('month', NOW())";
    } else if (period === 'week') {
      dateFilter = "AND m.created_at >= DATE_TRUNC('week', NOW())";
    }

    // Agents can only see their own stats
    const agentFilter = req.user.role === 'agent' ? `AND u.id = '${req.user.id}'` : '';

    const result = await pool.query(`
      SELECT
        u.id,
        u.full_name AS agent_name,
        u.phone,
        COUNT(m.id) AS total_recruits,
        COUNT(m.id) FILTER (WHERE m.status = 'active') AS approved,
        COUNT(m.id) FILTER (WHERE m.status = 'pending') AS pending,
        MAX(m.created_at) AS last_registration
      FROM users u
      LEFT JOIN members m ON m.registered_by_agent = u.id ${dateFilter}
      WHERE u.role = 'agent' AND u.is_active = true ${agentFilter}
      GROUP BY u.id, u.full_name, u.phone
      ORDER BY total_recruits DESC
    `);

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getGrowthTrends(req, res, next) {
  try {
    const months = parseInt(req.query.months) || 12;

    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*) AS new_members,
        COUNT(*) FILTER (WHERE status = 'active') AS active_members
      FROM members
      WHERE created_at >= NOW() - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `);

    const claimsResult = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*) AS claims_submitted,
        COALESCE(SUM(claim_amount) FILTER (WHERE status = 'paid'), 0) AS amount_paid
      FROM claims
      WHERE created_at >= NOW() - INTERVAL '${months} months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month ASC
    `);

    return res.json({
      success: true,
      data: {
        membership_growth: result.rows,
        claims_trend: claimsResult.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getClaimsReport(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        m.full_name AS member_name,
        m.membership_number,
        m.phone AS member_phone
      FROM claims c
      LEFT JOIN members m ON m.id = c.member_id
      ORDER BY c.created_at DESC
      LIMIT 100
    `);

    const summary = await pool.query(`
      SELECT
        claim_type,
        COUNT(*) AS count,
        COALESCE(SUM(claim_amount), 0) AS total_amount,
        AVG(claim_amount) AS avg_amount
      FROM claims
      GROUP BY claim_type
      ORDER BY total_amount DESC
    `);

    return res.json({
      success: true,
      data: {
        claims: result.rows,
        by_type: summary.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function exportData(req, res, next) {
  try {
    const { type, format } = req.query;
    // type: 'members' | 'claims' | 'agents'
    // format: 'csv' | 'pdf'

    let data = [];
    let filename = '';

    if (type === 'members') {
      const result = await pool.query(`
        SELECT
          m.membership_number, m.full_name, m.id_passport_no, m.phone, m.email,
          m.gender, m.dob, m.cover_option, m.status, m.registration_date, m.approval_date,
          u.full_name AS agent_name
        FROM members m
        LEFT JOIN users u ON u.id = m.registered_by_agent
        ORDER BY m.created_at DESC
      `);
      data = result.rows;
      filename = `members-export-${Date.now()}`;
    } else if (type === 'claims') {
      const result = await pool.query(`
        SELECT
          c.id, m.membership_number, m.full_name AS member_name,
          c.claim_type, c.claim_amount, c.status, c.submitted_at, c.reviewed_at, c.paid_at
        FROM claims c
        LEFT JOIN members m ON m.id = c.member_id
        ORDER BY c.created_at DESC
      `);
      data = result.rows;
      filename = `claims-export-${Date.now()}`;
    } else if (type === 'agents') {
      const result = await pool.query(`
        SELECT
          u.full_name, u.phone, u.email,
          COUNT(m.id) AS total_recruits,
          COUNT(m.id) FILTER (WHERE m.status = 'active') AS approved,
          COUNT(m.id) FILTER (WHERE m.status = 'pending') AS pending
        FROM users u
        LEFT JOIN members m ON m.registered_by_agent = u.id
        WHERE u.role = 'agent'
        GROUP BY u.id, u.full_name, u.phone, u.email
        ORDER BY total_recruits DESC
      `);
      data = result.rows;
      filename = `agents-export-${Date.now()}`;
    } else {
      return res.status(400).json({ success: false, error: 'type must be members, claims, or agents' });
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      doc.pipe(res);

      doc.fontSize(16).font('Helvetica-Bold').text(`MLC Welfare — ${type.toUpperCase()} Report`, { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-KE')}`, { align: 'center' });
      doc.moveDown();

      if (data.length === 0) {
        doc.text('No data available.');
      } else {
        const headers = Object.keys(data[0]);
        data.forEach((row, i) => {
          if (i > 0) doc.moveDown(0.3);
          doc.fontSize(8).font('Helvetica-Bold').text(`Record ${i + 1}`, { underline: true });
          headers.forEach((h) => {
            doc.fontSize(8).font('Helvetica').text(`${h}: ${row[h] ?? '-'}`);
          });
        });
      }

      doc.end();
    } else {
      // CSV
      if (data.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        return res.send('No data available');
      }

      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(','),
        ...data.map((row) =>
          headers.map((h) => {
            const val = row[h] ?? '';
            const str = String(val).replace(/"/g, '""');
            return `"${str}"`;
          }).join(',')
        ),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csvRows.join('\n'));
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, getAgentLeaderboard, getGrowthTrends, getClaimsReport, exportData };
