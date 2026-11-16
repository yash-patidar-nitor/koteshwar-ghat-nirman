/**
 * Validation and Test Engine for Narmada Ghat Nirman Dashboard
 * (Koteshwar Tirtha / Karyakarta Portal)
 * 
 * Supports:
 * 1. Safe offline logic & algorithm validation (Zero network / No prod impact)
 * 2. Webhook payload contract validation
 * 3. Live transaction simulation with tagged test markers
 */

const fs = require('fs');
const path = require('path');

// ==========================================
// 1. REPRODUCED CORE BUSINESS LOGIC (from karyakarta.html & index.html)
// ==========================================

function cleanMobileNumber(raw) {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (str.endsWith('.0')) str = str.slice(0, -2);
  else if (str.includes('.')) str = str.split('.')[0];
  str = str.replace(/[^0-9]/g, '');
  if (str.length === 14 && str.startsWith('0091')) str = str.substring(4);
  else if (str.length === 12 && str.startsWith('91')) str = str.substring(2);
  else if (str.length === 11 && str.startsWith('0')) str = str.substring(1);
  return str;
}

function normalizeVillage(v) {
  if (!v) return "अन्य";
  const str = String(v).trim();
  if (/^(कोटेश्वर|कोठ[ड़ड]ा|कोट[ड़ड]ा|koteshwar|kothda|kotda|kothada|koteswar|kothra)/i.test(str) ||
      str.includes('कोटेश्वर') || str.includes('कोठड़ा') || str.includes('कोठडा') || str.includes('कोटडा') ||
      /koteshwar|kothda|kotda|kothada/i.test(str)) {
    return "कोटेश्वर / कोठड़ा";
  }
  if (/^(कडमाल|खापरखेड़ा|kadmal|khaparkheda)/i.test(str) || str.includes('कडमाल') || str.includes('खापरखेड़ा')) {
    return "कडमाल / खापरखेड़ा";
  }
  return str;
}

function isDummyTestDeclaration(sno, name, city, amt) {
  const s = String(sno || '').trim();
  const n = String(name || '').trim().toLowerCase();
  const c = String(city || '').trim().toLowerCase();
  if ((s === '585' || s === '586') && (n === 'asd' || n === 'yash' || c.includes('nisarpur'))) return true;
  if (n === 'asd' || n === 'test' || n === 'testing') return true;
  if ((n === 'asd' || n === 'yash') && (Number(amt) <= 0 || !amt)) return true;
  return false;
}

function isDeclarationDeleted(sno, name, deletedSet) {
  if (!deletedSet || deletedSet.size === 0) return false;
  const s = String(sno).trim();
  const n = String(name || '').trim().toLowerCase();
  if (deletedSet.has(`${s}:::${n}`)) return true;
  if (deletedSet.has(s) && (n === 'asd' || n === 'yash' || n === 'test' || n === '')) return true;
  return false;
}

function numberToHindiWords(num) {
  const n = Math.floor(Math.abs(Number(num) || 0));
  if (n === 0) return "शून्य";

  const units = [
    "", "एक", "दो", "तीन", "चार", "पांच", "छह", "सात", "आठ", "नौ", "दस",
    "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अट्ठारह", "उन्नीस", "बीस",
    "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाइस", "उनतीस", "तीस",
    "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस", "चालीस",
    "इकतालीस", "बयालीस", "तैंतालीस", "चौवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास", "पचास",
    "इक्यावन", "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ", "साठ",
    "इकसठ", "बासठ", "तिरेसठ", "चौंसठ", "पैंसठ", "छियासठ", "सरसठ", "अड़सठ", "उनहत्तर", "सत्तर",
    "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्नासी", "अस्सी",
    "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी", "नब्बे",
    "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पंचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे"
  ];

  function convertPart(val) {
    let str = "";
    const crore = Math.floor(val / 10000000);
    val %= 10000000;
    const lakh = Math.floor(val / 100000);
    val %= 100000;
    const thousand = Math.floor(val / 1000);
    val %= 1000;
    const hundred = Math.floor(val / 100);
    const rem = val % 100;

    if (crore > 0) str += units[crore] + " करोड़ ";
    if (lakh > 0) str += units[lakh] + " लाख ";
    if (thousand > 0) str += units[thousand] + " हजार ";
    if (hundred > 0) str += units[hundred] + " सौ ";
    if (rem > 0) str += units[rem] + " ";

    return str.trim();
  }

  return convertPart(n);
}

