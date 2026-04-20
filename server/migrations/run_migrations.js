/**
 * Migration runner — applies all SQL migrations in order.
 * Run: node server/migrations/run_migrations.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../server/.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname);
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files.`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`Running: ${file}...`);
    try {
      await pool.query(sql);
      console.log(`  ✅ ${file} completed`);
    } catch (err) {
      console.error(`  ❌ ${file} failed:`, err.message);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations completed successfully.');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('Migration runner error:', err);
  process.exit(1);
});
