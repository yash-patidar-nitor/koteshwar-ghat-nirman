const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config(); // Fallback to current working dir

const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.warn("⚠️ TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set in environment.");
}

const db = createClient({
  url: url || 'libsql://localhost',
  authToken: authToken || ''
});

module.exports = db;
