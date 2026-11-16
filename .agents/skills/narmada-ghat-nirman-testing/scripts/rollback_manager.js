/**
 * Rollback Manager for Narmada Ghat Nirman Dashboard
 * (Koteshwar Tirtha / Karyakarta Portal)
 * 
 * Safely removes and purges test transactions from:
 * 1. Google Apps Script Webhook (Live Soft Delete -> moves to Deleted Archive)
 * 2. Google Sheet Tabs (generates physical purge Apps Script function)
 * 3. Client LocalStorage (generates DevTools console cleanup snippet)
 */

const fs = require('fs');

/**
 * Prefix and signature used to distinguish test transactions from production data
 */
const TEST_SIGNATURES = {
  namePrefix: "TEST_QA_",
  receiptPrefix: "TEST-RCP-",
  testUsers: ["test_runner", "qa_tester"]
};

/**
 * Generates an executable Google Apps Script function to completely purge
 * test rows from all tabs in the production Google Spreadsheet.
 */
function generateAppsScriptPurgeCode(testSnoList = [], testReceiptList = []) {
  return `/**
 * ==============================================================================
 * KOTESHWAR GHAT NIRMAN - PRODUCTION DATA ROLLBACK MACRO
 * Run this in Google Apps Script (Extensions > Apps Script) to permanently remove
 * test transactions created during QA testing.
 * ==============================================================================
 */

function purgeTestTransactionsFromProduction() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var testSnos = ${JSON.stringify(testSnoList.map(String))};
  var testReceipts = ${JSON.stringify(testReceiptList.map(String))};
  var namePrefix = "TEST_QA_";

  Logger.log("=== STARTING TEST ROLLBACK PURGE ===");

  // 1. Purge from 'Live Declaration'
  var liveDeclSheet = ss.getSheetByName("Live Declaration");
  var purgedDeclCount = 0;
  if (liveDeclSheet) {
    var data = liveDeclSheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      var rowSno = String(data[i][0]).trim();
      var rowName = String(data[i][1] || '').trim();
      if (testSnos.indexOf(rowSno) !== -1 || rowName.indexOf(namePrefix) === 0 || rowName.toLowerCase() === 'test') {
        Logger.log("Deleting Live Declaration row " + (i + 1) + ": Sno=" + rowSno + ", Name=" + rowName);
        liveDeclSheet.deleteRow(i + 1);
        purgedDeclCount++;
      }
    }
  }

  // 2. Purge from 'Live Collection'
  var liveCollSheet = ss.getSheetByName("Live Collection");
  var purgedCollCount = 0;
  if (liveCollSheet) {
    var cData = liveCollSheet.getDataRange().getValues();
    for (var j = cData.length - 1; j >= 1; j--) {
      var rNo = String(cData[j][1]).trim();
      var dName = String(cData[j][3] || '').trim();
      if (testReceipts.indexOf(rNo) !== -1 || rNo.indexOf("TEST-") === 0 || dName.indexOf(namePrefix) === 0) {
        Logger.log("Deleting Live Collection row " + (j + 1) + ": Receipt=" + rNo + ", Name=" + dName);
        liveCollSheet.deleteRow(j + 1);
        purgedCollCount++;
      }
    }
  }

  // 3. Purge from 'Deleted Archive' (Remove soft-deleted test entries)
  var archiveSheet = ss.getSheetByName("Deleted Archive");
  var purgedArchiveCount = 0;
  if (archiveSheet) {
    var aData = archiveSheet.getDataRange().getValues();
    for (var k = aData.length - 1; k >= 1; k--) {
      var aId = String(aData[k][2]).trim();
      var aName = String(aData[k][3] || '').trim();
      if (testSnos.indexOf(aId) !== -1 || testReceipts.indexOf(aId) !== -1 || aName.indexOf(namePrefix) === 0 || aName.toLowerCase() === 'test') {
        Logger.log("Deleting Archive row " + (k + 1) + ": ID=" + aId + ", Name=" + aName);
        archiveSheet.deleteRow(k + 1);
        purgedArchiveCount++;
      }
    }
  }

  // 4. Purge from 'Audit Log' (Remove audit entries for test transactions)
  var auditSheet = ss.getSheetByName("Audit Log");
  var purgedAuditCount = 0;
  if (auditSheet) {
    var uData = auditSheet.getDataRange().getValues();
    for (var m = uData.length - 1; m >= 1; m--) {
      var uId = String(uData[m][2]).trim();
      var uName = String(uData[m][3] || '').trim();
      if (testSnos.indexOf(uId) !== -1 || testReceipts.indexOf(uId) !== -1 || uName.indexOf(namePrefix) === 0) {
        Logger.log("Deleting Audit row " + (m + 1) + ": ID=" + uId + ", Name=" + uName);
        auditSheet.deleteRow(m + 1);
        purgedAuditCount++;
      }
    }
  }

  Logger.log("=== ROLLBACK PURGE COMPLETE ===");
  Logger.log("Declarations Removed: " + purgedDeclCount);
  Logger.log("Collections Removed: " + purgedCollCount);
  Logger.log("Archive Entries Cleaned: " + purgedArchiveCount);
  Logger.log("Audit Entries Cleaned: " + purgedAuditCount);
}
`;
}

