const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const { createClient } = require('@libsql/client/web');

function getDbClient() {
  let url = (process.env.TURSO_DATABASE_URL || '').trim().replace(/^["']|["']$/g, '');
  const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim().replace(/^["']|["']$/g, '');

  if (!url || !authToken) {
    const missing = [];
    if (!url) missing.push('TURSO_DATABASE_URL');
    if (!authToken) missing.push('TURSO_AUTH_TOKEN');
    throw new Error(`Missing environment variable(s): ${missing.join(', ')} in Vercel.`);
  }

  // Ensure pure HTTPS URL for serverless/edge compatibility
  if (url.startsWith('libsql://')) {
    url = url.replace('libsql://', 'https://');
  }

  return createClient({
    url: url,
    authToken: authToken
  });
}

let clientInstance = null;
function getDb() {
  if (!clientInstance) {
    clientInstance = getDbClient();
  }
  return clientInstance;
}

const proxy = new Proxy({}, {
  get(target, prop) {
    const client = getDb();
    if (typeof client[prop] === 'function') {
      return client[prop].bind(client);
    }
    return client[prop];
  }
});

module.exports = proxy;
