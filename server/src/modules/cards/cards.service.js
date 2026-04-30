const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { pool } = require('../../config/db');
const { sendEmail } = require('../../utils/email');
const { sendSMS } = require('../../utils/sms');

const CARDS_DIR = path.join(__dirname, '../../../../uploads/cards');

if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateName(str, max) {
  if (!str) return '';
  const upper = str.toUpperCase();
  return upper.length > max ? upper.substring(0, max - 1) + '…' : upper;
}

function buildCardSVG({ full_name, membership_number, cover_option }, qrDataUrl) {
  const W = 720, H = 405;
  const name = escapeXml(truncateName(full_name, 28));
  const number = escapeXml(membership_number);
  const cover = escapeXml(`Option ${cover_option || 1}`);
  const year = new Date().getFullYear();

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#1A2B4A"/>
      <stop offset="100%" stop-color="#243A63"/>
    </linearGradient>
    <linearGradient id="footer" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
      <stop offset="0%" stop-color="#D4891A"/>
      <stop offset="100%" stop-color="#F5A623"/>
    </linearGradient>
    <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  </defs>

  <!-- Card shape -->
  <rect width="${W}" height="${H}" rx="14" fill="url(#bg)"/>

  <!-- Subtle diagonal accent -->
  <polygon points="0,0 180,0 0,80" fill="#F5A623" opacity="0.06"/>

  <!-- Left gold bar -->
  <rect x="0" y="0" width="14" height="${H}" fill="#F5A623" rx="7"/>

  <!-- Footer gold bar -->
  <rect x="0" y="${H - 58}" width="${W}" height="58" fill="url(#footer)"/>
  <rect x="0" y="${H - 58}" width="${W}" height="10" fill="url(#footer)"/>

  <!-- Org name -->
  <text x="36" y="58"
        font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700"
        fill="#F5A623" letter-spacing="1">MY LIFE COMPANION</text>
  <text x="36" y="80"
        font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="400"
        fill="#FFFFFF" letter-spacing="3">WELFARE</text>

  <!-- Separator -->
  <line x1="36" y1="97" x2="500" y2="97" stroke="#F5A623" stroke-width="1" opacity="0.35"/>

  <!-- Member Name label + value -->
  <text x="36" y="123"
        font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="400"
        fill="#9AAABF" letter-spacing="2.5">MEMBER NAME</text>
  <text x="36" y="150"
        font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700"
        fill="#FFFFFF">${name}</text>

  <!-- Membership number label + value -->
  <text x="36" y="192"
        font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="400"
        fill="#9AAABF" letter-spacing="2.5">MEMBERSHIP NO.</text>
  <text x="36" y="228"
        font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700"
        fill="#F5A623" letter-spacing="1">${number}</text>

  <!-- Cover option -->
  <text x="36" y="268"
        font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="400"
        fill="#9AAABF" letter-spacing="2.5">COVER OPTION</text>
  <text x="36" y="291"
        font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="400"
        fill="#FFFFFF">${cover}</text>

  <!-- Valid year -->
  <text x="220" y="268"
        font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="400"
        fill="#9AAABF" letter-spacing="2.5">VALID YEAR</text>
  <text x="220" y="291"
        font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="400"
        fill="#FFFFFF">${year}</text>

  <!-- QR code box background for contrast -->
  <rect x="508" y="22" width="188" height="188" rx="6" fill="#FFFFFF"/>
  <!-- QR code image -->
  <image xlink:href="${qrDataUrl}" x="512" y="26" width="180" height="180"
         preserveAspectRatio="xMidYMid meet"/>
  <!-- Scan label -->
  <text x="602" y="226"
        font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="400"
        fill="#9AAABF" text-anchor="middle" letter-spacing="1.5">SCAN TO VERIFY</text>

  <!-- Footer text -->
  <text x="${W / 2}" y="${H - 30}"
        font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700"
        fill="#1A2B4A" text-anchor="middle">Underwritten by Old Mutual</text>
  <text x="${W / 2}" y="${H - 12}"
        font-family="Arial, Helvetica, sans-serif" font-size="9.5"
        fill="#1A2B4A" text-anchor="middle">
    +254-118-043-715 • info@mylife-companion.com • www.mylife-companion.com
  </text>
</svg>`;
}

async function generateCardPNG(member) {
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify/${member.membership_number}`;

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'H',
    width: 200,
    margin: 1,
    color: { dark: '#1A2B4A', light: '#FFFFFF' },
  });

  const cardPath = path.join(CARDS_DIR, `card-${member.membership_number}.png`);
  const svgContent = buildCardSVG(member, qrDataUrl);

  const pngBuffer = await sharp(Buffer.from(svgContent))
    .png({ compressionLevel: 6 })
    .toBuffer();

  fs.writeFileSync(cardPath, pngBuffer);

  await pool.query(
    `INSERT INTO membership_cards (member_id, membership_number, qr_code_data, card_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (member_id) DO UPDATE SET
       membership_number = $2, qr_code_data = $3, card_url = $4, issued_at = NOW()`,
    [member.id, member.membership_number, verifyUrl, cardPath]
  );

  if (member.email) {
    await sendEmail({
      to: member.email,
      subject: 'Your My Life Companion Welfare Membership Card',
      html: `<p>Dear ${member.full_name},</p>
             <p>Please find attached your virtual membership card.</p>
             <p><strong>Membership Number: ${member.membership_number}</strong></p>
             <p>You can also download your card from your member portal at any time.</p>
             <p>Regards,<br/>My Life Companion Welfare</p>`,
      attachments: [
        {
          filename: `membership-card-${member.membership_number}.png`,
          content: pngBuffer,
          contentType: 'image/png',
        },
      ],
    }).catch(console.error);

    await pool.query('UPDATE membership_cards SET emailed_at = NOW() WHERE member_id = $1', [member.id]);
  }

  const downloadLink = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/v1/members/${member.id}/card`;
  await sendSMS(
    member.phone,
    `Your MLC Welfare card is ready. No: ${member.membership_number}. Download: ${downloadLink}`
  ).catch(console.error);
  await pool.query('UPDATE membership_cards SET sms_sent_at = NOW() WHERE member_id = $1', [member.id]);

  return cardPath;
}

// Kept as alias so existing callers (approveMember) don't need changes
const generateCardPDF = generateCardPNG;

module.exports = { generateCardPDF, generateCardPNG };
