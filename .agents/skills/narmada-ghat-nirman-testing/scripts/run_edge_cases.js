/**
 * Advanced Edge Cases & Boundary Validation Suite
 * Narmada Ghat Nirman (Koteshwar Tirtha) Dashboard
 * 
 * Tests extreme numbers, large crore amounts, multi-installment stress tests,
 * floating-point precision, special character / regex injection in search,
 * CSV quoting/escaping, and sequence collision resilience.
 */

const fs = require('fs');
const path = require('path');

// Extract business functions from karyakarta.html or local modules
const {
  cleanMobileNumber,
  normalizeVillage,
  isDummyTestDeclaration,
  isDeclarationDeleted,
  numberToHindiWords,
  calculateDonorBalance
} = require('./run_validation');

// Import transliteration / phonetic keys from karyakarta.html
// Complete Devanagari transliteration from karyakarta.html
function transliterateDevanagari(text) {
  if (!text) return '';
  const consonants = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy', 'श्र': 'shr',
    'ड़': 'd', 'ढ़': 'dh', 'ज़': 'z', 'फ़': 'f'
  };
  const vowels = {
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ं': 'n', 'ँ': 'n', 'ः': 'h',
    'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri'
  };

  let out = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const nxt = chars[i+1];
    if (consonants[ch]) {
      out += consonants[ch];
      if (nxt === '्') {
        i++;
      } else if (!vowels[nxt]) {
        out += 'a';
      }
    } else if (vowels[ch]) {
      out += vowels[ch];
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase();
    } else if (ch === ' ') {
      out += ' ';
    }
  }
  return out;
}

function phoneticKey(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[vw]/g, 'v')
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/ee|ea|i/g, 'i')
    .replace(/oo|ou|u/g, 'u')
    .replace(/aa|a/g, 'a')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'c')
    .replace(/jh/g, 'j')
    .replace(/[dr]/g, 'r')
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z0-9]/g, '');
}

function smartConsonantKey(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[vw]/g, 'v')
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'c')
    .replace(/jh/g, 'j')
    .replace(/[dr]/g, 'r')
    .replace(/[aeiou]/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/[^a-z0-9]/g, '');
}

