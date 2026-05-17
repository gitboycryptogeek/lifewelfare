const { pool } = require('../../config/db');
const PDFDocument = require('pdfkit');

const COVER_PLANS = [
  { option: 1, name: 'Option 1', premium: 1500, cover: 'KES 50,000' },
  { option: 2, name: 'Option 2', premium: 3000, cover: 'KES 100,000' },
  { option: 3, name: 'Option 3', premium: 6000, cover: 'KES 200,000' },
  { option: 4, name: 'Option 4', premium: 9000, cover: 'KES 300,000' },
  { option: 5, name: 'Option 5', premium: 12000, cover: 'KES 400,000' },
  { option: 6, name: 'Option 6', premium: 15000, cover: 'KES 500,000' },
];

const NAVY = '#1A2B4A';
const GOLD = '#F5A623';
const GREEN = '#27AE60';
const LIGHT_GRAY = '#F5F5F5';

function fmtKES(amount) {
  return `KES ${Number(amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
}

async function generateInvoiceNumber(client) {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-${datePart}-`;
  const result = await client.query(
    `SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE $1`,
    [`${prefix}%`]
  );
  const seq = String(parseInt(result.rows[0].count) + 1).padStart(4, '0');
  return `${prefix}${seq}`;
}

async function createInvoice(req, res, next) {
  try {
    const { client_name, cover_option, plan_amount, membership_fee, notes, member_id } = req.body;

    if (!client_name || !cover_option) {
      return res.status(400).json({ success: false, error: 'client_name and cover_option are required' });
    }

    const optNum = parseInt(cover_option);
    const plan = COVER_PLANS.find((p) => p.option === optNum);
    if (!plan) {
      return res.status(400).json({ success: false, error: 'Invalid cover_option (must be 1–6)' });
    }

    const planAmt = plan_amount !== undefined ? parseFloat(plan_amount) : plan.premium;
    const memberFee = membership_fee !== undefined ? parseFloat(membership_fee) : 200;
    const total = planAmt + memberFee;

    const dbClient = await pool.connect();
    try {
      const invoiceNumber = await generateInvoiceNumber(dbClient);

      const result = await dbClient.query(
        `INSERT INTO invoices
          (invoice_number, created_by, member_id, client_name, cover_option, plan_amount, membership_fee, total_amount, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          invoiceNumber,
          req.user.id,
          member_id || null,
          client_name.trim(),
          optNum,
          planAmt,
          memberFee,
          total,
          notes || null,
        ]
      );

      return res.status(201).json({ success: true, data: result.rows[0] });
    } finally {
      dbClient.release();
    }
  } catch (err) {
    next(err);
  }
}

async function listInvoices(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const role = req.user.role;
    const isAdmin = role === 'admin' || role === 'super_admin';

    const conditions = [];
    const params = [];
    let idx = 1;

    if (!isAdmin) {
      conditions.push(`i.created_by = $${idx++}`);
      params.push(req.user.id);
    }

    if (status) {
      conditions.push(`i.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM invoices i ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await pool.query(
      `SELECT
        i.*,
        u.full_name AS created_by_name,
        u.role AS created_by_role
       FROM invoices i
       JOIN users u ON u.id = i.created_by
       ${where}
       ORDER BY i.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const isAdmin = role === 'admin' || role === 'super_admin';

    const result = await pool.query(
      `SELECT i.*, u.full_name AS created_by_name, u.role AS created_by_role
       FROM invoices i
       JOIN users u ON u.id = i.created_by
       WHERE i.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = result.rows[0];

    if (!isAdmin && invoice.created_by !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    return res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

async function generatePdf(req, res, next) {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const isAdmin = role === 'admin' || role === 'super_admin';

    const result = await pool.query(
      `SELECT i.*, u.full_name AS created_by_name, u.role AS created_by_role
       FROM invoices i
       JOIN users u ON u.id = i.created_by
       WHERE i.id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const inv = result.rows[0];

    if (!isAdmin && inv.created_by !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const plan = COVER_PLANS.find((p) => p.option === inv.cover_option);

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${inv.invoice_number}.pdf"`);
    doc.pipe(res);

    const PW = 595.28;
    const PH = 841.89;
    const M = 40;
    const CW = PW - M * 2;

    // ── Header band ──────────────────────────────────────────────────────────
    doc.rect(0, 0, PW, 120).fill(NAVY);

    doc.fontSize(22).font('Helvetica-Bold').fillColor(GOLD)
      .text('My Life Companion Welfare', M, 28, { width: CW - 140 });

    doc.fontSize(8.5).font('Helvetica').fillColor('#CCCCCC')
      .text('Development House, Floor 13, Suite 18', M, 56)
      .text('+254-118-043-715  |  info@mylife-companion.com', M, 68)
      .text('Underwritten by Old Mutual', M, 80);

    // INVOICE badge top-right
    doc.rect(PW - M - 130, 22, 130, 80).fill(GOLD);
    doc.fontSize(20).font('Helvetica-Bold').fillColor(NAVY)
      .text('INVOICE', PW - M - 130, 32, { width: 130, align: 'center' });

    // ── Invoice meta strip ───────────────────────────────────────────────────
    let y = 140;
    doc.rect(M, y, CW, 56).fill(LIGHT_GRAY);

    doc.fontSize(8).font('Helvetica-Bold').fillColor('#666666')
      .text('INVOICE NUMBER', M + 12, y + 8)
      .text('DATE ISSUED', M + CW / 2 - 20, y + 8)
      .text('STATUS', M + CW - 100, y + 8);

    doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY)
      .text(inv.invoice_number, M + 12, y + 22);

    const issueDate = new Date(inv.created_at).toLocaleDateString('en-KE', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
    doc.fontSize(11).font('Helvetica').fillColor('#222222')
      .text(issueDate, M + CW / 2 - 20, y + 22);

    const statusColor = inv.status === 'paid' ? GREEN : '#E67E22';
    doc.fontSize(10).font('Helvetica-Bold').fillColor(statusColor)
      .text(inv.status.toUpperCase(), M + CW - 100, y + 22);

    // ── Two-column: Billed To / Issued By ───────────────────────────────────
    y = 220;
    const colW = CW / 2 - 10;

    doc.fontSize(8).font('Helvetica-Bold').fillColor(GOLD)
      .text('BILLED TO', M, y);
    doc.moveTo(M, y + 13).lineTo(M + colW, y + 13).stroke(GOLD);

    doc.fontSize(13).font('Helvetica-Bold').fillColor(NAVY)
      .text(inv.client_name, M, y + 18, { width: colW });

    const rightX = M + colW + 20;
    doc.fontSize(8).font('Helvetica-Bold').fillColor(GOLD)
      .text('ISSUED BY', rightX, y);
    doc.moveTo(rightX, y + 13).lineTo(rightX + colW, y + 13).stroke(GOLD);

    const issuerRole = (inv.created_by_role || '').replace('_', ' ');
    doc.fontSize(11).font('Helvetica-Bold').fillColor(NAVY)
      .text(inv.created_by_name, rightX, y + 18, { width: colW });
    doc.fontSize(9).font('Helvetica').fillColor('#555555')
      .text(issuerRole.charAt(0).toUpperCase() + issuerRole.slice(1), rightX, y + 36, { width: colW });

    // ── Line items table ─────────────────────────────────────────────────────
    y = 320;

    // Table header
    doc.rect(M, y, CW, 26).fill(NAVY);
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
      .text('DESCRIPTION', M + 12, y + 8)
      .text('COVER', M + CW - 270, y + 8)
      .text('AMOUNT (KES)', M + CW - 130, y + 8);

    y += 26;

    function tableRow(label, sub, cover, amount, shade) {
      if (shade) doc.rect(M, y, CW, 34).fill('#F9F9F9').stroke('#EEEEEE');
      else doc.rect(M, y, CW, 34).stroke('#EEEEEE');

      doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY)
        .text(label, M + 12, y + 6, { width: CW - 280 });
      if (sub) {
        doc.fontSize(8).font('Helvetica').fillColor('#777777')
          .text(sub, M + 12, y + 20, { width: CW - 280 });
      }
      doc.fontSize(10).font('Helvetica').fillColor('#444444')
        .text(cover || '', M + CW - 270, y + 11, { width: 130 });
      doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY)
        .text(amount, M + CW - 130, y + 11, { width: 120, align: 'right' });
      y += 34;
    }

    const planLabel = plan
      ? `Annual Premium — Cover Option ${plan.option}`
      : 'Annual Premium';
    const coverLabel = plan ? plan.cover : '';

    tableRow(planLabel, 'Extended family cover (annual)', coverLabel, fmtKES(inv.plan_amount), false);
    tableRow('Membership / Joining Fee', 'One-time registration fee', '', fmtKES(inv.membership_fee), true);

    if (inv.notes) {
      tableRow('Additional Notes', inv.notes, '', '', false);
    }

    // Total row
    doc.rect(M, y, CW, 36).fill(NAVY);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(GOLD)
      .text('TOTAL', M + 12, y + 11)
      .text(fmtKES(inv.total_amount), M + CW - 130, y + 11, { width: 120, align: 'right' });
    y += 36;

    // ── Payment instructions ─────────────────────────────────────────────────
    y += 24;
    doc.rect(M, y, CW, 90).fill(LIGHT_GRAY);
    doc.rect(M, y, 4, 90).fill(GOLD);

    doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY)
      .text('PAYMENT INSTRUCTIONS', M + 16, y + 12);

    doc.fontSize(9).font('Helvetica').fillColor('#444444')
      .text('Pay via M-Pesa Paybill:', M + 16, y + 28)
      .text('Paybill Number:', M + 16, y + 42)
      .text('Account Number:', M + 16, y + 56)
      .text('Amount:', M + 16, y + 70);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
      .text('625625', M + 140, y + 42)
      .text('20190955', M + 140, y + 56)
      .text(fmtKES(inv.total_amount), M + 140, y + 70);

    // ── Footer band ──────────────────────────────────────────────────────────
    doc.rect(0, PH - 50, PW, 50).fill(NAVY);
    doc.fontSize(8).font('Helvetica').fillColor('#AAAAAA')
      .text(
        'My Life Companion Welfare  ·  info@mylife-companion.com  ·  +254-118-043-715  ·  Underwritten by Old Mutual',
        0, PH - 28,
        { width: PW, align: 'center' }
      );

    doc.end();
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'paid'].includes(status)) {
      return res.status(400).json({ success: false, error: 'status must be draft or paid' });
    }

    const result = await pool.query(
      `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createInvoice, listInvoices, getInvoice, generatePdf, updateStatus };
