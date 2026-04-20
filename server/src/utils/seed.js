/**
 * Seed script — creates the initial super_admin account.
 * Run once after migrations:
 *   node server/src/utils/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../../server/.env') });
require('../config/env').validateEnv();

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seed() {
  const phone = process.env.SEED_ADMIN_PHONE || '+254118043715';
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@1234';
  const fullName = 'Super Administrator';

  const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
  if (existing.rows.length > 0) {
    console.log('Super admin already exists. Skipping seed.');
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (full_name, phone, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'super_admin')`,
    [fullName, phone, 'admin@mylife-companion.com', hash]
  );

  console.log('✅ Super admin created:');
  console.log(`   Phone: ${phone}`);
  console.log(`   Password: ${password}`);
  console.log('   ⚠️  Change this password immediately after first login!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