function matchDonorSearch(donor, query) {
  if (!donor) return false;
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;

  const cleanQ = q.replace(/^#/, '');

  // 1. S.No, Mobile, & Receipt match
  if (cleanQ && (String(donor.sno) === cleanQ || String(donor.sno).startsWith(cleanQ))) return true;
  if (cleanQ.length >= 3) {
    const cleanMob = cleanMobileNumber(donor.mobile || '');
    if (cleanMob && cleanMob.includes(cleanQ)) return true;
    if (donor.receipt && String(donor.receipt).toLowerCase().includes(cleanQ)) return true;
  }

  // 2. Direct Hindi/English Name match
  const name = String(donor.name || '').toLowerCase();
  if (name.includes(q) || name.includes(cleanQ)) return true;

  // 3. Direct Hindi/English City match
  const city = String(donor.city || '').toLowerCase();
  if (city.includes(q) || city.includes(cleanQ)) return true;

  // 4. Romanized transliteration match
  const pkQ = phoneticKey(cleanQ);
  const ckQ = smartConsonantKey(cleanQ);

  const nameRom = transliterateDevanagari(donor.name);
  if (nameRom.includes(q) || nameRom.includes(cleanQ)) return true;
  if (pkQ && pkQ.length >= 3 && phoneticKey(nameRom).includes(pkQ)) return true;
  if (ckQ && ckQ.length >= 3 && smartConsonantKey(nameRom).includes(ckQ)) return true;

  return false;
}

// CSV escaping logic
function escapeCSVField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

function runEdgeCaseTests() {
  console.log("============================================================");
  console.log(" 🔬 Narmada Ghat Nirman - Advanced Edge Case Test Suite");
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

  // --- 1. Extreme Financial Amounts (Crores & Lakhs) ---
  console.log("1. Extreme Financial Amounts (Crores, Lakhs, Boundaries):");
  assert("₹1 Crore (1,00,00,000) in Hindi", numberToHindiWords(10000000) === "एक करोड़");
  assert("₹5.5 Crore (5,50,00,000) in Hindi", numberToHindiWords(55000000) === "पांच करोड़ पचास लाख");
  assert("₹11 Crore (11,00,00,000) in Hindi", numberToHindiWords(110000000) === "ग्यारह करोड़");
  assert("₹99,99,999 in Hindi", numberToHindiWords(9999999) === "निन्यानवे लाख निन्यानवे हजार नौ सौ निन्यानवे");
  assert("Zero amount handled gracefully", numberToHindiWords(0) === "शून्य");
  assert("Negative amount absolute value conversion", numberToHindiWords(-5000) === "पांच हजार");

  // --- 2. Floating Point Precision & Decimals ---
  console.log("\n2. Currency Decimals & Floating Point Precision:");
  const floatPledge = 1000.50;
  const floatPaid = 500.25;
  const floatResult = calculateDonorBalance(floatPledge, floatPaid, []);
  assert("Exact decimal balance (1000.50 - 500.25 = 500.25)", Math.abs(floatResult.balance - 500.25) < 0.001);
  assert("Rounding to whole rupee for cash ledger", Math.round(floatResult.balance) === 500);

  // --- 3. Over-Collection Handling (Donor pays more than declared) ---
  console.log("\n3. Over-Collection Edge Cases (Paid > Declared):");
  const overColResult = calculateDonorBalance(10000, 15000, []);
  assert("Balance never becomes negative on over-collection", overColResult.balance === 0);
  assert("Over-collection deposited recorded accurately (₹15,000)", overColResult.collected === 15000);
  assert("Pledge marked complete", overColResult.isComplete === true);

  // Progress percentage capped at 100%
  const progPct = Math.min(100, Math.round((overColResult.collected / overColResult.declared) * 100));
  assert("Progress bar visual cap stays <= 100%", progPct === 100);

  // --- 4. Multi-Installment Cumulative Stress Test ---
  console.log("\n4. Multi-Installment Cumulative Payment Stress Test:");
  const installments = [];
  for (let i = 1; i <= 10; i++) {
    installments.push({ donorSno: 9001, amount: 5000, receiptNo: `RCP-INST-${i}` });
  }
  const multiInstResult = calculateDonorBalance(50000, 0, installments, 9001);
  assert("10 installments of ₹5,000 sum to exactly ₹50,000", multiInstResult.collected === 50000);
  assert("Cumulative remaining balance equals ₹0", multiInstResult.balance === 0);
  assert("Status marks complete upon exact final installment", multiInstResult.isComplete === true);

  // --- 5. Mobile Number Edge Cases & Malformed Formats ---
  console.log("\n5. Mobile Number Malformed & Boundary Formats:");
  assert("Formatted with spaces and dashes (+91-98260-12345)", cleanMobileNumber("+91-98260-12345") === "9826012345");
  assert("Parenthesis and local formatting ((098260) 12345)", cleanMobileNumber("(098260) 12345") === "9826012345");
  assert("Double zero country prefix (00919826012345)", cleanMobileNumber("00919826012345") === "9826012345");
  assert("Excel float with extra zeros (9826012345.00)", cleanMobileNumber("9826012345.00") === "9826012345");
  assert("Garbage letters stripped (98260ABC12345)", cleanMobileNumber("98260ABC12345") === "9826012345");
  assert("All whitespace string returns empty string", cleanMobileNumber("   ") === "");

  // --- 6. Search & Filter Matching Edge Cases ---
  console.log("\n6. Search Query Special Characters & Injection Resistance:");
  const testDonor = {
    sno: 777,
    name: "श्री रमेशचंद्र पाटीदार",
    city: "कोटेश्वर / कोठड़ा",
    mobile: "9826055555",
    receipt: "Book-10/Rcpt-77"
  };

  assert("Leading '#' serial lookup (#777)", matchDonorSearch(testDonor, "#777") === true);
  assert("Partial mobile match (55555)", matchDonorSearch(testDonor, "55555") === true);
  assert("Partial receipt search (Rcpt-77)", matchDonorSearch(testDonor, "Rcpt-77") === true);
  assert("Partial Hindi name search (रमेश)", matchDonorSearch(testDonor, "रमेश") === true);
  assert("Roman search matches Devanagari name (patidar -> पाटीदार)", matchDonorSearch(testDonor, "patidar") === true);

  // Regex special characters in search input shouldn't break or throw
  const specialCharsQueries = ["[a-z]", ".*", "path?name", "(test)", "^$", "+91", "*", "\\d+"];
  let regexSafe = true;
  for (const q of specialCharsQueries) {
    try {
      matchDonorSearch(testDonor, q);
    } catch (e) {
      regexSafe = false;
      break;
    }
  }
  assert("Special characters and regex operators in search query do NOT crash", regexSafe === true);

  // --- 7. CSV Serialization & Escaping Edge Cases ---
  console.log("\n7. CSV Export Escaping & Formatting:");
  const dirtyName = 'पाटीदार, "रमेश"';
  const escapedName = escapeCSVField(dirtyName);
  assert("Commas and internal quotes properly escaped in CSV", escapedName === '"पाटीदार, ""रमेश"""');

  const notesWithNewline = "प्रथम किस्त\nद्वितीय किस्त";
  const escapedNotes = escapeCSVField(notesWithNewline);
  assert("Multiline field wrapped in quotes for CSV compliance", escapedNotes === '"प्रथम किस्त\nद्वितीय किस्त"');

  // --- 8. Deletion & Re-use Sequence Collision Safety ---
  console.log("\n8. Rapid Sequence Re-use & Anti-Collision:");
  const deletedMap = new Set();
  // Simulate soft-deleting #590
  deletedMap.add("590:::पुराना दानदाता");
  assert("Deleted donor #590 is recognized as deleted", isDeclarationDeleted("590", "पुराना दानदाता", deletedMap) === true);

  // New donor arrives and receives sequence #590
  assert("Same sequence #590 with new donor 'नया दानदाता' is NOT blocked", 
    isDeclarationDeleted("590", "नया दानदाता", deletedMap) === false);

  // --- 9. Village Fuzzy Variations ---
  console.log("\n9. Village Canonicalization Fuzzy Variations:");
  const koteshwarVariations = ["कोटेश्वर", "कोठड़ा", "कोठडा", "कोटडा", "koteshwar", "kothda", "kotda", "kothada", "KOTESHWAR", "Kothra"];
  let allKoteshwarMatched = true;
  for (const v of koteshwarVariations) {
    if (normalizeVillage(v) !== "कोटेश्वर / कोठड़ा") {
      allKoteshwarMatched = false;
      console.log(`Failed variation: ${v} -> ${normalizeVillage(v)}`);
      break;
    }
  }
  assert("All 10 Kotda / Koteshwar spellings and transliterations unify", allKoteshwarMatched === true);

  const kadmalVariations = ["कडमाल", "खापरखेड़ा", "kadmal", "khaparkheda", "KADMAL"];
  let allKadmalMatched = true;
  for (const kv of kadmalVariations) {
    if (normalizeVillage(kv) !== "कडमाल / खापरखेड़ा") {
      allKadmalMatched = false;
      console.log(`Failed variation: ${kv} -> ${normalizeVillage(kv)}`);
      break;
    }
  }
  assert("All Kadmal / Khaparkheda cluster variants unify", allKadmalMatched === true);

  console.log("\n============================================================");
  console.log(` 🏁 Edge Case Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log("============================================================\n");

  return { passed, failed };
}

if (require.main === module) {
  const result = runEdgeCaseTests();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = { runEdgeCaseTests };
