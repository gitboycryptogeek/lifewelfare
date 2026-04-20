const { pool } = require('../config/db');

async function generateMembershipNumber() {
  const year = new Date().getFullYear();
  const prefix = process.env.MEMBERSHIP_PREFIX || 'WEL';

  // Use a transaction to ensure atomicity
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT COUNT(*) + 1 AS next_seq
       FROM members
       WHERE membership_number LIKE $1`,
      [`${prefix}-${year}-%`]
    );

    const seq = String(result.rows[0].next_seq).padStart(4, '0');
    const membershipNumber = `${prefix}-${year}-${seq}`;

    await client.query('COMMIT');
    return membershipNumber;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { generateMembershipNumber };
