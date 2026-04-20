const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { generateQRCodeBuffer } = require('../../utils/qrcode');
const { pool } = require('../../config/db');
const { sendEmail } = require('../../utils/email');
const { sendSMS } = require('../../utils/sms');

const CARDS_DIR = path.join(__dirname, '../../../../uploads/cards');

// Ensure cards directory exists
if (!fs.existsSync(CARDS_DIR)) {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
}

async function generateCardPDF(member) {
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify/${member.membership_number}`;
  const qrBuffer = await generateQRCodeBuffer(verifyUrl);

  const cardPath = path.join(CARDS_DIR, `card-${member.membership_number}.pdf`);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [340, 200],
      margin: 0,
    });

    const stream = fs.createWriteStream(cardPath);
    doc.pipe(stream);

    // Background
    doc.rect(0, 0, 340, 200).fill('#1A2B4A');

    // Gold accent bar on left
    doc.rect(0, 0, 8, 200).fill('#F5A623');

    // Gold accent bar at bottom
    doc.rect(0, 185, 340, 15).fill('#F5A623');

    // Organization name
    doc.fillColor('#F5A623')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('MY LIFE COMPANION', 20, 18, { width: 220 });

    doc.fillColor('#FFFFFF')
       .fontSize(9)
       .font('Helvetica')
       .text('WELFARE', 20, 33, { width: 220 });

    // Separator line
    doc.moveTo(20, 47).lineTo(220, 47).strokeColor('#F5A623').lineWidth(0.5).stroke();

    // Member details
    doc.fillColor('#CCCCCC')
       .fontSize(7)
       .font('Helvetica')
       .text('MEMBER NAME', 20, 55);

    doc.fillColor('#FFFFFF')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(member.full_name.toUpperCase(), 20, 65, { width: 200 });

    doc.fillColor('#CCCCCC')
       .fontSize(7)
       .font('Helvetica')
       .text('MEMBERSHIP NO.', 20, 90);

    doc.fillColor('#F5A623')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text(member.membership_number, 20, 100);

    doc.fillColor('#CCCCCC')
       .fontSize(7)
       .font('Helvetica')
       .text('COVER OPTION', 20, 120);

    doc.fillColor('#FFFFFF')
       .fontSize(9)
       .font('Helvetica')
       .text(`Option ${member.cover_option}`, 20, 130);

    doc.fillColor('#CCCCCC')
       .fontSize(7)
       .font('Helvetica')
       .text('VALID YEAR', 20, 145);

    doc.fillColor('#FFFFFF')
       .fontSize(9)
       .font('Helvetica')
       .text(new Date().getFullYear().toString(), 20, 155);

    // QR Code
    doc.image(qrBuffer, 250, 20, { width: 70, height: 70 });

    doc.fillColor('#AAAAAA')
       .fontSize(6)
       .font('Helvetica')
       .text('Scan to verify', 255, 92, { width: 65, align: 'center' });

    // Footer
    doc.fillColor('#1A2B4A')
       .fontSize(7)
       .font('Helvetica-Bold')
       .text('Underwritten by Old Mutual', 20, 189, { width: 300, align: 'center' });

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Store card record in DB
  const qrDataUrl = verifyUrl;
  const cardUrl = cardPath;

  await pool.query(
    `INSERT INTO membership_cards (member_id, membership_number, qr_code_data, card_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (member_id) DO UPDATE SET
       membership_number = $2, qr_code_data = $3, card_url = $4, issued_at = NOW()`,
    [member.id, member.membership_number, qrDataUrl, cardUrl]
  );

  // Email card to member
  if (member.email) {
    await sendEmail({
      to: member.email,
      subject: 'Your My Life Companion Welfare Membership Card',
      html: `<p>Dear ${member.full_name},</p><p>Please find attached your virtual membership card.</p><p><strong>Membership Number: ${member.membership_number}</strong></p><p>You can also download your card from your member portal at any time.</p><p>Regards,<br/>My Life Companion Welfare</p>`,
      attachments: [
        {
          filename: `membership-card-${member.membership_number}.pdf`,
          path: cardPath,
          contentType: 'application/pdf',
        },
      ],
    }).catch(console.error);

    await pool.query('UPDATE membership_cards SET emailed_at = NOW() WHERE member_id = $1', [member.id]);
  }

  // SMS with download link
  const downloadLink = `${process.env.SERVER_URL || 'http://localhost:5000'}/api/v1/members/${member.id}/card`;
  const smsMsg = `Your MLC Welfare membership card is ready. No: ${member.membership_number}. Download: ${downloadLink}`;
  await sendSMS(member.phone, smsMsg).catch(console.error);
  await pool.query('UPDATE membership_cards SET sms_sent_at = NOW() WHERE member_id = $1', [member.id]);

  return cardPath;
}

module.exports = { generateCardPDF };
