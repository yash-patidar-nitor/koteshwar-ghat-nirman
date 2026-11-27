/**
 * Vercel Serverless Function: Real-Time Transaction Handler for Turso SQLite
 * Route: /api/turso-transaction
 * 
 * Synchronizes new Declarations, Collections (Receipts), Edits, and Soft-Deletes
 * instantly into the Turso database alongside Google Sheets.
 */

const db = require('./lib/db');

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const recentColls = await db.execute({
        sql: 'SELECT id, receipt_no, donor_name, city, amount, payment_date, created_at FROM collections ORDER BY id DESC LIMIT 5',
        args: []
      });
      const recentDecls = await db.execute({
        sql: 'SELECT id, sno, name, city, amount, deposited, balance, created_at FROM declarations ORDER BY id DESC LIMIT 5',
        args: []
      });
      return res.status(200).json({
        success: true,
        message: 'Turso transaction endpoint is live and operational.',
        recentCollections: recentColls.rows,
        recentDeclarations: recentDecls.rows
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const payload = req.body || {};
  const action = payload.action;
  const item = payload.data || {};

  if (!action) {
    return res.status(400).json({ success: false, error: 'Action parameter is required.' });
  }

  const nowIso = new Date().toISOString();

  try {
    switch (action) {
      // ==========================================
      // 1. ADD DECLARATION (नया संकल्प)
      // ==========================================
      case 'addDeclaration': {
        const sno = item.sno ? parseInt(item.sno, 10) : null;
        const name = parseStr(item.name);
        const city = parseStr(item.city) || 'अन्य';
        const notes = parseStr(item.notes);
        const mobile = parseStr(item.mobile);
        const amount = parseNum(item.amount);
        const deposited = parseNum(item.deposited);
        const balance = amount - deposited;
        const receipt = parseStr(item.receipt) || '-';
        const date = parseStr(item.date) || nowIso.slice(0, 10);
        const collector = parseStr(item.collector);
        const collectorUsername = parseStr(item.collectorUsername);
        const paymentMode = parseStr(item.paymentMode);
        const paymentDate = parseStr(item.paymentDate);

        // Check if sno already exists (prevent duplicate if re-submitted)
        let existing = null;
        if (sno) {
          const check = await db.execute({
            sql: 'SELECT id FROM declarations WHERE sno = ?',
            args: [sno]
          });
          if (check.rows.length > 0) existing = check.rows[0];
        }

        if (existing) {
          await db.execute({
            sql: `UPDATE declarations SET 
                    name = ?, city = ?, notes = ?, mobile = ?, amount = ?, 
                    deposited = ?, balance = ?, receipt = ?, date = ?, 
                    collector = ?, collector_username = ?, payment_mode = ?, payment_date = ?
                  WHERE id = ?`,
            args: [
              name, city, notes, mobile, amount,
              deposited, balance, receipt, date,
              collector, collectorUsername, paymentMode, paymentDate,
              existing.id
            ]
          });
          return res.status(200).json({
            success: true,
            action: 'addDeclaration',
            mode: 'updated_existing',
            sno: sno,
            message: `Declaration #${sno} updated in Turso.`
          });
        } else {
          const insertResult = await db.execute({
            sql: `INSERT INTO declarations (
                    sno, name, city, notes, mobile, amount, deposited, balance, 
                    receipt, date, collector, collector_username, payment_mode, 
                    payment_date, source_tab, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              sno, name, city, notes, mobile, amount, deposited, balance,
              receipt, date, collector, collectorUsername, paymentMode,
              paymentDate, 'Live Entry', nowIso
            ]
          });
          return res.status(200).json({
            success: true,
            action: 'addDeclaration',
            mode: 'inserted',
            sno: sno,
            id: Number(insertResult.lastInsertRowid),
            message: `Declaration #${sno || insertResult.lastInsertRowid} recorded in Turso.`
          });
        }
      }

      // ==========================================
      // 2. ADD COLLECTION / RECEIPT (नई रसीद / संग्रह)
      // ==========================================
      case 'addCollection': {
        const receiptNo = parseStr(item.receiptNo || item.receipt);
        const donorSno = item.donorSno ? parseInt(item.donorSno, 10) : null;
        const donorName = parseStr(item.donorName || item.name);
        const city = parseStr(item.city);
        const amount = parseNum(item.amount);
        const paymentMode = parseStr(item.paymentMode || 'नकद');
        const paymentDate = parseStr(item.paymentDate || item.date || nowIso.slice(0, 10));
        const refNo = parseStr(item.refNo || item.chequeNo || '-');
        const collector = parseStr(item.collector || item.karyakartaName);
        const collectorUsername = parseStr(item.collectorUsername);
        const remarks = parseStr(item.remarks || item.notes);

        if (!receiptNo) {
          return res.status(400).json({ success: false, error: 'receiptNo is required for collection.' });
        }

        // Check if receiptNo already exists
        const check = await db.execute({
          sql: 'SELECT id FROM collections WHERE receipt_no = ?',
          args: [receiptNo]
        });

        let collId;
        if (check.rows.length > 0) {
          collId = check.rows[0].id;
          await db.execute({
            sql: `UPDATE collections SET 
                    donor_sno = ?, donor_name = ?, city = ?, amount = ?, 
                    payment_mode = ?, payment_date = ?, ref_no = ?, 
                    collector = ?, collector_username = ?, remarks = ?
                  WHERE id = ?`,
            args: [
              donorSno, donorName, city, amount,
              paymentMode, paymentDate, refNo,
              collector, collectorUsername, remarks,
              collId
            ]
          });
        } else {
          const insertResult = await db.execute({
            sql: `INSERT INTO collections (
                    receipt_no, donor_sno, donor_name, city, amount, 
                    payment_mode, payment_date, ref_no, collector, 
                    collector_username, remarks, source_tab, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              receiptNo, donorSno, donorName, city, amount,
              paymentMode, paymentDate, refNo, collector,
              collectorUsername, remarks, 'Live Entry', nowIso
            ]
          });
          collId = Number(insertResult.lastInsertRowid);
        }

        // Update corresponding declaration in Turso if donor is linked
        let declUpdated = false;
        if (donorSno) {
          const declCheck = await db.execute({
            sql: 'SELECT id, deposited, amount, receipt FROM declarations WHERE sno = ?',
            args: [donorSno]
          });
          if (declCheck.rows.length > 0) {
            const d = declCheck.rows[0];
            const newDeposited = parseNum(d.deposited) + amount;
            const newBalance = parseNum(d.amount) - newDeposited;
            const existingReceipts = parseStr(d.receipt);
            const receiptList = existingReceipts && existingReceipts !== '-'
              ? existingReceipts.split(',').map(s => s.trim())
              : [];
            if (!receiptList.includes(receiptNo)) {
              receiptList.push(receiptNo);
            }
            const updatedReceiptStr = receiptList.join(', ');

            await db.execute({
              sql: 'UPDATE declarations SET deposited = ?, balance = ?, receipt = ? WHERE id = ?',
              args: [newDeposited, newBalance, updatedReceiptStr, d.id]
            });
            declUpdated = true;
          }
        }

        return res.status(200).json({
          success: true,
          action: 'addCollection',
          receiptNo: receiptNo,
          id: collId,
          declarationUpdated: declUpdated,
          message: `Collection receipt ${receiptNo} recorded in Turso.`
        });
      }

      // ==========================================
      // 3. EDIT DECLARATION (संकल्प संपादन)
      // ==========================================
      case 'editDeclaration': {
        const targetSno = item.targetSno ? parseInt(item.targetSno, 10) : (item.sno ? parseInt(item.sno, 10) : null);
        if (!targetSno) {
          return res.status(400).json({ success: false, error: 'targetSno is required for editDeclaration.' });
        }

        const name = parseStr(item.name);
        const city = parseStr(item.city);
        const notes = parseStr(item.notes);
        const mobile = parseStr(item.mobile);
        const amount = parseNum(item.amount);

        const current = await db.execute({
          sql: 'SELECT * FROM declarations WHERE sno = ?',
          args: [targetSno]
        });

        if (current.rows.length === 0) {
          return res.status(404).json({ success: false, error: `Declaration #${targetSno} not found in Turso.` });
        }

        const currRow = current.rows[0];
        const deposited = parseNum(currRow.deposited);
        const balance = amount - deposited;

        await db.execute({
          sql: `UPDATE declarations SET 
                  name = ?, city = ?, notes = ?, mobile = ?, amount = ?, balance = ?
                WHERE id = ?`,
          args: [name, city, notes, mobile, amount, balance, currRow.id]
        });

        // Record in audit_logs
        await db.execute({
          sql: `INSERT INTO audit_logs (
                  modified_at, type, ref_id, donor_name, city, amount, 
                  modified_by, karyakarta_name, change_details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            nowIso, 'Declaration Edit', String(targetSno), name, city, amount,
            item.auditUser || 'Karyakarta', item.auditUser || 'Karyakarta',
            item.auditReason || `Amount updated from ${currRow.amount} to ${amount}`
          ]
        });

        return res.status(200).json({
          success: true,
          action: 'editDeclaration',
          sno: targetSno,
          message: `Declaration #${targetSno} updated in Turso and logged to audit.`
        });
      }

      // ==========================================
      // 4. DELETE DECLARATION (संकल्प सॉफ्ट-डिलीट)
      // ==========================================
      case 'deleteDeclaration': {
        const targetSno = item.targetSno ? parseInt(item.targetSno, 10) : (item.sno ? parseInt(item.sno, 10) : null);
        if (!targetSno) {
          return res.status(400).json({ success: false, error: 'targetSno is required for deleteDeclaration.' });
        }

        const current = await db.execute({
          sql: 'SELECT * FROM declarations WHERE sno = ?',
          args: [targetSno]
        });

        if (current.rows.length === 0) {
          return res.status(404).json({ success: false, error: `Declaration #${targetSno} not found in Turso.` });
        }

        const currRow = current.rows[0];

        // Archive into deleted_archive
        await db.execute({
          sql: `INSERT INTO deleted_archive (
                  deleted_at, type, ref_id, donor_name, city, amount, 
                  deleted_by, karyakarta_name, details, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            nowIso, 'Declaration', String(targetSno), currRow.name, currRow.city, parseNum(currRow.amount),
            item.auditUser || 'Karyakarta', item.auditUser || 'Karyakarta',
            item.auditReason || 'Soft deleted from portal',
            JSON.stringify(currRow)
          ]
        });

        // Delete from active declarations table
        await db.execute({
          sql: 'DELETE FROM declarations WHERE id = ?',
          args: [currRow.id]
        });

        return res.status(200).json({
          success: true,
          action: 'deleteDeclaration',
          sno: targetSno,
          message: `Declaration #${targetSno} archived and removed from Turso.`
        });
      }

      // ==========================================
      // 5. EDIT COLLECTION (रसीद संपादन)
      // ==========================================
      case 'editCollection': {
        const origReceiptNo = parseStr(item.origReceiptNo || item.receiptNo);
        if (!origReceiptNo) {
          return res.status(400).json({ success: false, error: 'origReceiptNo is required for editCollection.' });
        }

        const current = await db.execute({
          sql: 'SELECT * FROM collections WHERE receipt_no = ?',
          args: [origReceiptNo]
        });

        if (current.rows.length === 0) {
          return res.status(404).json({ success: false, error: `Collection receipt ${origReceiptNo} not found in Turso.` });
        }

        const currRow = current.rows[0];
        const newReceiptNo = parseStr(item.receiptNo || origReceiptNo);
        const donorName = parseStr(item.donorName || currRow.donor_name);
        const city = parseStr(item.city || currRow.city);
        const newAmount = parseNum(item.amount || currRow.amount);
        const paymentMode = parseStr(item.paymentMode || currRow.payment_mode);
        const paymentDate = parseStr(item.paymentDate || currRow.payment_date);
        const refNo = parseStr(item.refNo || currRow.ref_no);
        const remarks = parseStr(item.remarks || currRow.remarks);

        await db.execute({
          sql: `UPDATE collections SET 
                  receipt_no = ?, donor_name = ?, city = ?, amount = ?, 
                  payment_mode = ?, payment_date = ?, ref_no = ?, remarks = ?
                WHERE id = ?`,
          args: [newReceiptNo, donorName, city, newAmount, paymentMode, paymentDate, refNo, remarks, currRow.id]
        });

        // Record in audit_logs
        await db.execute({
          sql: `INSERT INTO audit_logs (
                  modified_at, type, ref_id, donor_name, city, amount, 
                  modified_by, karyakarta_name, change_details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            nowIso, 'Collection Edit', newReceiptNo, donorName, city, newAmount,
            item.auditUser || 'Karyakarta', item.auditUser || 'Karyakarta',
            item.auditReason || `Edited collection ${origReceiptNo}`
          ]
        });

        return res.status(200).json({
          success: true,
          action: 'editCollection',
          receiptNo: newReceiptNo,
          message: `Collection ${origReceiptNo} updated in Turso.`
        });
      }

      // ==========================================
      // 6. DELETE COLLECTION (रसीद सॉफ्ट-डिलीट)
      // ==========================================
      case 'deleteCollection': {
        const targetReceiptNo = parseStr(item.targetReceiptNo || item.receiptNo);
        if (!targetReceiptNo) {
          return res.status(400).json({ success: false, error: 'targetReceiptNo is required for deleteCollection.' });
        }

        const current = await db.execute({
          sql: 'SELECT * FROM collections WHERE receipt_no = ?',
          args: [targetReceiptNo]
        });

        if (current.rows.length === 0) {
          return res.status(404).json({ success: false, error: `Collection ${targetReceiptNo} not found in Turso.` });
        }

        const currRow = current.rows[0];

        // Archive into deleted_archive
        await db.execute({
          sql: `INSERT INTO deleted_archive (
                  deleted_at, type, ref_id, donor_name, city, amount, 
                  deleted_by, karyakarta_name, details, raw_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            nowIso, 'Collection', targetReceiptNo, currRow.donor_name, currRow.city, parseNum(currRow.amount),
            item.auditUser || 'Karyakarta', item.auditUser || 'Karyakarta',
            item.auditReason || 'Soft deleted from portal',
            JSON.stringify(currRow)
          ]
        });

        // Delete from active collections table
        await db.execute({
          sql: 'DELETE FROM collections WHERE id = ?',
          args: [currRow.id]
        });

        // If donor was linked, adjust declaration deposited and balance
        if (currRow.donor_sno) {
          const declCheck = await db.execute({
            sql: 'SELECT id, deposited, amount, receipt FROM declarations WHERE sno = ?',
            args: [currRow.donor_sno]
          });
          if (declCheck.rows.length > 0) {
            const d = declCheck.rows[0];
            const newDeposited = Math.max(0, parseNum(d.deposited) - parseNum(currRow.amount));
            const newBalance = parseNum(d.amount) - newDeposited;
            const existingReceipts = parseStr(d.receipt);
            const receiptList = existingReceipts
              ? existingReceipts.split(',').map(s => s.trim()).filter(r => r !== targetReceiptNo)
              : [];
            const updatedReceiptStr = receiptList.join(', ') || '-';

            await db.execute({
              sql: 'UPDATE declarations SET deposited = ?, balance = ?, receipt = ? WHERE id = ?',
              args: [newDeposited, newBalance, updatedReceiptStr, d.id]
            });
          }
        }

        return res.status(200).json({
          success: true,
          action: 'deleteCollection',
          receiptNo: targetReceiptNo,
          message: `Collection ${targetReceiptNo} archived and removed from Turso.`
        });
      }

      default:
        return res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
    }
  } catch (err) {
    console.error(`Error processing Turso transaction (${action}):`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
