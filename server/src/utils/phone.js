function normalisePhone(p) {
  const digits = p.replace(/\D/g, '');
  if (digits.startsWith('254')) return '+' + digits;
  if (digits.startsWith('0')) return '+254' + digits.slice(1);
  return p;
}

module.exports = { normalisePhone };