/**
 * Generates browser console script to purge test transactions from localStorage on client browsers
 */
function generateBrowserConsolePurgeScript(testSnoList = [], testReceiptList = []) {
  return `/* Copy and paste this snippet into the Browser DevTools Console on the Karyakarta Portal */
(function rollbackClientLocalStorage() {
  console.log("🧹 Commencing Client LocalStorage Rollback...");

  const testSnos = new Set(${JSON.stringify(testSnoList.map(String))});
  const testReceipts = new Set(${JSON.stringify(testReceiptList.map(String))});
  const isTest = (sno, name, rcpt) => {
    if (testSnos.has(String(sno))) return true;
    if (testReceipts.has(String(rcpt))) return true;
    if (String(name || '').startsWith("TEST_QA_")) return true;
    if (String(rcpt || '').startsWith("TEST-")) return true;
    return false;
  };

  // 1. Clean custom declarations
  try {
    let decls = JSON.parse(localStorage.getItem('koteshwar_custom_declarations') || '[]');
    const beforeDecl = decls.length;
    decls = decls.filter(d => !isTest(d.sno, d.name, d.receipt));
    localStorage.setItem('koteshwar_custom_declarations', JSON.stringify(decls));
    console.log("Custom Declarations cleaned:", beforeDecl - decls.length, "removed.");
  } catch (e) { console.error(e); }

  // 2. Clean custom collections
  try {
    let colls = JSON.parse(localStorage.getItem('koteshwar_custom_collections') || '[]');
    const beforeColl = colls.length;
    colls = colls.filter(c => !isTest(c.donorSno, c.donorName, c.receiptNo));
    localStorage.setItem('koteshwar_custom_collections', JSON.stringify(colls));
    console.log("Custom Collections cleaned:", beforeColl - colls.length, "removed.");
  } catch (e) { console.error(e); }

  // 3. Clean edited cache maps
  try {
    let editedDecls = JSON.parse(localStorage.getItem('koteshwar_edited_declarations') || '{}');
    Object.keys(editedDecls).forEach(k => { if (testSnos.has(String(k))) delete editedDecls[k]; });
    localStorage.setItem('koteshwar_edited_declarations', JSON.stringify(editedDecls));

    let editedColls = JSON.parse(localStorage.getItem('koteshwar_edited_collections') || '{}');
    Object.keys(editedColls).forEach(k => { if (testReceipts.has(String(k)) || k.startsWith("TEST-")) delete editedColls[k]; });
    localStorage.setItem('koteshwar_edited_collections', JSON.stringify(editedColls));
  } catch (e) { console.error(e); }

  // 4. Purge cached lists & trigger force refresh
  localStorage.removeItem('koteshwar_declarations_cache');
  localStorage.removeItem('koteshwar_collections_ledger');
  console.log("✅ LocalStorage cache cleared. Triggering sheet reload...");

  if (typeof refreshPortalData === 'function') {
    refreshPortalData(true);
  } else {
    window.location.reload();
  }
})();
`;
}

