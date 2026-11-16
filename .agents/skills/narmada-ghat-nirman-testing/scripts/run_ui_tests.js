/**
 * Comprehensive Automated UI Test Suite
 * Narmada Ghat Nirman (Koteshwar Tirtha) Dashboard
 * 
 * Validates DOM integrity, UI forms, navigation tabs, modal dialogs,
 * data tables, filter controls, responsive layout elements, and event hooks
 * for both karyakarta.html (Field Portal) and index.html (Public Transparency Portal).
 */

const fs = require('fs');
const path = require('path');

function findHtmlFile(filename) {
  const candidates = [
    path.join(__dirname, '..', '..', '..', '..', 'koteshwar-ghat-nirman', filename),
    path.join(__dirname, '..', '..', '..', filename),
    path.join(__dirname, '..', '..', filename),
    path.join(process.cwd(), 'koteshwar-ghat-nirman', filename),
    path.join(process.cwd(), filename)
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const KARYAKARTA_HTML_PATH = findHtmlFile('karyakarta.html');
const INDEX_HTML_PATH = findHtmlFile('index.html');

function runUITests() {
  console.log("============================================================");
  console.log(" 🖥️  Narmada Ghat Nirman - Automated UI Test Suite");
  console.log("============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(title, condition, extraInfo = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${extraInfo ? '-> ' + extraInfo : ''}`);
      failed++;
    }
  }

  // --- 1. File Existence & Load Check ---
  console.log("1. HTML Asset Integrity:");
  const karyakartaExists = Boolean(KARYAKARTA_HTML_PATH && fs.existsSync(KARYAKARTA_HTML_PATH));
  const indexExists = Boolean(INDEX_HTML_PATH && fs.existsSync(INDEX_HTML_PATH));
  assert("karyakarta.html exists", karyakartaExists);
  assert("index.html exists", indexExists);

  if (!karyakartaExists || !indexExists) {
    console.error("Critical HTML files missing. Aborting UI tests.");
    return { passed, failed: failed + 1 };
  }

  const kHtml = fs.readFileSync(KARYAKARTA_HTML_PATH, 'utf8');
  const iHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // --- 2. Karyakarta Portal - Mobile Viewport & Responsiveness ---
  console.log("\n2. Responsive Layout & Meta Tags (karyakarta.html):");
  assert("Viewport meta tag configured", kHtml.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0'));
  assert("UTF-8 charset declared", /<meta\s+charset=["']utf-8["']/i.test(kHtml));
  assert("Responsive table wrapper class present", kHtml.includes('table-responsive') || kHtml.includes('overflow-x:auto') || kHtml.includes('overflow-x: auto'));
  assert("Modal backdrop styling present", kHtml.includes('.modal-backdrop') && kHtml.includes('position: fixed'));

  // --- 3. Karyakarta Portal - Navigation Tabs ---
  console.log("\n3. Navigation & Section Tabs (karyakarta.html):");
  const navTabs = [
    { target: 'new-declaration', label: 'नई घोषणा (New Declaration)' },
    { target: 'new-collection', label: 'धन प्राप्ति / रसीद (Collection Receipt)' },
    { target: 'declarations-ledger', label: 'घोषणा सूची (Declarations Ledger)' },
    { target: 'collections-ledger', label: 'संग्रह सूची (Collections Ledger)' },
    { target: 'pending-list', label: 'लंबित वसूली (Pending Ledger)' },
    { target: 'settings-sync', label: 'डेटा सिंक व सेटिंग्स (Settings & Sync)' }
  ];
  navTabs.forEach(t => {
    assert(`Navigation tab trigger for '${t.target}' (${t.label}) present`, 
      kHtml.includes(`switchPortalTab('${t.target}'`));
    assert(`Workspace pane #pane-${t.target} container present`, 
      kHtml.includes(`id="pane-${t.target}"`));
  });

  // --- 4. Karyakarta Portal - New Declaration Form Controls ---
  console.log("\n4. New Declaration Form Controls (karyakarta.html):");
  const declFormControls = [
    { id: 'declName', label: 'Donor Name' },
    { id: 'declVillageSelect', label: 'Village Dropdown' },
    { id: 'declVillageQuickSearch', label: 'Village Quick Search' },
    { id: 'declNewVillageInput', label: 'Add Custom Village Input' },
    { id: 'declAmount', label: 'Declared Amount' },
    { id: 'declReceiptNo', label: 'Declaration Receipt Number' },
    { id: 'declMobile', label: 'Mobile Number' },
    { id: 'declDate', label: 'Declaration Date' },
    { id: 'declNotes', label: 'Notes / Family Details' },
    { id: 'chkDeclReceiveNow', label: 'Immediate Collection Checkbox' }
  ];
  declFormControls.forEach(ctrl => {
    assert(`Declaration input #${ctrl.id} (${ctrl.label}) present`, kHtml.includes(`id="${ctrl.id}"`));
  });

  // Immediate collection conditional fields
  console.log("\n5. Immediate Collection Sub-Form Controls (karyakarta.html):");
  const immCollControls = [
    { id: 'declReceiptSection', label: 'Immediate Receipt Container' },
    { id: 'declCollReceiptNo', label: 'Collection Receipt Number' },
    { id: 'declReceivedAmt', label: 'Received Amount' },
    { id: 'declPaymentMode', label: 'Payment Mode Dropdown' },
    { id: 'declRefNo', label: 'Reference / UTR / Cheque Number' },
    { id: 'declReceiptRemarks', label: 'Receipt Remarks' }
  ];
  immCollControls.forEach(ctrl => {
    assert(`Immediate collection field #${ctrl.id} (${ctrl.label}) present`, kHtml.includes(`id="${ctrl.id}"`));
  });

  // --- 6. Direct Collection Form Controls ---
  console.log("\n6. Direct Collection Form Controls (karyakarta.html):");
  const directCollControls = [
    { id: 'donorSearchInput', label: 'Donor Search Lookup Input' },
    { id: 'donorSuggestionsBox', label: 'Donor Suggestions Dropdown Container' },
    { id: 'selectedDonorBanner', label: 'Selected Donor Status Preview Banner' },
    { id: 'collReceiptNo', label: 'Collection Receipt No' },
    { id: 'collAmount', label: 'Collection Amount' },
    { id: 'collPaymentMode', label: 'Payment Mode' },
    { id: 'collDate', label: 'Payment Date' },
    { id: 'collRefNo', label: 'Ref / UTR' },
    { id: 'collRemarks', label: 'Collection Remarks' }
  ];
  directCollControls.forEach(ctrl => {
    assert(`Direct collection input #${ctrl.id} (${ctrl.label}) present`, kHtml.includes(`id="${ctrl.id}"`));
  });

  // --- 7. Modals & Dialogs Structure ---
  console.log("\n7. Modal Dialogs & Overlay Structures (karyakarta.html):");
  const modals = [
    { id: 'authOverlay', label: 'PIN Authentication Overlay' },
    { id: 'editDeclModalBackdrop', label: 'Edit Declaration Modal' },
    { id: 'editCollModalBackdrop', label: 'Edit Collection Modal' },
    { id: 'receiptModalBackdrop', label: 'Printable Receipt Modal' }
  ];
  modals.forEach(m => {
    assert(`Modal overlay #${m.id} (${m.label}) present`, kHtml.includes(`id="${m.id}"`));
  });

  // Check PIN login elements
  assert("Auth User selector present", kHtml.includes('id="authUsernameSelect"'));
  assert("Auth PIN input present", kHtml.includes('id="authPinInput"'));
  assert("Auth submit button present", kHtml.includes('class="btn-auth-unlock"'));

  // --- 8. Edit Modals Field Verification ---
  console.log("\n8. Edit Modals Field Verification (karyakarta.html):");
  const editDeclFields = ['editDeclSno', 'editDeclName', 'editDeclCity', 'editDeclAmount', 'editDeclReceipt', 'editDeclDate', 'editDeclMobile', 'editDeclNotes'];
  editDeclFields.forEach(f => {
    assert(`Edit Declaration field #${f} present`, kHtml.includes(`id="${f}"`));
  });

  const editCollFields = ['editCollOrigReceiptNo', 'editCollReceiptNo', 'editCollDonorName', 'editCollCity', 'editCollAmount', 'editCollPaymentMode', 'editCollDate', 'editCollRefNo', 'editCollRemarks'];
  editCollFields.forEach(f => {
    assert(`Edit Collection field #${f} present`, kHtml.includes(`id="${f}"`));
  });

  // --- 9. Search, Filter & Export Controls ---
  console.log("\n9. Search, Filter & Export Buttons (karyakarta.html):");
  assert("Declaration Village Filter present", kHtml.includes('id="filterDeclVillage"'));
  assert("Declaration Search Input present", kHtml.includes('id="searchDeclTable"'));
  assert("Declaration CSV Export button present", kHtml.includes('exportDeclarationsCSV()'));

  assert("Collection Search Input present", kHtml.includes('id="searchCollTable"'));
  assert("Collection Karyakarta Filter present", kHtml.includes('id="filterCollKaryakarta"'));
  assert("Collection CSV Export button present", kHtml.includes('exportCollectionsCSV()'));

  assert("Pending Village Filter present", kHtml.includes('id="filterPendingVillage"'));
  assert("Pending Date Filter present", kHtml.includes('id="filterPendingDate"'));
  assert("Pending Amount Filter present", kHtml.includes('id="filterPendingAmount"'));
  assert("Pending Search Input present", kHtml.includes('id="searchPendingTable"'));
  assert("Pending CSV Export button present", kHtml.includes('exportPendingCSV()'));

  // --- 10. Settings & Sync Controls ---
  console.log("\n10. Settings, Sync & Backup Controls (karyakarta.html):");
  assert("Webhook URL input present", kHtml.includes('id="webhookUrlInput"'));
  assert("Webhook Save button present", kHtml.includes('saveWebhookUrl()'));
  assert("Webhook Test button present", kHtml.includes('testWebhookConnection()'));
  assert("Full JSON Backup button present", kHtml.includes('downloadAllDataJSON()'));
  assert("Force Re-sync button present", kHtml.includes('refreshPortalData(true)'));
  assert("Clear Local Cache button present", kHtml.includes('clearLocalAppCache()'));

  // --- 11. Public Transparency Portal (index.html) ---
  console.log("\n11. Public Transparency Portal Components (index.html):");
  assert("Public Page Title contains Narmada Ghat Nirman", iHtml.includes('माँ नर्मदा घाट निर्माण सेवा महाअभियान | कोटेश्वर तीर्थ (कोठड़ा)'));
  assert("Organization heading present", iHtml.includes('कोटेश्वर नर्मदा बहुउद्देशीय सेवा संस्थान'));
  assert("Total Declared Stat Card present", iHtml.includes('कुल घोषित जनसहयोग') || iHtml.includes('progLegPledged'));
  assert("Total Received Stat Card present", iHtml.includes('कुल प्राप्त जनसहयोग') || iHtml.includes('progLegReceived'));
  assert("Pending Stat Card present", iHtml.includes('प्राप्त होना शेष') || iHtml.includes('progLegPending'));
  assert("Donors Stat Card present", iHtml.includes('दानदाता परिवार संख्या'));
  assert("Koteshwar Legacy Storytelling Section present", iHtml.includes('id="koteshwarLegacyStory"'));
  assert("Developer Contact & WhatsApp pill present", iHtml.includes('dev-btn-whatsapp') && iHtml.includes('9131076286'));

  // --- 12. Security & Anti-Leakage Audit ---
  console.log("\n12. UI Data Security & Privacy Safeguards:");
  assert("Public index.html does NOT expose karyakarta login PINs", !iHtml.includes('narmadehar2026') && !iHtml.includes('कोटेश्वर2026'));
  assert("Public index.html does NOT expose webhook write action definitions", !iHtml.includes('addDeclaration') && !iHtml.includes('deleteDeclaration'));
  assert("Karyakarta Portal uses confirmation dialog on delete actions", kHtml.includes('confirmDeleteDeclaration') && kHtml.includes('confirmDeleteCollection'));

  console.log("\n============================================================");
  console.log(` 🏁 UI Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log("============================================================\n");

  return { passed, failed };
}

if (require.main === module) {
  const result = runUITests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = { runUITests };
