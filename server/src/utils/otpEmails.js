function otpEmailShell({ fullName, code, purposeHeading, purposeSentence }) {
  return {
    subject: `Your MLC verification code: ${code}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#1a2e5a;padding:24px 32px;">
            <span style="font-size:22px;font-weight:700;color:#c9a84c;letter-spacing:1px;">My Life Companion</span>
            <span style="font-size:22px;font-weight:700;color:#ffffff;"> Welfare</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 8px;color:#1a2e5a;font-size:18px;">${purposeHeading}</h2>
            <p style="margin:0 0 24px;color:#555555;font-size:14px;">Hello <strong>${fullName}</strong>, ${purposeSentence}</p>
            <!-- OTP Box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:16px 0;">
                  <div style="display:inline-block;background:#f8f4e8;border:2px dashed #c9a84c;border-radius:10px;padding:18px 32px;">
                    <span style="font-size:38px;font-weight:700;letter-spacing:16px;color:#1a2e5a;">${code}</span>
                  </div>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#888888;font-size:13px;text-align:center;">
              This code expires in <strong>10 minutes</strong>.<br/>
              If you did not request this, please ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eeeeee;">
            <p style="margin:0;color:#aaaaaa;font-size:11px;text-align:center;">
              My Life Companion Welfare &nbsp;·&nbsp; +254-118-043-715 &nbsp;·&nbsp; info@mylife-companion.com
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

function loginOtpEmail({ fullName, code }) {
  return otpEmailShell({
    fullName,
    code,
    purposeHeading: 'Sign-in Verification',
    purposeSentence: 'use the code below to complete your sign-in.',
  });
}

function memberLoginOtpEmail({ fullName, code }) {
  return otpEmailShell({
    fullName,
    code,
    purposeHeading: 'Member Portal Access',
    purposeSentence: 'use the code below to access your member portal.',
  });
}

function forgotPasswordOtpEmail({ fullName, code }) {
  return otpEmailShell({
    fullName,
    code,
    purposeHeading: 'Password Reset Request',
    purposeSentence: 'use the code below to reset your password.',
  });
}

const purposeLabels = {
  change_password: 'change your password',
  edit_member: 'authorise the member record update',
  disburse: 'authorise the commission disbursement',
};

function actionOtpEmail({ fullName, code, purpose }) {
  const action = purposeLabels[purpose] || 'authorise this action';
  return otpEmailShell({
    fullName,
    code,
    purposeHeading: 'Action Verification Required',
    purposeSentence: `use the code below to ${action}.`,
  });
}

module.exports = { loginOtpEmail, memberLoginOtpEmail, forgotPasswordOtpEmail, actionOtpEmail };
