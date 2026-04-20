const QRCode = require('qrcode');

async function generateQRCode(data) {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 200,
    margin: 1,
  });
}

async function generateQRCodeBuffer(data) {
  return QRCode.toBuffer(data, {
    errorCorrectionLevel: 'H',
    type: 'png',
    width: 200,
    margin: 1,
  });
}

module.exports = { generateQRCode, generateQRCodeBuffer };
