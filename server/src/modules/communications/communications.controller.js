const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const { sendSMS } = require('../../utils/sms');
const { sendEmail } = require('../../utils/email');

async function sendCommunication(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { channel, recipient_type, recipient_ids, subject, message } = req.body;

    // Resolve recipients
    let recipients = [];

    if (recipient_type === 'all') {
      const result = await pool.query(
        "SELECT phone, email, full_name FROM members WHERE status = 'active'"
      );
      recipients = result.rows;
    } else if (recipient_type === 'agent') {
      const result = await pool.query(
        "SELECT phone, email, full_name FROM users WHERE role = 'agent' AND is_active = true"
      );
      recipients = result.rows;
    } else if (recipient_type === 'prospects') {
      const result = await pool.query(
        "SELECT phone, email, full_name FROM prospects WHERE email IS NOT NULL"
      );
      recipients = result.rows;
    } else if (recipient_type === 'member' && recipient_ids?.length > 0) {
      const result = await pool.query(
        'SELECT phone, email, full_name FROM members WHERE id = ANY($1)',
        [recipient_ids]
      );
      recipients = result.rows;
    } else if (recipient_type === 'group' && recipient_ids?.length > 0) {
      const result = await pool.query(
        'SELECT phone, email, full_name FROM members WHERE id = ANY($1)',
        [recipient_ids]
      );
      recipients = result.rows;
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        if (channel === 'sms' || channel === 'both') {
          if (recipient.phone) {
            await sendSMS(recipient.phone, message);
            sentCount++;
          }
        }
        if (channel === 'email' || channel === 'both') {
          if (recipient.email) {
            await sendEmail({
              to: recipient.email,
              subject: subject || 'Message from My Life Companion Welfare',
              html: `<p>${message.replace(/\n/g, '<br/>')}</p>`,
              text: message,
            });
            if (channel === 'email') sentCount++;
          }
        }
      } catch {
        failedCount++;
      }
    }

    // Log communication
    const logResult = await pool.query(
      `INSERT INTO communications (sent_by, channel, recipient_type, recipient_ids, subject, message, sent_count, failed_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        req.user.id,
        channel,
        recipient_type,
        recipient_ids || null,
        subject || null,
        message,
        sentCount,
        failedCount,
      ]
    );

    return res.json({
      success: true,
      data: logResult.rows[0],
      message: `Communication sent to ${sentCount} recipients (${failedCount} failed)`,
    });
  } catch (err) {
    next(err);
  }
}

async function listCommunications(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT c.*, u.full_name AS sent_by_name
       FROM communications c
       LEFT JOIN users u ON u.id = c.sent_by
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM communications');

    return res.json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendCommunication, listCommunications };
