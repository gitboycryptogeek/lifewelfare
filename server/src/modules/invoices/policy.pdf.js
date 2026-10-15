// Francis Funeral Home policy document (2 pages), modelled on the
// "Application for Funeral Expense Insurance" form.
const { getCompany } = require('./companies');

const PW = 595.28;
const PH = 841.89;
const M = 36;
const CW = PW - M * 2;

const SECTION = '#C55A11';
const TABLE_HEAD = '#FFC000';
const CATEGORY_BG = '#F7E9F7';
const SELECTED_HEAD = '#E8501E';
const SELECTED_BG = '#FFF1E8';
const INK = '#1F1F1F';
const GRID = '#333333';

const MAX_DEPENDANT_ROWS = 13;
const MIN_DEPENDANT_ROWS = 9;

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
}

function sectionHeading(doc, text, y) {
  doc.fontSize(11.5).font('Helvetica-Bold').fillColor(SECTION).text(text, M, y);
  return y + 18;
}

function drawFooter(doc, brand, pageNo) {
  const fy = PH - 26;
  doc.moveTo(M, fy - 6).lineTo(PW - M, fy - 6).lineWidth(0.5).stroke('#CCCCCC');
  doc.fontSize(7).font('Helvetica').fillColor('#888888')
    .text(brand.footer, M, fy, { width: CW - 60 })
    .text(`Page ${pageNo} of 2`, PW - M - 60, fy, { width: 60, align: 'right' });
}

// A labelled field on an underline, e.g. "POLICY NUMBER: ______"
function field(doc, label, value, x, y, w) {
  doc.fontSize(8.5).font('Helvetica').fillColor('#444444');
  const lw = doc.widthOfString(label) + 6;
  doc.text(label, x, y + 3, { lineBreak: false });
  doc.moveTo(x + lw, y + 14).lineTo(x + w, y + 14).lineWidth(0.6).stroke('#555555');
  doc.fontSize(10).font('Helvetica-Bold').fillColor(INK)
    .text(value || '', x + lw + 4, y + 1, { width: w - lw - 6, height: 13, ellipsis: true, lineBreak: false });
}

function drawBenefitsChart(doc, brand, selectedOption, y) {
  const plans = brand.plans;
  const catW = 112;
  const optW = (CW - catW) / plans.length;
  const pad = 4;
  const fs = 7.3;

  const rows = [
    { label: 'Hearse', get: (p) => p.hearse },
    { label: 'Casket', get: (p) => p.casket },
    { label: 'Additional features', get: (p) => p.features.split(', ').join('\n') },
    { label: 'Cash (Token at Morgue)', get: (p) => p.cover.replace('KES', 'Ksh') },
    { label: 'Annual Premium', get: (p) => `Ksh ${p.premium.toLocaleString('en-KE')}` },
    { label: "Additional Child's premium", get: (p) => `Ksh ${brand.extraChildRates[p.option].toLocaleString('en-KE')}` },
    { label: 'Premium for Parents & Parents in-laws above 80 years', get: (p) => `Ksh ${brand.parent80Rates[p.option].toLocaleString('en-KE')}` },
  ];

  doc.fontSize(fs).font('Helvetica-Bold');
  const heights = rows.map((r) => {
    const cells = plans.map((p) => doc.heightOfString(r.get(p), { width: optW - pad * 2, align: 'center' }));
    const lab = doc.heightOfString(r.label, { width: catW - pad * 2, align: 'center' });
    return Math.max(16, ...cells.map((h) => h + pad * 2), lab + pad * 2);
  });

  // Header row
  const HH = 18;
  doc.rect(M, y, catW, HH).fill(TABLE_HEAD);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(INK)
    .text('Category', M, y + 5, { width: catW, align: 'center' });
  plans.forEach((p, i) => {
    const x = M + catW + i * optW;
    const sel = p.option === selectedOption;
    doc.rect(x, y, optW, HH).fill(sel ? SELECTED_HEAD : TABLE_HEAD);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(sel ? '#FFFFFF' : INK)
      .text(sel ? `Option ${p.option} (Taken)` : `Option ${p.option}`, x, y + 5, { width: optW, align: 'center' });
  });
  const top = y;
  y += HH;

  rows.forEach((r, ri) => {
    const h = heights[ri];
    doc.rect(M, y, catW, h).fill(CATEGORY_BG);
    plans.forEach((p, i) => {
      if (p.option === selectedOption) doc.rect(M + catW + i * optW, y, optW, h).fill(SELECTED_BG);
    });
    doc.fontSize(fs).font('Helvetica-Bold').fillColor(INK);
    const lh = doc.heightOfString(r.label, { width: catW - pad * 2, align: 'center' });
    doc.text(r.label, M + pad, y + (h - lh) / 2, { width: catW - pad * 2, align: 'center' });
    plans.forEach((p, i) => {
      const x = M + catW + i * optW;
      const v = r.get(p);
      const vh = doc.heightOfString(v, { width: optW - pad * 2, align: 'center' });
      doc.text(v, x + pad, y + (h - vh) / 2, { width: optW - pad * 2, align: 'center' });
    });
    y += h;
  });

  // Grid lines
  doc.lineWidth(0.6).strokeColor(GRID);
  doc.rect(M, top, CW, y - top).stroke();
  let gy = top + HH;
  doc.moveTo(M, gy).lineTo(M + CW, gy).stroke();
  heights.forEach((h) => { gy += h; doc.moveTo(M, gy).lineTo(M + CW, gy).stroke(); });
  for (let i = 0; i <= plans.length; i++) {
    const x = M + catW + i * optW;
    doc.moveTo(x, top).lineTo(x, y).stroke();
  }
  // Re-stroke the selected column border so it stands out
  const si = plans.findIndex((p) => p.option === selectedOption);
  if (si >= 0) doc.lineWidth(1.4).rect(M + catW + si * optW, top, optW, y - top).stroke(SELECTED_HEAD).lineWidth(0.6);

  return y;
}

