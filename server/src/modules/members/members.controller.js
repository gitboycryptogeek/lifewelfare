const { validationResult } = require('express-validator');
const { pool } = require('../../config/db');
const { generateMembershipNumber } = require('../../utils/memberNumber');
const { sendSMS } = require('../../utils/sms');
const { sendEmail } = require('../../utils/email');
const { generateCardPDF, generateCardPNG, emailMemberCard } = require('../cards/cards.service');

async function registerMember(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const {
      full_name, id_passport_no, kra_pin, dob, gender, phone, email,
      physical_address, cover_option, medical_declaration, medical_conditions, notes,
    } = req.body;

    // Check for duplicate ID
    const dupCheck = await pool.query('SELECT id FROM members WHERE id_passport_no = $1', [id_passport_no]);
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Member with this ID/Passport already exists' });
    }

    const result = await pool.query(
      `INSERT INTO members
        (full_name, id_passport_no, kra_pin, dob, gender, phone, email, physical_address,
         cover_option, medical_declaration, medical_conditions, notes, registered_by_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        full_name, id_passport_no, kra_pin || null, dob, gender, phone, email || null,
        physical_address || null, cover_option,
        medical_declaration || false,
        medical_conditions || [],
        notes || null,
        req.user.id,
      ]
    );

    const member = result.rows[0];

    // Notify member of registration received
    const smsMsg = `Hello ${full_name}, we have received your registration with My Life Companion Welfare. Processing is underway. For queries call +254-118-043-715.`;
    sendSMS(phone, smsMsg).catch(console.error);

    if (email) {
      sendEmail({
        to: email,
        subject: 'Registration Received – My Life Companion Welfare',
        html: `<p>Dear ${full_name},</p><p>We have received your registration with My Life Companion Welfare. Our team is reviewing your application and will be in touch shortly.</p><p>For queries, contact us at +254-118-043-715 or info@mylife-companion.com</p><p>Regards,<br/>My Life Companion Welfare</p>`,
      }).catch(console.error);
    }

    return res.status(201).json({ success: true, data: member, message: 'Member registered successfully' });
  } catch (err) {
    next(err);
  }
}

async function listMembers(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let whereClause = '';
    const params = [limit, offset];
    if (status) {
      whereClause = 'WHERE m.status = $3';
      params.push(status);
    }

    const result = await pool.query(
      `SELECT m.*, u.full_name AS agent_name
       FROM members m
       LEFT JOIN users u ON u.id = m.registered_by_agent
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM members ${status ? 'WHERE status = $1' : ''}`,
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

async function getMember(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT m.*, u.full_name AS agent_name, a.full_name AS approved_by_name
       FROM members m
       LEFT JOIN users u ON u.id = m.registered_by_agent
       LEFT JOIN users a ON a.id = m.approved_by
       WHERE m.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    const member = result.rows[0];

    // Members can only view their own profile
    if (req.user.role === 'member' && member.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    return res.json({ success: true, data: member });
  } catch (err) {
    next(err);
  }
}

async function updateMember(req, res, next) {
  try {
    const { id } = req.params;
    const {
      full_name, email, phone, physical_address, kra_pin,
      medical_declaration, medical_conditions, notes,
      id_passport_no, dob, gender, cover_option,
    } = req.body;

    const result = await pool.query(
      `UPDATE members SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone),
        physical_address = COALESCE($4, physical_address),
        kra_pin = COALESCE($5, kra_pin),
        medical_declaration = COALESCE($6, medical_declaration),
        medical_conditions = COALESCE($7, medical_conditions),
        notes = COALESCE($8, notes),
        id_passport_no = COALESCE($10, id_passport_no),
        dob = COALESCE($11, dob),
        gender = COALESCE($12, gender),
        cover_option = COALESCE($13, cover_option),
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [full_name, email, phone, physical_address, kra_pin, medical_declaration, medical_conditions, notes, id,
       id_passport_no, dob || null, gender, cover_option ? parseInt(cover_option) : null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    return res.json({ success: true, data: result.rows[0], message: 'Member updated successfully' });
  } catch (err) {
    next(err);
  }
}

