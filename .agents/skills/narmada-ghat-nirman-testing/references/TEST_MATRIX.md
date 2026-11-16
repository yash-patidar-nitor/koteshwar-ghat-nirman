# Test Matrix: Narmada Ghat Nirman (Koteshwar Tirtha) Dashboard

This document details the test matrix covering all critical transaction pathways, calculation engines, UI components, and data synchronization hooks for the **Karyakarta Field Portal (`karyakarta.html`)** and **Public Transparency Portal (`index.html`)**.

---

## 1. Authentication & Session Validation

| Test ID | Scenario | Input / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **AUTH-01** | Valid User PIN Login | Select `श्री अनिल पाटीदार` (`anilpatidar`), enter PIN `narmadehar2026` | Login succeeds, modal dismisses, top navbar displays logged-in user with badge | `sessionStorage` or `currentUser` state holds username |
| **AUTH-02** | Invalid PIN Rejection | Enter incorrect PIN `wrong123` | Alert: `गलत पिन! कृपया पुनः प्रयास करें।`, session remains blocked | Login modal remains open, form cleared |
| **AUTH-03** | Alternative Valid PINs | Test PINs: `कोटेश्वर2026`, `koteshwar2026`, `12345` | All valid PINs authenticate successfully | User avatar and logout button visible in navbar |
| **AUTH-04** | Logout Action | Click logout button | Session cleared, user prompted with login screen upon action | User cannot submit transactions without re-authenticating |

---

## 2. Declaration Creation Pathways

| Test ID | Scenario | Input / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **DECL-01** | Standard Pledge Declaration (No Immediate Collection) | Name: `TEST_QA_DONOR_1`, Village: `कुक्षी`, Amount: `₹51,000`, Date: today, Notes: `पारिवारिक संकल्प` | Saved with sequential Sno, added to `declarationsList`, balance = `₹51,000`, deposited = `₹0` | Appears in Declarations tab and Pending Balances tab |
| **DECL-02** | Declaration with Immediate Cash Receipt | Amount: `₹25,000`, check `chkDeclReceiveNow`, Receipt: `TEST-RCP-01`, Received: `₹25,000`, Mode: `नकद` | 1 Declaration created + 1 Collection record generated with receipt `TEST-RCP-01`, Balance = `₹0` | Collections list has new entry; Declaration marked complete |
| **DECL-03** | Partial Immediate Payment | Declared: `₹1,00,000`, Immediate: `₹40,000`, Receipt: `TEST-RCP-02` | Deposited = `₹40,000`, Remaining Balance = `₹60,000` | Appears in Pending Ledger with exact ₹60,000 balance |
| **DECL-04** | Received Amount > Declared Amount Prompt | Declared: `₹10,000`, Received: `₹15,000` | Confirmation dialog asks to elevate declared amount to `₹15,000` | If accepted, declared amount updates to ₹15,000, balance = ₹0 |
| **DECL-05** | Custom Village Addition | Select `+ नया ग्राम जोड़ें`, enter `ग्राम बोरखेड़ा` | Custom village saved into dropdown, persisted in `koteshwar_villages_master` | Village immediately selectable in all forms |
| **DECL-06** | Mobile Number Normalization | Input: `+91 98260-12345` or `09826012345` | Stripped to clean `9826012345` | WhatsApp trigger link contains clean 10-digit number |
| **DECL-07** | Hindi Number Words Output | Amount: `₹51,000` | Generates receipt with `इक्यावन हजार रुपये मात्र` | Receipt preview modal Hindi text matches KaTeX/Hindi rules |

---

## 3. Direct Receipt Collection & Balance Reconciliations

| Test ID | Scenario | Input / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **COLL-01** | Collect against Existing Pledge | Search donor by name or Sno, enter Receipt: `TEST-RCP-03`, Amount: `₹10,000`, Mode: `बैंक ट्रांसफर / UPI`, Ref: `UTR998877` | Collection appended, donor's cumulative deposited increases by ₹10,000, balance decreases accordingly | Pending Ledger updates instantly without page reload |
| **COLL-02** | Duplicate Receipt Prevention | Attempt creating collection with existing receipt number | System alerts or highlights duplicate receipt | User notified before saving |
| **COLL-03** | Anonymous / General Collection | Collect without linking donor Sno (Direct general donation) | Receipt recorded with donor name, linked as unassigned/new donor | Shows in Collections Ledger with valid receipt |

---

## 4. Transaction Modification & Audit Trails

| Test ID | Scenario | Input / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **EDIT-01** | Edit Declaration Amount | Open Edit Declaration modal for donor, change `₹50,000` to `₹75,000` | Declaration amount updated, balance recomputed, modified metadata recorded (`modified_by`, `modified_at`) | Webhook `editDeclaration` fired; Audit Log tab logged |
| **EDIT-02** | Edit Collection Receipt & Mode | Change Receipt `TEST-RCP-01` payment mode from `नकद` to `चेक`, add Cheque # | Collection record reflects new mode and reference | Webhook `editCollection` fired; Audit Log updated |

---

## 5. Deletion & Ghost Prevention Validation

| Test ID | Scenario | Input / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **DEL-01** | Soft Delete Declaration | Click Delete on test declaration, confirm warning | Row removed from UI & local cache, recorded in `Deleted Archive` sheet with deleter's username and timestamp | `deletedSet` tracks `${sno}:::${name}` |
| **DEL-02** | Re-using Sequence Number Safety | Create new declaration that receives the same sequence number as previously deleted row | New declaration is NOT blocked or hidden by previous deletion | UI renders the new declaration properly |
| **DEL-03** | Soft Delete Collection | Click Delete on test collection receipt | Collection removed, linked donor's deposited amount decreased and balance restored | Webhook `deleteCollection` executed |

---

## 6. UI Search, Filtering & Export Validations

| Test ID | Scenario | Input / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **UI-01** | Village Dropdown Filter | Select `कोटेश्वर / कोठड़ा` | Displays only records matching canonical village (both Kotda and Koteshwar entries included) | No disparate splits between Kotda & Koteshwar |
| **UI-02** | Live Donor Search | Search by Hindi name (e.g. `पाटीदार`), English query, or receipt number | Instant real-time filtering with high performance (<100ms) | Table updates smoothly |
| **UI-03** | CSV Export Verification | Click `CSV डाउनलोड` on Declarations and Collections | Generates valid UTF-8 BOM CSV file containing exact current table records | File opens cleanly in Excel without mojibake/garbled Hindi |
| **UI-04** | Full JSON Backup | Click `संपूर्ण बैकअप (JSON)` in Settings | Downloads `koteshwar_backup.json` containing complete state | JSON contains `currentUser`, `declarations`, `collections`, `exportDate` |

---

## 7. Public Transparency Portal (`index.html`)

| Test ID | Scenario | Input / Action | Expected Result | Verification Check |
| :--- | :--- | :--- | :--- | :--- |
| **PUB-01** | Summary Cards Aggregation | Open `index.html` | Total declared, total collected, donor count match production Google Sheet totals | Metric figures display correct currency format |
| **PUB-02** | Public Donor Receipt Verification | Search by donor name or receipt number | Displays verified badge, amount, and village | No sensitive internal notes or phone numbers leaked |
| **PUB-03** | Responsive Layout Verification | Test on Mobile Viewport (375px) and Desktop (1440px) | Navigation, tables, and modal dialogs fit screen without horizontal scroll bugs | Clean touch targets (>44px) |
