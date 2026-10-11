require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./db');

// The assignment has no signup screen, so we create one test user per role.
const users = [
  { name: 'Asha Employee', email: 'employee@test.com', role: 'employee', code: 'EMP001' },
  { name: 'Ravi Employee', email: 'employee2@test.com', role: 'employee', code: 'EMP002' },
  { name: 'Dev Director', email: 'director@test.com', role: 'director', code: null },
  { name: 'Anil Accounts', email: 'accounts@test.com', role: 'accounts', code: null },
];

(async () => {
  for (const u of users) {
    // Never store the real password, only its hash
    const hash = await bcrypt.hash('Password@123', 10);
    // INSERT IGNORE skips a row if the email already exists, so you can re-run safely
    await pool.query(
      'INSERT IGNORE INTO users (name, email, password_hash, role, employee_code) VALUES (?, ?, ?, ?, ?)',
      [u.name, u.email, hash, u.role, u.code]
    );
  }
  console.log('Seeded users. Password for all: Password@123');
  await pool.end();
})();