function drawDependantsTable(doc, dependants, y) {
  const cols = [
    { key: 'no', label: 'No.', w: 34 },
    { key: 'name', label: 'Dependant details', w: 0 },
    { key: 'relationship', label: 'Relationship', w: 160 },
  ];
  cols[1].w = CW - cols.reduce((s, c) => s + c.w, 0);

  const HH = 22;
  const available = PH - 40 - y - HH;
  const rowH = 20;
  const rowCount = Math.min(
    MAX_DEPENDANT_ROWS,
    Math.max(MIN_DEPENDANT_ROWS, dependants.length, 0),
    Math.floor(available / rowH),
  );

  doc.rect(M, y, CW, HH).fill(TABLE_HEAD);
  let x = M;
  cols.forEach((c) => {
    doc.fontSize(8).font('Helvetica-Bold').fillColor(INK)
      .text(c.label, x + 5, c.label.includes('\n') ? y + 2.5 : y + 7, { width: c.w - 10, align: c.key === 'no' ? 'center' : 'left', lineGap: -1 });
    x += c.w;
  });
  const top = y;
  y += HH;

  for (let i = 0; i < rowCount; i++) {
    const d = dependants[i] || {};
    const values = {
      no: String(i + 1),
      name: d.name || '',
      relationship: d.relationship || '',
    };
    x = M;
    cols.forEach((c) => {
      doc.fontSize(8.5).font(c.key === 'name' ? 'Helvetica-Bold' : 'Helvetica').fillColor(c.key === 'no' ? '#666666' : INK)
        .text(values[c.key], x + 5, y + 6, { width: c.w - 10, height: 11, ellipsis: true, lineBreak: false, align: c.key === 'no' ? 'center' : 'left' });
      x += c.w;
    });
    y += rowH;
  }

  doc.lineWidth(0.6).strokeColor(GRID);
  doc.rect(M, top, CW, y - top).stroke();
  for (let ry = top + HH; ry < y; ry += rowH) doc.moveTo(M, ry).lineTo(M + CW, ry).stroke();
  x = M;
  cols.slice(0, -1).forEach((c) => { x += c.w; doc.moveTo(x, top).lineTo(x, y).stroke(); });

  return y;
}

// Writes text where **segments** are bold
function richText(doc, text, x, y, width) {
  const parts = text.split('**');
  doc.fontSize(9).fillColor(INK);
  parts.forEach((part, i) => {
    doc.font(i % 2 === 1 ? 'Helvetica-Bold' : 'Helvetica');
    const opts = { width, continued: i < parts.length - 1, lineGap: 1.5 };
    if (i === 0) doc.text(part, x, y, opts);
    else doc.text(part, opts);
  });
  return doc.y;
}

/**
 * Draw a 2-page policy document starting on the doc's current page.
 * policy: { holderName, plan, policyNumber, issueDate, dependants }
 */