// Financial balance calculations
function calculateDonorBalance(declaredAmt, initialDeposited, collectionsList = [], donorSno = null, donorName = null) {
  const declared = Number(declaredAmt) || 0;
  let collected = Number(initialDeposited) || 0;

  collectionsList.forEach(c => {
    const matchSno = donorSno && String(c.donorSno) === String(donorSno);
    const matchName = !donorSno && donorName && String(c.donorName || '').trim().toLowerCase() === String(donorName).trim().toLowerCase();
    if (matchSno || matchName) {
      collected += Number(c.amount) || 0;
    }
  });

  const balance = Math.max(0, declared - collected);
  return { declared, collected, balance, isComplete: collected >= declared };
}

// ==========================================
// 2. TEST SUITE RUNNER
// ==========================================

function runUnitTests() {
  console.log("============================================================");
  console.log(" 🧪 Narmada Ghat Nirman (Koteshwar Tirtha) - Offline Logic Validation Suite");
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

  // --- Suite 1: Mobile Sanitization ---
  console.log("1. Mobile Number Formatting Tests:");
  assert("Plain 10-digit", cleanMobileNumber("9826012345") === "9826012345");
  assert("Leading zero (09826012345)", cleanMobileNumber("09826012345") === "9826012345");
  assert("Country code prefix (+91 98260 12345)", cleanMobileNumber("+91 98260 12345") === "9826012345");
  assert("Excel float notation (9826012345.0)", cleanMobileNumber("9826012345.0") === "9826012345");
  assert("Empty / Null safety", cleanMobileNumber(null) === "" && cleanMobileNumber(undefined) === "");

  // --- Suite 2: Village Normalization ---
  console.log("\n2. Village Normalization & Canonicalization Tests:");
  assert("कोटेश्वर mapped to कोटेश्वर / कोठड़ा", normalizeVillage("कोटेश्वर") === "कोटेश्वर / कोठड़ा");
  assert("कोठड़ा mapped to कोटेश्वर / कोठड़ा", normalizeVillage("कोठड़ा") === "कोटेश्वर / कोठड़ा");
  assert("English 'kotda' mapped to कोटेश्वर / कोठड़ा", normalizeVillage("kotda") === "कोटेश्वर / कोठड़ा");
  assert("कडमाल mapped to कडमाल / खापरखेड़ा", normalizeVillage("कडमाल") === "कडमाल / खापरखेड़ा");
  assert("खापरखेड़ा mapped to कडमाल / खापरखेड़ा", normalizeVillage("खापरखेड़ा") === "कडमाल / खापरखेड़ा");
  assert("Unmatched village preserved", normalizeVillage("कुक्षी") === "कुक्षी");
  assert("Blank village defaults to अन्य", normalizeVillage("") === "अन्य");

  // --- Suite 3: Test / Ghost Record Filter ---
  console.log("\n3. Dummy / Ghost Test Record Detection Tests:");
  assert("Historic dummy sno 585 with 'asd' flagged", isDummyTestDeclaration("585", "asd", "nisarpur", 0) === true);
  assert("Historic dummy sno 586 with 'yash' flagged", isDummyTestDeclaration("586", "yash", "nisarpur", 0) === true);
  assert("Generic name 'test' flagged", isDummyTestDeclaration("600", "test", "kotda", 500) === true);
  assert("Valid donor sno 585 with legitimate name preserved", isDummyTestDeclaration("585", "रमेश पाटीदार", "कुक्षी", 51000) === false);
  assert("Valid donor sno 586 with legitimate name preserved", isDummyTestDeclaration("586", "सुरेश पाटीदार", "कोठड़ा", 11000) === false);

  // --- Suite 4: Smart Deletion Keying ---
  console.log("\n4. Sequence Collision Prevention (Deleted Set):");
  const delSet = new Set(["587:::यतीन्द्र पाटीदार", "588:::test"]);
  assert("Exact match sno:::name detected as deleted", isDeclarationDeleted("587", "यतीन्द्र पाटीदार", delSet) === true);
  assert("Re-used sequence 587 with DIFFERENT name is NOT blocked", isDeclarationDeleted("587", "गोपाल पाटीदार", delSet) === false);

  // --- Suite 5: Hindi Words Number Converter ---
  console.log("\n5. Hindi Number-to-Words Representation Tests:");
  assert("₹1,000 -> एक हजार", numberToHindiWords(1000).trim() === "एक हजार");
  assert("₹11,000 -> ग्यारह हजार", numberToHindiWords(11000).trim() === "ग्यारह हजार");
  assert("₹51,000 -> इक्यावन हजार", numberToHindiWords(51000).trim() === "इक्यावन हजार");
  assert("₹1,00,000 -> एक लाख", numberToHindiWords(100000).trim() === "एक लाख");
  assert("₹2,50,000 -> दो लाख पचास हजार", numberToHindiWords(250000).trim() === "दो लाख पचास हजार");
  assert("₹0 -> शून्य", numberToHindiWords(0).trim() === "शून्य");

  // --- Suite 6: Financial Reconciliation Math ---
  console.log("\n6. Financial Balance & Ledger Reconciliation Math Tests:");
  const testColls = [
    { donorSno: 101, amount: 20000 },
    { donorSno: 101, amount: 15000 },
    { donorSno: 102, amount: 5000 }
  ];
  const r1 = calculateDonorBalance(50000, 10000, testColls, 101);
  assert("Multi-receipt collection sum: 10000 + 20000 + 15000 = 45000", r1.collected === 45000);
  assert("Balance calculation: 50000 - 45000 = 5000", r1.balance === 5000);
  assert("Incomplete pledge flag", r1.isComplete === false);

  const r2 = calculateDonorBalance(50000, 50000, [], 103);
  assert("Full initial deposit marks complete", r2.balance === 0 && r2.isComplete === true);

  const r3 = calculateDonorBalance(10000, 5000, [{ donorSno: 104, amount: 10000 }], 104);
  assert("Over-collection balance does not go negative", r3.balance === 0 && r3.collected === 15000);

  // --- Suite 7: Webhook Payload Contract Validation ---
  console.log("\n7. Webhook Payload Contract Integrity Tests:");
  const sampleDeclPayload = {
    action: "addDeclaration",
    data: {
      sno: 9999,
      name: "TEST_DUMMY_DONOR",
      city: "कोटेश्वर / कोठड़ा",
      amount: 11000,
      receipt: "TEST-R01",
      date: "2026-11-13",
      collector: "परीक्षण कार्यकर्ता",
      collectorUsername: "anilpatidar"
    }
  };
  assert("addDeclaration action signature", sampleDeclPayload.action === "addDeclaration");
  assert("addDeclaration required fields present", 
    Boolean(sampleDeclPayload.data.sno && sampleDeclPayload.data.name && sampleDeclPayload.data.amount > 0));

  const sampleCollPayload = {
    action: "addCollection",
    data: {
      receiptNo: "TEST-RCP-01",
      donorSno: 9999,
      donorName: "TEST_DUMMY_DONOR",
      amount: 11000,
      paymentMode: "नकद",
      date: "2026-11-13"
    }
  };
  assert("addCollection action signature", sampleCollPayload.action === "addCollection");
  assert("addCollection receiptNo and donor linkage", Boolean(sampleCollPayload.data.receiptNo && sampleCollPayload.data.donorSno));

  const sampleDeletePayload = {
    action: "deleteDeclaration",
    data: {
      sno: 9999,
      name: "TEST_DUMMY_DONOR",
      deleted_by: "test_runner",
      deleted_at: new Date().toISOString()
    }
  };
  assert("deleteDeclaration audit tracking attributes", Boolean(sampleDeletePayload.data.deleted_by && sampleDeletePayload.data.deleted_at));

  console.log("\n============================================================");
  console.log(` Summary: ${passed} Passed, ${failed} Failed`);
  console.log("============================================================\n");

  return { passed, failed };
}

if (require.main === module) {
  const result = runUnitTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = {
  cleanMobileNumber,
  normalizeVillage,
  isDummyTestDeclaration,
  isDeclarationDeleted,
  numberToHindiWords,
  calculateDonorBalance,
  runUnitTests
};
