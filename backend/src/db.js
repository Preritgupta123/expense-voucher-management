const mysql = require('mysql2/promise');
require('dotenv').config();

// A pool keeps several connections open and reuses them,
// so we don't reconnect to MySQL on every request.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

module.exports = pool;