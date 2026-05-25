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

// Additional child premium per child beyond the included 4
const EXTRA_CHILD_PREMIUM = [0, 300, 500, 500, 500, 500, 500]; // indexed by option 1-6

// Premium per parent/parent-in-law above 80 years
const PARENT_ABOVE_80_PREMIUM = [0, 1000, 2000, 4000, 4000, 4000, 4000]; // indexed by option 1-6

function extraChildRate(option) { return EXTRA_CHILD_PREMIUM[option] || 0; }
function parent80Rate(option) { return PARENT_ABOVE_80_PREMIUM[option] || 0; }

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
    const {
      client_name, cover_option, plan_amount, membership_fee,
      notes, member_id, due_date, extra_children, parents_above_80,
    } = req.body;

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

    const extraChildCount = Math.max(0, parseInt(extra_children) || 0);
    const parent80Count = Math.max(0, parseInt(parents_above_80) || 0);
    const extraChildPremium = extraChildRate(optNum) * extraChildCount;
    const parent80Premium = parent80Rate(optNum) * parent80Count;

    const total = planAmt + memberFee + extraChildPremium + parent80Premium;

    const dbClient = await pool.connect();
    try {
      const invoiceNumber = await generateInvoiceNumber(dbClient);

      const result = await dbClient.query(
        `INSERT INTO invoices
          (invoice_number, created_by, member_id, client_name, cover_option, plan_amount, membership_fee,
           extra_children, parents_above_80, extra_children_premium, parents_above_80_premium,
           total_amount, notes, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          invoiceNumber, req.user.id, member_id || null,
          client_name.trim(), optNum, planAmt, memberFee,
          extraChildCount, parent80Count, extraChildPremium, parent80Premium,
          total, notes || null, due_date || null,
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

    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${inv.invoice_number}.pdf"`);
    doc.pipe(res);

    const PW = 595.28;
    const PH = 841.89;
    const M = 40;
    const CW = PW - M * 2;
    const FOOTER_H = 48;
    const PAGE_BOTTOM = PH - FOOTER_H - 8;

    // ── Draw footer band on the current page (no page number — added later) ──
    function drawFooter() {
      const fy = PH - FOOTER_H;
      doc.rect(0, fy, PW, FOOTER_H).fill(NAVY);
      doc.fontSize(7.5).font('Helvetica').fillColor('#AAAAAA')
        .text(
          'My Life Companion Welfare  ·  info@mylife-companion.com  ·  +254-118-043-715  ·  Underwritten by Old Mutual',
          0, fy + 14, { width: PW, align: 'center' }
        );
    }

    // ── Add a new continuation page and return y after compact header ────────
    function addContinuationPage() {
      drawFooter();
      doc.addPage({ margin: 0, size: 'A4' });
      doc.rect(0, 0, PW, 52).fill(NAVY);
      doc.rect(0, 0, PW, 52).stroke(NAVY);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(GOLD)
        .text('My Life Companion Welfare', M, 12, { width: CW - 130 });
      doc.fontSize(8).font('Helvetica').fillColor('#CCCCCC')
        .text(`Invoice ${inv.invoice_number} — continued`, M, 29);
      doc.rect(PW - M - 100, 10, 100, 32).fill(GOLD);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
        .text('INVOICE', PW - M - 100, 17, { width: 100, align: 'center' });
      return 62;
    }

    // ── Draw group table header row, return y after it ──────────────────────
    function drawGroupTableHeader(y, colMember, colPlan, colCover, colAmt) {
      doc.rect(M, y, CW, 26).fill(NAVY);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('#', M + 4, y + 8, { width: 20, align: 'right' })
        .text('MEMBER NAME', colMember, y + 8, { width: colPlan - colMember - 4 })
        .text('PLAN', colPlan, y + 8, { width: colCover - colPlan - 4 })
        .text('COVER', colCover, y + 8, { width: colAmt - colCover - 4 })
        .text('AMOUNT (KES)', colAmt, y + 8, { width: 110, align: 'right' });
      return y + 26;
    }

    // ── Draw payment instructions block, return y after it ───────────────────
    function drawPaymentBlock(y) {
      doc.rect(M, y, CW, 92).fill(LIGHT_GRAY);
      doc.rect(M, y, 4, 92).fill(GOLD);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(NAVY)
        .text('PAYMENT INSTRUCTIONS', M + 16, y + 12);
      doc.fontSize(9).font('Helvetica').fillColor('#444444')
        .text('Pay via M-Pesa Paybill:', M + 16, y + 28)
        .text('Paybill Number:', M + 16, y + 43)
        .text('Account Number:', M + 16, y + 57)
        .text('Amount:', M + 16, y + 71);
      doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
        .text('625625', M + 148, y + 43)
        .text('20190955', M + 148, y + 57)
        .text(fmtKES(inv.total_amount), M + 148, y + 71);
      return y + 92;
    }

    // =========================================================================
    // ── PAGE 1: Full header band ─────────────────────────────────────────────
    // =========================================================================
    doc.rect(0, 0, PW, 120).fill(NAVY);
    doc.fontSize(22).font('Helvetica-Bold').fillColor(GOLD)
      .text('My Life Companion Welfare', M, 28, { width: CW - 140 });
    doc.fontSize(8.5).font('Helvetica').fillColor('#CCCCCC')
      .text('Development House, Floor 13, Suite 18, Nairobi', M, 57)
      .text('+254-118-043-715  |  info@mylife-companion.com', M, 69)
      .text('Underwritten by Old Mutual', M, 81);
    doc.rect(PW - M - 130, 22, 130, 80).fill(GOLD);
    doc.fontSize(20).font('Helvetica-Bold').fillColor(NAVY)
      .text('INVOICE', PW - M - 130, 32, { width: 130, align: 'center' });

    // ── Meta strip ──────────────────────────────────────────────────────────
    let y = 140;
    doc.rect(M, y, CW, 56).fill(LIGHT_GRAY);

    const c1 = M + 12;
    const c2 = M + Math.floor(CW * 0.28);
    const c3 = M + Math.floor(CW * 0.54);
    const c4 = M + Math.floor(CW * 0.78);

    doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#777777')
      .text('INVOICE NUMBER', c1, y + 8)
      .text('DATE ISSUED', c2, y + 8)
      .text('PAY BY DATE', c3, y + 8)
      .text('STATUS', c4, y + 8);

    doc.fontSize(10.5).font('Helvetica-Bold').fillColor(NAVY)
      .text(inv.invoice_number, c1, y + 23);

    const issueDate = new Date(inv.created_at).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.fontSize(10).font('Helvetica').fillColor('#222222')
      .text(issueDate, c2, y + 23);

    const dueDateStr = inv.due_date
      ? new Date(inv.due_date).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';
    doc.fontSize(10).font('Helvetica').fillColor(inv.due_date ? '#D32F2F' : '#AAAAAA')
      .text(dueDateStr, c3, y + 23);

    const statusLabel = inv.status === 'paid' ? 'PAID' : 'PENDING PAYMENT';
    const statusColor = inv.status === 'paid' ? GREEN : '#E67E22';
    doc.fontSize(9).font('Helvetica-Bold').fillColor(statusColor)
      .text(statusLabel, c4, y + 23);

    // ── Billed To / Issued By ────────────────────────────────────────────────
    y = 222;
    const colW = CW / 2 - 10;
    const rightX = M + colW + 20;

    doc.fontSize(8).font('Helvetica-Bold').fillColor(GOLD).text('BILLED TO', M, y);
    doc.moveTo(M, y + 13).lineTo(M + colW, y + 13).stroke(GOLD);
    doc.fontSize(13).font('Helvetica-Bold').fillColor(NAVY)
      .text(inv.client_name, M, y + 18, { width: colW });

    const groupMembers = Array.isArray(inv.group_members) ? inv.group_members : null;
    if (groupMembers) {
      doc.fontSize(9).font('Helvetica').fillColor('#555555')
        .text(`Group Invoice — ${groupMembers.length} Member${groupMembers.length > 1 ? 's' : ''}`, M, y + 36, { width: colW });
    }

    doc.fontSize(8).font('Helvetica-Bold').fillColor(GOLD).text('ISSUED BY', rightX, y);
    doc.moveTo(rightX, y + 13).lineTo(rightX + colW, y + 13).stroke(GOLD);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(NAVY)
      .text('My Life Companion Welfare', rightX, y + 18, { width: colW });
    doc.fontSize(8.5).font('Helvetica').fillColor('#555555')
      .text('Development House, Floor 13, Suite 18', rightX, y + 36, { width: colW })
      .text('+254-118-043-715  |  info@mylife-companion.com', rightX, y + 48, { width: colW })
      .text('Underwritten by Old Mutual', rightX, y + 60, { width: colW });

    y = 330;

    // =========================================================================
    if (groupMembers) {
      // ── GROUP invoice: paginated per-member table ─────────────────────────
      const ROW_H = 24;
      const NUM_COL_W = 26;
      const colMember = M + NUM_COL_W + 4;
      const colPlan   = M + Math.floor(CW * 0.50);
      const colCover  = M + Math.floor(CW * 0.68);
      const colAmt    = M + Math.floor(CW * 0.84);

      // Space needed after the last data row before we can close the invoice:
      // footnote (20) + total bar (36) + gap (20) + payment block (92) + gap (14)
      const POST_TABLE_SPACE = 20 + 36 + 20 + 92 + 14;

      y = drawGroupTableHeader(y, colMember, colPlan, colCover, colAmt);

      let globalRowIndex = 0;
      for (let i = 0; i < groupMembers.length; i++) {
        const m = groupMembers[i];

        // Need space for this row PLUS at minimum one more row OR post-table
        const isLast = i === groupMembers.length - 1;
        const spaceNeeded = isLast ? ROW_H + POST_TABLE_SPACE : ROW_H * 2;

        if (y + spaceNeeded > PAGE_BOTTOM) {
          y = addContinuationPage();
          y = drawGroupTableHeader(y, colMember, colPlan, colCover, colAmt);
          globalRowIndex = 0; // reset alternating shade per page
        }

        const shade = globalRowIndex % 2 === 1;
        if (shade) {
          doc.rect(M, y, CW, ROW_H).fill('#F4F6FA').stroke('#E8EBF0');
        } else {
          doc.rect(M, y, CW, ROW_H).fillColor('#FFFFFF').fill();
          doc.rect(M, y, CW, ROW_H).stroke('#E8EBF0');
        }

        // Row number
        doc.fontSize(7.5).font('Helvetica').fillColor('#AAAAAA')
          .text(String(i + 1), M + 4, y + 8, { width: NUM_COL_W - 4, align: 'right' });

        // Member name
        doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
          .text(m.client_name, colMember, y + 8, { width: colPlan - colMember - 4, ellipsis: true });

        // Plan label
        let planLabel = `Opt ${m.cover_option}`;
        const extras = [];
        if (m.extra_children > 0) extras.push(`+${m.extra_children}ch`);
        if (m.parents_above_80 > 0) extras.push(`+${m.parents_above_80}p80`);
        if (extras.length) planLabel += ` (${extras.join(', ')})`;
        doc.fontSize(8.5).font('Helvetica').fillColor('#555555')
          .text(planLabel, colPlan, y + 8, { width: colCover - colPlan - 4 });

        // Cover amount
        doc.fontSize(8.5).font('Helvetica').fillColor('#555555')
          .text(m.cover, colCover, y + 8, { width: colAmt - colCover - 4 });

        // Row total — right-aligned in last column
        doc.fontSize(9).font('Helvetica-Bold').fillColor(NAVY)
          .text(fmtKES(m.total), colAmt, y + 8, { width: CW - (colAmt - M) - 4, align: 'right' });

        // Thin bottom separator
        doc.moveTo(M, y + ROW_H).lineTo(M + CW, y + ROW_H).stroke('#DDDDDD');

        y += ROW_H;
        globalRowIndex++;
      }

      // ── Footnote ──────────────────────────────────────────────────────────
      if (y + POST_TABLE_SPACE > PAGE_BOTTOM) {
        y = addContinuationPage();
      }

      doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA')
        .text(
          '* Each amount includes the annual premium + KES 200 joining fee. Extra-child and parent-above-80 premiums are additional.',
          M + 4, y + 5, { width: CW - 8 }
        );
      y += 20;

      // ── Grand total bar ───────────────────────────────────────────────────
      doc.rect(M, y, CW, 36).fill(NAVY);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(GOLD)
        .text(`TOTAL  —  ${groupMembers.length} Member${groupMembers.length > 1 ? 's' : ''}`, M + 12, y + 12);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(GOLD)
        .text(fmtKES(inv.total_amount), M + 12, y + 12, { width: CW - 24, align: 'right' });
      y += 36;

    } else {
      // ── SINGLE invoice: line items ────────────────────────────────────────
      const plan = COVER_PLANS.find((p) => p.option === inv.cover_option);

      doc.rect(M, y, CW, 26).fill(NAVY);
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('DESCRIPTION', M + 12, y + 8)
        .text('COVER', M + CW - 270, y + 8)
        .text('AMOUNT (KES)', M + CW - 130, y + 8);
      y += 26;

      let rowShade = false;
      function tableRow(label, sub, cover, amount) {
        if (y + 34 > PAGE_BOTTOM) {
          y = addContinuationPage();
          // Redraw single-invoice table header on new page
          doc.rect(M, y, CW, 26).fill(NAVY);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#FFFFFF')
            .text('DESCRIPTION', M + 12, y + 8)
            .text('COVER', M + CW - 270, y + 8)
            .text('AMOUNT (KES)', M + CW - 130, y + 8);
          y += 26;
          rowShade = false;
        }
        if (rowShade) doc.rect(M, y, CW, 34).fill('#F4F6FA').stroke('#E8EBF0');
        else doc.rect(M, y, CW, 34).stroke('#E8EBF0');
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
        rowShade = !rowShade;
      }

      const planLabel = plan ? `Annual Premium — Cover Option ${plan.option}` : 'Annual Premium';
      tableRow(planLabel, 'Extended family cover (annual)', plan ? plan.cover : '', fmtKES(inv.plan_amount));
      tableRow('Membership / Joining Fee', 'One-time registration fee', '', fmtKES(inv.membership_fee));

      const extraChildren = parseInt(inv.extra_children) || 0;
      const parents80 = parseInt(inv.parents_above_80) || 0;

      if (extraChildren > 0) {
        const rate = extraChildRate(inv.cover_option);
        tableRow(
          `Additional Children (${extraChildren})`,
          `${extraChildren} child${extraChildren > 1 ? 'ren' : ''} beyond the included 4 — KES ${rate.toLocaleString('en-KE')} per child`,
          '',
          fmtKES(inv.extra_children_premium)
        );
      }

      if (parents80 > 0) {
        const rate = parent80Rate(inv.cover_option);
        tableRow(
          `Parents / Parents-in-law above 80 (${parents80})`,
          `${parents80} person${parents80 > 1 ? 's' : ''} above 80 years — KES ${rate.toLocaleString('en-KE')} per person`,
          '',
          fmtKES(inv.parents_above_80_premium)
        );
      }

      if (inv.notes) tableRow('Notes', inv.notes, '', '');

      // Total bar
      if (y + 36 > PAGE_BOTTOM) {
        y = addContinuationPage();
      }
      doc.rect(M, y, CW, 36).fill(NAVY);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(GOLD)
        .text('TOTAL', M + 12, y + 11)
        .text(fmtKES(inv.total_amount), M + CW - 130, y + 11, { width: 120, align: 'right' });
      y += 36;
    }

    // ── Payment instructions (shared) ────────────────────────────────────────
    y += 20;
    if (y + 92 > PAGE_BOTTOM) {
      y = addContinuationPage();
      y += 10;
    }
    drawPaymentBlock(y);

    // ── Footer on final page ─────────────────────────────────────────────────
    drawFooter();

    // ── Stamp "Page N of M" on every page using buffered pages ───────────────
    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    if (totalPages > 1) {
      for (let p = 0; p < totalPages; p++) {
        doc.switchToPage(range.start + p);
        const fy = PH - FOOTER_H;
        doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA')
          .text(`${p + 1} / ${totalPages}`, PW - M - 10, fy + 30, { width: 50, align: 'right' });
      }
    }

    doc.flushPages();
    doc.end();
  } catch (err) {
    next(err);
  }
}

