---
name: narmada-ghat-nirman-testing
description: Thorough validation and testing suite for transactions, UI workflows, and safe production rollback for the Narmada Ghat Nirman (Koteshwar Tirtha) dashboard.
---

# Narmada Ghat Nirman Dashboard Testing & Rollback Skill

Comprehensive testing and validation skill for **माँ नर्मदा घाट निर्माण सेवा महाअभियान (कोटेश्वर तीर्थ - कोठड़ा)**.
Covers end-to-end testing of transactions, balance calculations, receipts, public transparency dashboards, and includes a mandatory zero-footprint **production rollback protocol**.

---

## 1. Scope & Architecture Overview

The system consists of:
1. **Karyakarta Field Portal (`karyakarta.html`)**: Authenticated portal for volunteers to record donor declarations, generate handwritten/digital receipts, reconcile partial payments, and manage pending balances.
2. **Public Transparency Portal (`index.html`)**: Public-facing donor wall, stats aggregation, legacy storytelling, and receipt verification.
3. **Google Apps Script Webhook (`google_apps_script.js`)**: Real-time sync engine writing to live Google Sheet tabs:
   - `Live Declaration`
   - `Live Collection`
   - `Audit Log`
   - `Deleted Archive`
4. **Offline Resilience & LocalStorage**: High-speed client cache with versioning and reconciliation logic.

---

## 2. When to Use This Skill

Activate this skill when:
- Validating new UI components or responsive layouts in `karyakarta.html` or `index.html`.
- Verifying calculation logic (partial collections, balance updates, number-to-Hindi-words conversion, village normalization).
- Testing Google Apps Script webhook integration (`addDeclaration`, `addCollection`, `editDeclaration`, `deleteDeclaration`, `editCollection`, `deleteCollection`).
- Executing end-to-end QA on staging or against the live production Google Sheet.
- **Performing a safe rollback** to purge any test transactions and restore production records to an authentic state.

---

## 3. Fast Start & Execution Workflow

### A. Run Non-Destructive Offline Logic & UI Validation (Zero Production Risk)

1. **Business Logic & Transaction Calculations**:
```bash
node .agents/skills/narmada-ghat-nirman-testing/scripts/run_validation.js
```
*Evaluates 35 core assertions across mobile formatting, village unification, ghost filters, Hindi words, and balance reconciliation.*

2. **Automated UI, Form & DOM Validation**:
```bash
node .agents/skills/narmada-ghat-nirman-testing/scripts/run_ui_tests.js
```
*Evaluates 95 assertions across navigation tabs, form controls, modal dialogs, search filters, and public KPI dashboards.*

### B. Performing Live UI & Transaction QA
When validating in the browser:
1. **Pre-flight**: In `karyakarta.html` Settings, click **"संपूर्ण बैकअप (JSON)"** to capture a pre-test snapshot.
2. **Naming Convention**: Always use the prefix `TEST_QA_` for donor names and `TEST-RCP-` for receipts.
3. **Execute Test Cases**: Follow the structured scenarios in [`references/TEST_MATRIX.md`](./references/TEST_MATRIX.md).

### C. Executing Production Rollback
To completely undo test transactions:
1. **Tier 1 (Soft Delete via API)**:
   ```bash
   node .agents/skills/narmada-ghat-nirman-testing/scripts/rollback_manager.js generate-macro <test_snos> <test_receipts>
   ```
2. **Tier 2 (Client LocalStorage Clean)**:
   Paste the generated console snippet into DevTools to clear browser test records.
3. **Tier 3 (Google Sheet Permanent Purge)**:
   Run `purgeAllTestTransactions()` in Google Apps Script editor as detailed in [`references/ROLLBACK_RUNBOOK.md`](./references/ROLLBACK_RUNBOOK.md).

---

## 4. Test Suites & Focus Areas

### 1. Declaration & Pledge Logic
- Standard pledges (balance = declared amount).
- Simultaneous declarations + immediate receipts (balance = declared - received).
- Over-collection handling (prompt to elevate declaration vs cap).
- Hindi number-to-words accuracy for receipts (e.g. ₹51,000 -> "इक्यावन हजार रुपये मात्र").

### 2. Direct Collection & Reconciliations
- Direct collection linking to existing donors via `donorSno` or canonical name matching.
- Partial payment multi-receipt tracking.
- Cash vs Bank Transfer / UPI vs Cheque validation.

### 3. Smart Deletion & Anti-Collision
- Soft-delete moving records into `Deleted Archive` with audit username and ISO timestamp.
- Sequence collision prevention: Ensuring newly issued declarations are not blocked by previously soft-deleted Sno.

### 4. UI Search & Village Canonicalization
- Village grouping: Automatic normalization of `कोटेश्वर`, `कोठड़ा`, `kotda` into canonical `कोटेश्वर / कोठड़ा`.
- Dynamic addition of custom villages via inline prompt (`+ नया ग्राम जोड़ें`).
- Real-time search by Hindi/English donor name, village, receipt number, and mobile.

---

## 5. Rollback Verification Checklist

Always confirm the 4 points before concluding testing:
- [ ] No `TEST_QA_` entries remain in `Live Declaration`.
- [ ] No `TEST-RCP-` entries remain in `Live Collection`.
- [ ] Local cache on test browsers is refreshed and cleared.
- [ ] Total declared and collected figures in `index.html` reflect genuine donor sums.
