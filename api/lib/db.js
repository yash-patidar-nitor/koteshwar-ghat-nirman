const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const { createClient } = require('@libsql/client');

function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    const missing = [];
    if (!url) missing.push('TURSO_DATABASE_URL');
    if (!authToken) missing.push('TURSO_AUTH_TOKEN');
    throw new Error(`Missing environment variables: ${missing.join(', ')}. Please add them in Vercel Project Settings > Environment Variables and redeploy.`);
  }

  return createClient({
    url: url,
    authToken: authToken
  });
}

// Lazy-loaded or immediate client
let clientInstance = null;
function getDb() {
  if (!clientInstance) {
    clientInstance = getDbClient();
  }
  return clientInstance;
}

// Proxy so db.execute(...) works directly
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
