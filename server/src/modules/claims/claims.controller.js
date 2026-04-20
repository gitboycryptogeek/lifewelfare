const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const { sendSMS } = require('../../utils/sms');
const { sendEmail } = require('../../utils/email');

async function submitClaim(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { member_id, claim_type, claim_amount, description } = req.body;

    // Validate member exists and is active
    const memberResult = await pool.query(
      "SELECT * FROM members WHERE id = $1 AND status NOT IN ('suspended', 'pending')",
      [member_id]
    );

    if (memberResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Member not found or not eligible for claims' });
    }

    const member = memberResult.rows[0];

    // Check max 6 claims per year per family
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);

    const claimCount = await pool.query(
      `SELECT COUNT(*) FROM claims
       WHERE member_id = $1 AND created_at >= $2 AND status != 'rejected'`,
      [member_id, yearStart.toISOString()]
    );

    if (parseInt(claimCount.rows[0].count) >= 6) {
      return res.status(400).json({ success: false, error: 'Maximum 6 claims per family per year has been reached' });
    }

    // Collect uploaded document URLs
    const documentUrls = req.files
      ? req.files.map((f) => `/uploads/documents/${f.filename}`)
      : [];

    const result = await pool.query(
      `INSERT INTO claims
        (member_id, membership_number, claim_type, claim_amount, description, submitted_by, document_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        member_id,
        member.membership_number,
        claim_type,
        claim_amount,
        description || null,
        req.user.id,
        documentUrls,
      ]
    );

    const claim = result.rows[0];

    // Update member status
    await pool.query(
      "UPDATE members SET status = 'claim_pending', updated_at = NOW() WHERE id = $1",
      [member_id]
    );

    // Notify member
    const smsMsg = `Dear ${member.full_name}, a claim of KES ${parseFloat(claim_amount).toLocaleString('en-KE')} has been submitted for your membership. Claim ref: ${claim.id.slice(0, 8).toUpperCase()}. We will be in touch.`;
    sendSMS(member.phone, smsMsg).catch(console.error);

    return res.status(201).json({ success: true, data: claim, message: 'Claim submitted successfully' });
  } catch (err) {
    next(err);
  }
}

async function listClaims(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let where = '';
    const params = [limit, offset];
    if (status) {
      where = 'WHERE c.status = $3';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT c.*, m.full_name AS member_name, m.phone AS member_phone
       FROM claims c
       LEFT JOIN members m ON m.id = c.member_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM claims ${status ? 'WHERE status = $1' : ''}`,
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

async function getClaim(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT c.*, m.full_name AS member_name, m.phone AS member_phone, m.email AS member_email, m.user_id
       FROM claims c
       LEFT JOIN members m ON m.id = c.member_id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claim = result.rows[0];

    // Members can only view their own claims
    if (req.user.role === 'member' && claim.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    return res.json({ success: true, data: claim });
  } catch (err) {
    next(err);
  }
}

async function updateClaimStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;

    const validStatuses = ['approved', 'rejected', 'paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const claimResult = await pool.query(
      `SELECT c.*, m.full_name AS member_name, m.phone, m.email, m.id AS member_table_id
       FROM claims c
       LEFT JOIN members m ON m.id = c.member_id
       WHERE c.id = $1`,
      [id]
    );

    if (claimResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    const claim = claimResult.rows[0];

    const updatedResult = await pool.query(
      `UPDATE claims SET
        status = $1,
        review_notes = COALESCE($2, review_notes),
        reviewed_by = $3,
        reviewed_at = NOW(),
        paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END,
        updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, review_notes, req.user.id, id]
    );

    // Update member status based on claim outcome
    if (status === 'paid') {
      await pool.query(
        "UPDATE members SET status = 'claim_settled', updated_at = NOW() WHERE id = $1",
        [claim.member_table_id]
      );
    } else if (status === 'rejected') {
      await pool.query(
        "UPDATE members SET status = 'active', updated_at = NOW() WHERE id = $1",
        [claim.member_table_id]
      );
    }

    // Notify member
    const statusMessages = {
      approved: `Dear ${claim.member_name}, your claim of KES ${parseFloat(claim.claim_amount).toLocaleString('en-KE')} has been APPROVED. Payment will be processed shortly.`,
      rejected: `Dear ${claim.member_name}, your claim has been reviewed. Unfortunately it has been REJECTED. ${review_notes ? 'Reason: ' + review_notes : ''} For queries call +254-118-043-715.`,
      paid: `Dear ${claim.member_name}, your claim payment of KES ${parseFloat(claim.claim_amount).toLocaleString('en-KE')} has been PAID. Thank you.`,
    };

    sendSMS(claim.phone, statusMessages[status]).catch(console.error);

    if (claim.email) {
      sendEmail({
        to: claim.email,
        subject: `Claim Update – My Life Companion Welfare`,
        html: `<p>${statusMessages[status]}</p>`,
      }).catch(console.error);
    }

    return res.json({ success: true, data: updatedResult.rows[0], message: `Claim ${status}` });
  } catch (err) {
    next(err);
  }
}

module.exports = { submitClaim, listClaims, getClaim, updateClaimStatus };