async function approveMember(req, res, next) {
  try {
    const { id } = req.params;

    // Get member
    const memberResult = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    const member = memberResult.rows[0];
    if (member.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Only pending members can be approved' });
    }

    const membershipNumber = await generateMembershipNumber();

    const updated = await pool.query(
      `UPDATE members SET
        status = 'active',
        membership_number = $1,
        approval_date = NOW(),
        approved_by = $2,
        updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [membershipNumber, req.user.id, id]
    );

    const approvedMember = updated.rows[0];

    // Generate and send membership card
    try {
      await generateCardPDF(approvedMember);
    } catch (cardErr) {
      console.error('Card generation error:', cardErr.message);
    }

    // Notify member
    const memberSMS = `Congratulations ${approvedMember.full_name}! Your My Life Companion Welfare membership is ACTIVE. Your membership number is ${membershipNumber}. Welcome to the family!`;
    sendSMS(approvedMember.phone, memberSMS).catch(console.error);

    if (approvedMember.email) {
      sendEmail({
        to: approvedMember.email,
        subject: 'Welcome to My Life Companion Welfare – Membership Approved',
        html: `<p>Dear ${approvedMember.full_name},</p><p>Congratulations! Your membership has been approved.</p><p><strong>Membership Number: ${membershipNumber}</strong></p><p>Welcome to the My Life Companion Welfare family!</p><p>For queries, contact us at +254-118-043-715 or info@mylife-companion.com</p><p>Regards,<br/>My Life Companion Welfare</p>`,
      }).catch(console.error);
    }

    // Notify agent
    if (approvedMember.registered_by_agent) {
      const agentResult = await pool.query('SELECT phone FROM users WHERE id = $1', [approvedMember.registered_by_agent]);
      if (agentResult.rows.length > 0) {
        const agentSMS = `Your registration of ${approvedMember.full_name} (ID: ${approvedMember.id_passport_no}) has been approved. Membership No: ${membershipNumber}`;
        sendSMS(agentResult.rows[0].phone, agentSMS).catch(console.error);
      }
    }

    return res.json({ success: true, data: approvedMember, message: `Member approved. Membership number: ${membershipNumber}` });
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['active', 'suspended', 'deceased', 'claim_pending', 'claim_settled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await pool.query(
      `UPDATE members SET status = $1, notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    return res.json({ success: true, data: result.rows[0], message: 'Status updated' });
  } catch (err) {
    next(err);
  }
}

async function searchMembers(req, res, next) {
  try {
    const { q } = req.query;

    // Empty query — agents see all their own members, admins need a search term
    if (!q) {
      if (req.user.role === 'agent') {
        const result = await pool.query(
          `SELECT m.*, u.full_name AS agent_name
           FROM members m
           LEFT JOIN users u ON u.id = m.registered_by_agent
           WHERE m.registered_by_agent = $1
           ORDER BY m.created_at DESC LIMIT 100`,
          [req.user.id]
        );
        return res.json({ success: true, data: result.rows });
      }
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }

    let baseQuery = `
      SELECT m.*, u.full_name AS agent_name
      FROM members m
      LEFT JOIN users u ON u.id = m.registered_by_agent
      WHERE (
        m.full_name ILIKE $1 OR
        m.id_passport_no ILIKE $1 OR
        m.phone ILIKE $1 OR
        m.membership_number ILIKE $1 OR
        m.email ILIKE $1
      )
    `;
    const params = [`%${q}%`];

    // Agents only see their own registered members
    if (req.user.role === 'agent') {
      baseQuery += ' AND m.registered_by_agent = $2';
      params.push(req.user.id);
    }

    baseQuery += ' ORDER BY m.created_at DESC LIMIT 50';

    const result = await pool.query(baseQuery, params);
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function downloadCard(req, res, next) {
  const fs = require('fs');
  try {
    const { id } = req.params;

    // Access control
    if (req.user.role === 'member') {
      const check = await pool.query('SELECT user_id FROM members WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    // Check existing card record
    let cardResult = await pool.query('SELECT * FROM membership_cards WHERE member_id = $1', [id]);
    let cardPath = cardResult.rows[0]?.card_url;

    // Auto-generate if no DB record or file is missing
    const needsGeneration = cardResult.rows.length === 0 || !cardPath || !fs.existsSync(cardPath);

    if (needsGeneration) {
      const memberResult = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
      if (memberResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Member not found' });
      }
      const member = memberResult.rows[0];
      if (!member.membership_number) {
        return res.status(404).json({ success: false, error: 'Membership card not yet generated — member pending approval' });
      }

      cardPath = await generateCardPNG(member);

      // Re-fetch updated DB record for membership_number
      cardResult = await pool.query('SELECT * FROM membership_cards WHERE member_id = $1', [id]);
    }

    const card = cardResult.rows[0];

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="membership-card-${card.membership_number}.png"`);
    res.setHeader('Cache-Control', 'no-cache');
    // Allow cross-origin so blob URL construction works in the browser
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    fs.createReadStream(cardPath).pipe(res);
  } catch (err) {
    next(err);
  }
}

// Dependents
async function addDependent(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { full_name, relationship, dob, id_or_birth_cert_no } = req.body;

    const result = await pool.query(
      `INSERT INTO dependents (member_id, full_name, relationship, dob, id_or_birth_cert_no)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id, full_name, relationship, dob || null, id_or_birth_cert_no || null]
    );

    return res.status(201).json({ success: true, data: result.rows[0], message: 'Dependent added' });
  } catch (err) {
    next(err);
  }
}

async function getDependents(req, res, next) {
  try {
    const { id } = req.params;

    if (req.user.role === 'member') {
      const check = await pool.query('SELECT user_id FROM members WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const result = await pool.query(
      'SELECT * FROM dependents WHERE member_id = $1 ORDER BY created_at',
      [id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function removeDependent(req, res, next) {
  try {
    const { id, depId } = req.params;
    await pool.query('DELETE FROM dependents WHERE id = $1 AND member_id = $2', [depId, id]);
    return res.json({ success: true, message: 'Dependent removed' });
  } catch (err) {
    next(err);
  }
}

// Beneficiaries
async function addBeneficiary(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { full_name, relationship, phone, id_passport_no, address, location } = req.body;

    const result = await pool.query(
      `INSERT INTO beneficiaries (member_id, full_name, relationship, phone, id_passport_no, address, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, full_name, relationship, phone || null, id_passport_no || null, address || null, location || null]
    );

    return res.status(201).json({ success: true, data: result.rows[0], message: 'Beneficiary added' });
  } catch (err) {
    next(err);
  }
}

async function getBeneficiaries(req, res, next) {
  try {
    const { id } = req.params;

    if (req.user.role === 'member') {
      const check = await pool.query('SELECT user_id FROM members WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const result = await pool.query(
      'SELECT * FROM beneficiaries WHERE member_id = $1 ORDER BY created_at',
      [id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function removeBeneficiary(req, res, next) {
  try {
    const { id, benId } = req.params;
    await pool.query('DELETE FROM beneficiaries WHERE id = $1 AND member_id = $2', [benId, id]);
    return res.json({ success: true, message: 'Beneficiary removed' });
  } catch (err) {
    next(err);
  }
}

async function uploadDocuments(req, res, next) {
  try {
    const { id } = req.params;

    const memberCheck = await pool.query('SELECT id FROM members WHERE id = $1', [id]);
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const results = [];
    for (const file of req.files) {
      const relativePath = 'documents/' + file.filename;
      const result = await pool.query(
        `INSERT INTO member_documents (member_id, original_name, file_path, file_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, file.originalname, relativePath, file.mimetype, req.user.id]
      );
      results.push(result.rows[0]);
    }

    return res.status(201).json({ success: true, data: results, message: `${results.length} document(s) uploaded` });
  } catch (err) {
    next(err);
  }
}

async function getDocuments(req, res, next) {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT d.*, u.full_name AS uploaded_by_name
       FROM member_documents d
       LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.member_id = $1
       ORDER BY d.created_at ASC`,
      [id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

async function getMemberClaims(req, res, next) {
  try {
    const { id } = req.params;

    if (req.user.role === 'member') {
      const check = await pool.query('SELECT user_id FROM members WHERE id = $1', [id]);
      if (check.rows.length === 0 || check.rows[0].user_id !== req.user.id) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
    }

    const result = await pool.query(
      'SELECT * FROM claims WHERE member_id = $1 ORDER BY created_at DESC',
      [id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  }
}

// Public: verify membership by number (no auth — used by QR code scans)
async function verifyMember(req, res, next) {
  try {
    const { membershipNumber } = req.params;
    const result = await pool.query(
      `SELECT full_name, membership_number, status, cover_option, approval_date
       FROM members WHERE membership_number = $1`,
      [membershipNumber]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Membership number not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// Admin: resend card PNG to member email
async function emailCard(req, res, next) {
  try {
    const { id } = req.params;
    const memberResult = await pool.query('SELECT * FROM members WHERE id = $1', [id]);
    if (memberResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    const member = memberResult.rows[0];
    if (!member.membership_number) {
      return res.status(400).json({ success: false, error: 'Member has not been approved yet' });
    }
    if (!member.email) {
      return res.status(400).json({ success: false, error: 'Member has no email address on file' });
    }
    await emailMemberCard(member);
    return res.json({ success: true, message: `Card sent to ${member.email}` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerMember, listMembers, getMember, updateMember,
  approveMember, updateStatus, searchMembers, downloadCard,
  addDependent, getDependents, removeDependent,
  addBeneficiary, getBeneficiaries, removeBeneficiary,
  getMemberClaims, uploadDocuments, getDocuments,
  verifyMember, emailCard,
};
