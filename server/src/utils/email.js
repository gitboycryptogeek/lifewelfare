const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text, attachments = [] }) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL MOCK] To: ${to}`);
    console.log(`[EMAIL MOCK] Subject: ${subject}`);
    return { success: true, mock: true };
  }

  const t = getTransporter();
  return t.sendMail({
    from: process.env.FROM_EMAIL || 'My Life Companion <notifications@mylife-companion.com>',
    to,
    subject,
    html,
    text,
    attachments,
  });
}

module.exports = { sendEmail };
