/**
 * High-Speed Production Backup Engine: Google Sheets -> Turso (LibSQL SQLite)
 * 
 * Fetches all live data from Google Sheet (1Gw-tjQuVRzp6jO57jdH7OzvfEx4Brw_DV6uRb1cUDt8)
 * and creates a full, verified backup in the Turso database using LibSQL batch pipelines.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../api/lib/db');

const SHEET_ID = '1Gw-tjQuVRzp6jO57jdH7OzvfEx4Brw_DV6uRb1cUDt8';

async function fetchGVizTable(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching sheet "${sheetName}"`);
  const text = await res.text();
  const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\);/);
  if (!jsonMatch) throw new Error(`Failed to parse GViz JSON for "${sheetName}"`);
  const data = JSON.parse(jsonMatch[1]);
  const rows = data.table.rows || [];
  return rows.map(r => {
    return (r.c || []).map(cell => {
      if (!cell) return null;
      return cell.v !== undefined ? cell.v : null;
    });
  });
}

function parseNum(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

function parseStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseDateStr(val) {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/Date\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (match) {
    const y = match[1];
    const m = String(parseInt(match[2], 10) + 1).padStart(2, '0');
    const d = String(match[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str;
}

async function executeInBatches(statements, chunkSize = 50) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await db.batch(chunk, "write");
  }
}

async function initializeSchema() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS declarations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sno INTEGER,
      name TEXT,
      city TEXT,
      notes TEXT,
      mobile TEXT,
      amount REAL,
      deposited REAL,
      balance REAL,
      receipt TEXT,
      date TEXT,
      collector TEXT,
      collector_username TEXT,
      payment_mode TEXT,
      payment_date TEXT,
      source_tab TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sno INTEGER,
      receipt_no TEXT,
      donor_sno INTEGER,
      donor_name TEXT,
      city TEXT,
      amount REAL,
      payment_mode TEXT,
      payment_date TEXT,
      ref_no TEXT,
      collector TEXT,
      collector_username TEXT,
      remarks TEXT,
      source_tab TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sno INTEGER,
      payee TEXT,
      date TEXT,
      voucher_no TEXT,
      description TEXT,
      category TEXT,
      item_name TEXT,
      quantity REAL,
      unit TEXT,
      rate REAL,
      taxable_amount REAL,
      gst_amount REAL,
      total_amount REAL,
      gstin TEXT,
      status TEXT,
      paid_amount REAL,
      balance_amount REAL,
      payment_ref TEXT,
      source_tab TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sno INTEGER,
      account_no TEXT,
      payment_date TEXT,
      vendor_name TEXT,
      category TEXT,
      payment_mode TEXT,
      cheque_no TEXT,
      amount REAL,
      clearance_status TEXT,
      remarks TEXT,
      source_tab TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modified_at TEXT,
      type TEXT,
      ref_id TEXT,
      donor_name TEXT,
      city TEXT,
      amount REAL,
      modified_by TEXT,
      karyakarta_name TEXT,
      change_details TEXT
    );

    CREATE TABLE IF NOT EXISTS deleted_archive (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deleted_at TEXT,
      type TEXT,
      ref_id TEXT,
      donor_name TEXT,
      city TEXT,
      amount REAL,
      deleted_by TEXT,
      karyakarta_name TEXT,
      details TEXT,
      raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      synced_at TEXT,
      total_declarations INTEGER,
      total_collections INTEGER,
      total_expenses INTEGER,
      total_payments INTEGER,
      total_audit_logs INTEGER,
      total_deleted_archive INTEGER,
      duration_seconds REAL,
      status TEXT
    );
  `);

  try {
    await db.execute('ALTER TABLE sync_history ADD COLUMN duration_seconds REAL');
  } catch (e) {
    // Column already exists
  }
}

async function backupAllData() {
  const startTime = Date.now();
  console.log("============================================================");
  console.log(" 🚀 Koteshwar Ghat Nirman - High-Speed Backup Engine");
  console.log("============================================================\n");

  await initializeSchema();

  // Wipe tables for clean replacement
  await db.executeMultiple(`
    DELETE FROM declarations;
    DELETE FROM collections;
    DELETE FROM expenses;
    DELETE FROM payments;
    DELETE FROM audit_logs;
    DELETE FROM deleted_archive;
  `);

  // Parallel fetch from Google Sheet
  console.log("📥 Fetching all tabs in parallel from Google Sheet...");
  const [
    bulkDeclRows,
    liveDeclRows,
    liveCollRows,
    expRows,
    payRows,
    auditRows,
    delRows
  ] = await Promise.all([
    fetchGVizTable('Declarations'),
    fetchGVizTable('Live Declaration'),
    fetchGVizTable('Live Collection'),
    fetchGVizTable('Expenses'),
    fetchGVizTable('Payments'),
    fetchGVizTable('Audit Log'),
    fetchGVizTable('Deleted Archive')
  ]);

  // 1. Prepare Declarations Statements
  const declStmts = [];
  for (const r of bulkDeclRows) {
    const sno = parseInt(r[0], 10);
    const name = parseStr(r[1]);
    if (!name && isNaN(sno)) continue;
    declStmts.push({
      sql: `INSERT INTO declarations (sno, name, city, notes, mobile, amount, deposited, balance, receipt, date, payment_mode, payment_date, source_tab)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Declarations')`,
      args: [
        isNaN(sno) ? null : sno,
        name,
        parseStr(r[2]),
        parseStr(r[3]),
        parseStr(r[4]),
        parseNum(r[5]),
        parseNum(r[8]),
        parseNum(r[11]),
        parseStr(r[6]),
        parseDateStr(r[7]),
        parseStr(r[9]),
        parseDateStr(r[10])
      ]
    });
  }
  for (const lr of liveDeclRows) {
    const sno = parseInt(lr[0], 10);
    const name = parseStr(lr[1]);
    if (!name && isNaN(sno)) continue;
    declStmts.push({
      sql: `INSERT INTO declarations (sno, name, city, notes, mobile, amount, receipt, date, collector, collector_username, source_tab)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Live Declaration')`,
      args: [
        isNaN(sno) ? null : sno,
        name,
        parseStr(lr[2]),
        parseStr(lr[3]),
        parseStr(lr[4]),
        parseNum(lr[5]),
        parseStr(lr[6]),
        parseDateStr(lr[7]),
        parseStr(lr[8]),
        parseStr(lr[9])
      ]
    });
  }

  // 2. Prepare Collections Statements
  const collStmts = [];
  for (const cr of liveCollRows) {
    const sno = parseInt(cr[0], 10);
    const rcpt = parseStr(cr[1]);
    if (!rcpt && isNaN(sno)) continue;
    collStmts.push({
      sql: `INSERT INTO collections (sno, receipt_no, donor_sno, donor_name, city, amount, payment_mode, payment_date, ref_no, collector, collector_username, remarks, source_tab)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Live Collection')`,
      args: [
        isNaN(sno) ? null : sno,
        rcpt,
        parseInt(cr[2], 10) || null,
        parseStr(cr[3]),
        parseStr(cr[4]),
        parseNum(cr[5]),
        parseStr(cr[6]),
        parseDateStr(cr[7]),
        parseStr(cr[8]),
        parseStr(cr[9]),
        parseStr(cr[10]),
        parseStr(cr[11])
      ]
    });
  }

  // 3. Prepare Expenses Statements
  const expStmts = [];
  for (const er of expRows) {
    const sno = parseInt(er[0], 10);
    const payee = parseStr(er[1]);
    if (!payee && isNaN(sno)) continue;
    expStmts.push({
      sql: `INSERT INTO expenses (sno, payee, date, voucher_no, description, category, item_name, quantity, unit, rate, taxable_amount, gst_amount, total_amount, gstin, status, paid_amount, balance_amount, payment_ref, source_tab)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Expenses')`,
      args: [
        isNaN(sno) ? null : sno,
        payee,
        parseDateStr(er[2]),
        parseStr(er[3]),
        parseStr(er[4]),
        parseStr(er[5]),
        parseStr(er[6]),
        parseNum(er[7]),
        parseStr(er[8]),
        parseNum(er[9]),
        parseNum(er[10]),
        parseNum(er[11]),
        parseNum(er[12]),
        parseStr(er[13]),
        parseStr(er[14]),
        parseNum(er[15]),
        parseNum(er[16]),
        parseStr(er[17])
      ]
    });
  }

  // 4. Prepare Payments Statements
  const payStmts = [];
  for (const pr of payRows) {
    const sno = parseInt(pr[0], 10);
    const vendor = parseStr(pr[3]);
    if (!vendor && isNaN(sno)) continue;
    payStmts.push({
      sql: `INSERT INTO payments (sno, account_no, payment_date, vendor_name, category, payment_mode, cheque_no, amount, clearance_status, remarks, source_tab)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Payments')`,
      args: [
        isNaN(sno) ? null : sno,
        parseStr(pr[1]),
        parseDateStr(pr[2]),
        vendor,
        parseStr(pr[4]),
        parseStr(pr[5]),
        parseStr(pr[6]),
        parseNum(pr[7]),
        parseStr(pr[8]),
        parseStr(pr[9])
      ]
    });
  }

  // 5. Prepare Audit Statements
  const auditStmts = [];
  for (const ar of auditRows) {
    const time = parseStr(ar[0]);
    if (!time) continue;
    auditStmts.push({
      sql: `INSERT INTO audit_logs (modified_at, type, ref_id, donor_name, city, amount, modified_by, karyakarta_name, change_details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        time,
        parseStr(ar[1]),
        parseStr(ar[2]),
        parseStr(ar[3]),
        parseStr(ar[4]),
        parseNum(ar[5]),
        parseStr(ar[6]),
        parseStr(ar[7]),
        parseStr(ar[8])
      ]
    });
  }

  // 6. Prepare Deleted Archive Statements
  const delStmts = [];
  for (const dr of delRows) {
    const time = parseStr(dr[0]);
    if (!time) continue;
    delStmts.push({
      sql: `INSERT INTO deleted_archive (deleted_at, type, ref_id, donor_name, city, amount, deleted_by, karyakarta_name, details, raw_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        time,
        parseStr(dr[1]),
        parseStr(dr[2]),
        parseStr(dr[3]),
        parseStr(dr[4]),
        parseNum(dr[5]),
        parseStr(dr[6]),
        parseStr(dr[7]),
        parseStr(dr[8]),
        parseStr(dr[9])
      ]
    });
  }

  // Fast Batch Pipeline Ingestion
  console.log("⚡ Ingesting into Turso via batch pipelines...");
  await Promise.all([
    executeInBatches(declStmts, 50),
    executeInBatches(collStmts, 50),
    executeInBatches(expStmts, 50),
    executeInBatches(payStmts, 50),
    executeInBatches(auditStmts, 50),
    executeInBatches(delStmts, 50)
  ]);

  const durationSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

  // Record Sync History
  await db.execute({
    sql: `INSERT INTO sync_history (synced_at, total_declarations, total_collections, total_expenses, total_payments, total_audit_logs, total_deleted_archive, duration_seconds, status)
          VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [declStmts.length, collStmts.length, expStmts.length, payStmts.length, auditStmts.length, delStmts.length, durationSec, `COMPLETED in ${durationSec}s`]
  });

  console.log("\n============================================================");
  console.log(` 🎉 Backup Completed in ONLY ${durationSec}s!`);
  console.log(` 📊 Declarations:    ${declStmts.length}`);
  console.log(` 📊 Collections:     ${collStmts.length}`);
  console.log(` 📊 Expenses:        ${expStmts.length}`);
  console.log(` 📊 Payments:        ${payStmts.length}`);
  console.log(` 📊 Audit Logs:      ${auditStmts.length}`);
  console.log(` 📊 Deleted Archive: ${delStmts.length}`);
  console.log("============================================================\n");

  return {
    declarations: declStmts.length,
    collections: collStmts.length,
    expenses: expStmts.length,
    payments: payStmts.length,
    auditLogs: auditStmts.length,
    deletedArchive: delStmts.length,
    durationSeconds: durationSec
  };
}

if (require.main === module) {
  backupAllData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error("❌ Backup failed:", err);
      process.exit(1);
    });
}

module.exports = { backupAllData };
