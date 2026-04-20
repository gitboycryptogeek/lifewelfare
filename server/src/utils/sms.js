let at;

function getATInstance() {
  if (!at) {
    const AfricasTalking = require('africastalking');
    at = AfricasTalking({
      apiKey: process.env.AT_API_KEY,
      username: process.env.AT_USERNAME,
    });
  }
  return at;
}

async function sendSMS(to, message) {
  if (!process.env.AT_API_KEY || process.env.AT_USERNAME === 'sandbox') {
    console.log(`[SMS MOCK] To: ${Array.isArray(to) ? to.join(',') : to}`);
    console.log(`[SMS MOCK] Message: ${message}`);
    return { success: true, mock: true };
  }

  const instance = getATInstance();
  return instance.SMS.send({
    to: Array.isArray(to) ? to : [to],
    message,
    from: process.env.AT_SENDER_ID || 'MYLIFECOMP',
  });
}

module.exports = { sendSMS };