async function createGroupInvoice(req, res, next) {
  try {
    const { group_name, members, notes, due_date } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ success: false, error: 'members array is required and must not be empty' });
    }
    if (members.length > 200) {
      return res.status(400).json({ success: false, error: 'Maximum 200 members per group invoice' });
    }

    const resolvedMembers = [];
    for (let i = 0; i < members.length; i++) {
      const { client_name, cover_option, extra_children, parents_above_80 } = members[i];
      if (!client_name || !cover_option) {
        return res.status(400).json({ success: false, error: `Member ${i + 1}: client_name and cover_option are required` });
      }
      const optNum = parseInt(cover_option);
      const plan = COVER_PLANS.find((p) => p.option === optNum);
      if (!plan) {
        return res.status(400).json({ success: false, error: `Member ${i + 1}: invalid cover_option ${cover_option} (must be 1–6)` });
      }

      const extraChildCount = Math.max(0, parseInt(extra_children) || 0);
      const parent80Count = Math.max(0, parseInt(parents_above_80) || 0);
      const extraChildPremium = extraChildRate(optNum) * extraChildCount;
      const parent80Premium = parent80Rate(optNum) * parent80Count;

      resolvedMembers.push({
        client_name: client_name.trim(),
        cover_option: optNum,
        plan_name: plan.name,
        plan_amount: plan.premium,
        membership_fee: 200,
        cover: plan.cover,
        extra_children: extraChildCount,
        parents_above_80: parent80Count,
        extra_children_premium: extraChildPremium,
        parents_above_80_premium: parent80Premium,
        total: plan.premium + 200 + extraChildPremium + parent80Premium,
      });
    }

    const totalPremiums = resolvedMembers.reduce((s, m) => s + m.plan_amount + m.extra_children_premium + m.parents_above_80_premium, 0);
    const totalFees = resolvedMembers.reduce((s, m) => s + m.membership_fee, 0);
    const grandTotal = totalPremiums + totalFees;

    let invoiceName = group_name?.trim();
    if (!invoiceName) {
      if (resolvedMembers.length === 1) {
        invoiceName = resolvedMembers[0].client_name;
      } else if (resolvedMembers.length === 2) {
        invoiceName = `${resolvedMembers[0].client_name} & ${resolvedMembers[1].client_name}`;
      } else {
        invoiceName = `${resolvedMembers[0].client_name} & ${resolvedMembers.length - 1} others`;
      }
    }

    const dbClient = await pool.connect();
    try {
      const invoiceNumber = await generateInvoiceNumber(dbClient);
      const result = await dbClient.query(
        `INSERT INTO invoices
          (invoice_number, created_by, client_name, plan_amount, membership_fee, total_amount, notes, group_members, due_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [invoiceNumber, req.user.id, invoiceName, totalPremiums, totalFees, grandTotal, notes || null, JSON.stringify(resolvedMembers), due_date || null]
      );
      return res.status(201).json({ success: true, data: result.rows[0] });
    } finally {
      dbClient.release();
    }
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

async function bulkCreateInvoices(req, res, next) {
  try {
    const { invoices } = req.body;

    if (!Array.isArray(invoices) || invoices.length === 0) {
      return res.status(400).json({ success: false, error: 'invoices array is required and must not be empty' });
    }
    if (invoices.length > 200) {
      return res.status(400).json({ success: false, error: 'Maximum 200 invoices per bulk request' });
    }

    const created = [];
    const failed = [];

    const dbClient = await pool.connect();
    try {
      for (let i = 0; i < invoices.length; i++) {
        const { client_name, cover_option, membership_fee, notes, member_id, extra_children, parents_above_80 } = invoices[i];

        if (!client_name || !cover_option) {
          failed.push({ index: i, client_name: client_name || '(blank)', reason: 'client_name and cover_option are required' });
          continue;
        }

        const optNum = parseInt(cover_option);
        const plan = COVER_PLANS.find((p) => p.option === optNum);
        if (!plan) {
          failed.push({ index: i, client_name, reason: `Invalid cover_option ${cover_option} (must be 1–6)` });
          continue;
        }

        try {
          const planAmt = plan.premium;
          const memberFee = membership_fee !== undefined ? parseFloat(membership_fee) : 200;
          const extraChildCount = Math.max(0, parseInt(extra_children) || 0);
          const parent80Count = Math.max(0, parseInt(parents_above_80) || 0);
          const extraChildPremium = extraChildRate(optNum) * extraChildCount;
          const parent80Premium = parent80Rate(optNum) * parent80Count;
          const total = planAmt + memberFee + extraChildPremium + parent80Premium;
          const invoiceNumber = await generateInvoiceNumber(dbClient);

          const result = await dbClient.query(
            `INSERT INTO invoices
              (invoice_number, created_by, member_id, client_name, cover_option, plan_amount, membership_fee,
               extra_children, parents_above_80, extra_children_premium, parents_above_80_premium, total_amount, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [invoiceNumber, req.user.id, member_id || null, client_name.trim(), optNum, planAmt, memberFee,
             extraChildCount, parent80Count, extraChildPremium, parent80Premium, total, notes || null]
          );

          created.push(result.rows[0]);
        } catch (err) {
          failed.push({ index: i, client_name, reason: err.message });
        }
      }
    } finally {
      dbClient.release();
    }

    return res.status(201).json({
      success: true,
      data: { created, failed, summary: { total: invoices.length, created_count: created.length, failed_count: failed.length } },
      message: `${created.length} of ${invoices.length} invoices created`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createInvoice, createGroupInvoice, bulkCreateInvoices, listInvoices, getInvoice, generatePdf, updateStatus };
