/**
 * Vercel Serverless Function: Automated Daily Turso Backup Sync & Status API
 * Route: /api/backup-turso
 */

const db = require('./lib/db');
const { backupAllData } = require('../scripts/sync_sheets_to_turso');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Optional: Check CRON_SECRET if configured on Vercel
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized: Invalid CRON_SECRET' });
  }

  try {
    const isStatusCheck = req.query && (req.query.status === '1' || req.query.status === 'true');

    if (isStatusCheck) {
      const decls = await db.execute('SELECT count(*) as count, sum(amount) as total_pledged, sum(deposited) as total_deposited FROM declarations');
      const colls = await db.execute('SELECT count(*) as count, sum(amount) as total_collected FROM collections');
      const exps = await db.execute('SELECT count(*) as count, sum(total_amount) as total_expense FROM expenses');
      const pays = await db.execute('SELECT count(*) as count, sum(amount) as total_paid FROM payments');
      const history = await db.execute('SELECT * FROM sync_history ORDER BY id DESC LIMIT 5');

      return res.status(200).json({
        success: true,
        summary: {
          declarations: decls.rows[0],
          collections: colls.rows[0],
          expenses: exps.rows[0],
          payments: pays.rows[0],
          lastSync: history.rows[0] || null,
          recentSyncs: history.rows
        }
      });
    }

    // Execute backup (runs in < 2 seconds via LibSQL batch pipeline)
    const result = await backupAllData();

    const lastSync = await db.execute('SELECT * FROM sync_history ORDER BY id DESC LIMIT 1');

    return res.status(200).json({
      success: true,
      message: `Google Sheets data backed up to Turso in ${result.durationSeconds}s.`,
      stats: result,
      syncRecord: lastSync.rows[0]
    });
  } catch (err) {
    console.error("Backup to Turso failed:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