function drawPolicyDocument(doc, brand, policy) {
  const { holderName, plan, policyNumber, issueDate, dependants = [] } = policy;

  // ── PAGE 1 ─────────────────────────────────────────────────────────────
  doc.rect(0, 0, PW, PH).fill('#FFFFFF');
  doc.image(brand.logo, M, 22, { fit: [150, 92] });
  if (brand.mlcLogo) {
    doc.image(brand.mlcLogo, PW - M - 175, 26, { fit: [175, 66], align: 'right' });
    const dashY = 98;
    doc.lineWidth(1).dash(3, { space: 2 }).moveTo(PW - M - 200, dashY).lineTo(PW - M, dashY).stroke('#F5A623').undash();
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1A2B4A')
      .text('UNDERWRITTEN BY OLD MUTUAL', PW - M - 200, dashY + 5, { width: 200, align: 'right' });
  }

  let y = 128;
  doc.fontSize(15).font('Helvetica-Bold').fillColor(INK)
    .text('FUNERAL EXPENSE INSURANCE — POLICY DOCUMENT', M, y);
  y += 26;

  const optionText = plan
    ? `${plan.name} — Annual Premium Ksh ${plan.premium.toLocaleString('en-KE')}`
    : '';
  field(doc, "PRINCIPAL MEMBER'S NAME:", holderName, M, y, CW);
  y += 24;
  field(doc, 'OPTION TAKEN:', optionText, M, y, CW);
  y += 24;
  field(doc, 'POLICY NUMBER:', policyNumber, M, y, CW * 0.58);
  field(doc, 'DATE OF ISSUE:', issueDate ? fmtDate(issueDate) : '', M + CW * 0.62, y, CW * 0.38);
  y += 30;

  y = sectionHeading(doc, 'BENEFITS / PREMIUM DETAILS', y);
  y = drawBenefitsChart(doc, brand, plan ? plan.option : null, y);

  y += 8;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(INK).text('Mandatory documents: ', M, y, { continued: true })
    .font('Helvetica').text(brand.mandatoryDocs);
  doc.fontSize(8).font('Helvetica').fillColor(INK).text(brand.registrationNote, M, doc.y + 2);
  y = doc.y + 14;

  y = sectionHeading(doc, 'DEPENDANTS DETAILS', y);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#444444')
    .text('(Details of the dependants covered under this Last Expense Cover)', M, y - 3);
  y += 10;
  drawDependantsTable(doc, dependants, y);

  drawFooter(doc, brand, 1);

  // ── PAGE 2 ─────────────────────────────────────────────────────────────
  doc.addPage({ margin: 0, size: 'A4' });
  y = 44;
  doc.fontSize(11.5).font('Helvetica-Bold').fillColor(INK).text('TERMS AND CONDITIONS.', M, y);
  y += 20;

  const numW = 20;
  brand.policyTerms.forEach((term, i) => {
    doc.fontSize(9).font('Helvetica').fillColor(INK).text(`${i + 1}.`, M, y, { width: numW });
    y = richText(doc, term, M + numW, y, CW - numW) + 4;
  });

  y += 28;
  doc.fontSize(11.5).font('Helvetica-Bold').fillColor(INK).text('CLAIM PROCEDURE', M, y);
  y += 22;
  brand.claimProcedure.forEach(([letter, text]) => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(INK).text(`${letter}.`, M, y, { width: 24 });
    doc.font('Helvetica').text(text, M + 24, y, { width: CW - 24, lineGap: 1.5 });
    y = doc.y + 9;
  });

  if (policyNumber) {
    doc.fontSize(8).font('Helvetica').fillColor('#888888')
      .text(`Policy No. ${policyNumber}  ·  ${holderName || ''}`, M, PH - 52, { width: CW, align: 'right' });
  }
  drawFooter(doc, brand, 2);
}

function hasPolicy(inv) {
  return inv.company === 'francis' && (!!inv.cover_option || Array.isArray(inv.group_members));
}

// Draw one policy document per covered person on the invoice
function drawPoliciesForInvoice(doc, inv, { newPage }) {
  const brand = getCompany(inv.company);
  const people = Array.isArray(inv.group_members)
    ? inv.group_members.map((m) => ({
      holderName: m.client_name, option: m.cover_option, policyNumber: m.policy_number, dependants: [],
    }))
    : [{
      holderName: inv.client_name, option: inv.cover_option, policyNumber: inv.policy_number,
      dependants: Array.isArray(inv.dependants) ? inv.dependants : [],
    }];

  people.forEach((p, i) => {
    if (newPage || i > 0) doc.addPage({ margin: 0, size: 'A4' });
    drawPolicyDocument(doc, brand, {
      holderName: p.holderName,
      plan: brand.plans.find((pl) => pl.option === parseInt(p.option)),
      policyNumber: p.policyNumber,
      issueDate: inv.created_at,
      dependants: p.dependants,
    });
  });
}

module.exports = { drawPolicyDocument, drawPoliciesForInvoice, hasPolicy };