/**
 * Dispatches automated webhook rollback calls for specific test records
 */
async function executeWebhookRollback(webhookUrl, testDeclarations = [], testCollections = []) {
  if (!webhookUrl) {
    throw new Error("Webhook URL is required to execute automated webhook rollback.");
  }

  const results = {
    declarationsRolledBack: 0,
    collectionsRolledBack: 0,
    errors: []
  };

  console.log(`\n🔄 Dispatching Soft-Delete Webhook Rollback to: ${webhookUrl}`);

  // Rollback Declarations
  for (const decl of testDeclarations) {
    try {
      const payload = {
        action: "deleteDeclaration",
        data: {
          sno: decl.sno,
          name: decl.name,
          city: decl.city || "अन्य",
          amount: decl.amount || 0,
          deleted_by: "qa_test_rollback",
          deleted_by_name: "Automated QA Rollback Engine",
          deleted_at: new Date().toISOString()
        }
      };

      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({ status: 'unknown' }));
      console.log(`  🗑️ Rolled back Declaration #${decl.sno} (${decl.name}):`, data.status || 'OK');
      results.declarationsRolledBack++;
    } catch (err) {
      console.error(`  ❌ Failed to rollback Declaration #${decl.sno}:`, err.message);
      results.errors.push({ target: `Declaration #${decl.sno}`, error: err.message });
    }
  }

  // Rollback Collections
  for (const coll of testCollections) {
    try {
      const payload = {
        action: "deleteCollection",
        data: {
          receiptNo: coll.receiptNo,
          donorName: coll.donorName,
          donorSno: coll.donorSno,
          city: coll.city || "",
          amount: coll.amount || 0,
          deleted_by: "qa_test_rollback",
          deleted_by_name: "Automated QA Rollback Engine",
          deleted_at: new Date().toISOString()
        }
      };

      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({ status: 'unknown' }));
      console.log(`  🗑️ Rolled back Collection Receipt ${coll.receiptNo}:`, data.status || 'OK');
      results.collectionsRolledBack++;
    } catch (err) {
      console.error(`  ❌ Failed to rollback Collection ${coll.receiptNo}:`, err.message);
      results.errors.push({ target: `Collection ${coll.receiptNo}`, error: err.message });
    }
  }

  return results;
}

// CLI / Standalone execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const action = args[0] || 'help';

  if (action === 'generate-macro') {
    const snos = args[1] ? args[1].split(',') : ['99991', '99992'];
    const receipts = args[2] ? args[2].split(',') : ['TEST-RCP-01', 'TEST-RCP-02'];
    console.log(generateAppsScriptPurgeCode(snos, receipts));
  } else if (action === 'generate-console') {
    const snos = args[1] ? args[1].split(',') : ['99991', '99992'];
    const receipts = args[2] ? args[2].split(',') : ['TEST-RCP-01', 'TEST-RCP-02'];
    console.log(generateBrowserConsolePurgeScript(snos, receipts));
  } else {
    console.log(`
Narmada Ghat Nirman - Rollback Manager CLI
Usage:
  node rollback_manager.js generate-macro <comma_separated_snos> <comma_separated_receipts>
  node rollback_manager.js generate-console <comma_separated_snos> <comma_separated_receipts>

Example:
  node rollback_manager.js generate-macro 99991,99992 TEST-RCP-01
`);
  }
}

module.exports = {
  TEST_SIGNATURES,
  generateAppsScriptPurgeCode,
  generateBrowserConsolePurgeScript,
  executeWebhookRollback
};
