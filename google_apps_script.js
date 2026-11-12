/**
 * ==============================================================================
 * माँ नर्मदा घाट निर्माण सेवा महाअभियान | कोटेश्वर तीर्थ (कोठड़ा)
 * श्री कोटेश्वर नर्मदा बहुउद्देशीय सेवा संस्थान
 * 
 * GOOGLE APPS SCRIPT WEBHOOK (Live Declaration, Live Collection, Audit and Soft-Delete Sync)
 * ==============================================================================
 * 
 * निर्देश (SETUP INSTRUCTIONS):
 * 1. अपनी Google Sheet खोलें:
 *    https://docs.google.com/spreadsheets/d/1Gw-tjQuVRzp6jO57jdH7OzvfEx4Brw_DV6uRb1cUDt8/edit
 * 2. मेनू में जाएं: Extensions > Apps Script
 * 3. पुराना कोड हटाकर इस पूरी फ़ाइल का कोड पेस्ट करें।
 * 4. ऊपर "Deploy" (तैनात करें) बटन पर क्लिक करें > "Manage deployments" या "New deployment" चुनें:
 *    - Type: Web app
 *    - Description: Koteshwar Live Sync Webhook v2
 *    - Execute as: Me (आपका Google खाता)
 *    - Who has access: Anyone (कोई भी)
 * 5. "Deploy" पर क्लिक करें और जनरेट हुआ "Web app URL" कॉपी करें।
 * 6. इस URL को कार्यकर्ता पोर्टल (karyakarta.html) की सेटिंग्स में पेस्ट कर दें।
 * ==============================================================================
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "कोटेश्वर नर्मदा सेवा महाअभियान (Live Declaration, Live Collection, Audit and Soft-Delete) वेबहुक सक्रिय है।"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // 30 सेकंड तक समवर्ती अनुरोधों (Concurrent requests) के लिए सुरक्षित लॉक
    lock.waitLock(30000);

    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var action = payload.action; 
    var item = payload.data || {};

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "addDeclaration") {
      // 1. LIVE DECLARATION TAB (नया लाइव घोषणा सिंक)
      var liveDeclSheet = getOrCreateSheet(ss, "Live Declaration", [
        "क्र.",
        "दानदाता का शुभ नाम",
        "स्थान / ग्राम",
        "स्मरण / पारिवारिक विवरण",
        "मोबाइल नंबर",
        "घोषित संकल्प राशि",
        "रसीद क्रमांक",
        "घोषणा दिनांक",
        "अधिकृत कार्यकर्ता",
        "यूजरनेम",
        "प्रविष्टि समय"
      ], "#123F42");

      var lastRow = liveDeclSheet.getLastRow();
      var nextSno = item.sno || (584 + lastRow);

      liveDeclSheet.appendRow([
        nextSno,
        item.name || "",
        item.city || "अन्य",
        item.notes || "",
        item.mobile || "",
        item.amount || 0,
        item.receipt || "-",
        item.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd"),
        item.collector || "",
        item.collectorUsername || "",
        new Date().toISOString()
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "घोषणा प्रविष्टि सफलतापूर्वक 'Live Declaration' शीट में जुड़ गई।",
        sno: nextSno
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "addCollection") {
      // 2. LIVE COLLECTION TAB (नया लाइव संग्रह सिंक)
      var liveCollSheet = getOrCreateSheet(ss, "Live Collection", [
        "क्र.",
        "हस्तलिखित रसीद बुक क्रमांक",
        "दानदाता क्र.",
        "दानदाता का शुभ नाम",
        "स्थान / नगर",
        "प्राप्त सहयोग राशि",
        "भुगतान माध्यम",
        "प्राप्ति दिनांक",
        "चेक / UTR संदर्भ",
        "संग्रहकर्ता कार्यकर्ता",
        "यूजरनेम",
        "पावती विवरण",
        "प्रविष्टि समय"
      ], "#123F42");

      var collLastRow = liveCollSheet.getLastRow();
      var collSno = collLastRow; // हेडर के बाद का क्रमांक

      var collectorName = item.collector || item.karyakartaName || "";
      var collectorUser = item.collectorUsername || "";

      liveCollSheet.appendRow([
        collSno,
        item.receiptNo || ("R-" + collSno),
        item.donorSno || "",
        item.donorName || "",
        item.city || "",
        item.amount || 0,
        item.paymentMode || "नकद",
        item.paymentDate || item.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd"),
        item.transactionRef || item.refNo || "",
        collectorName,
        collectorUser,
        item.remarks || "",
        new Date().toISOString()
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "धन प्राप्ति रसीद सफलतापूर्वक 'Live Collection' शीट में जुड़ गई।",
        receiptNo: item.receiptNo || ("R-" + collSno)
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "editDeclaration") {
      // 3. EDIT DECLARATION (CHECKS 'Live Declaration' FIRST, THEN 'Declarations')
      var liveDeclSheet = ss.getSheetByName("Live Declaration");
      var updated = false;
      var targetSheetName = "";

      if (liveDeclSheet) {
        var data = liveDeclSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(item.sno).trim()) {
            if (item.name) liveDeclSheet.getRange(i + 1, 2).setValue(item.name);
            if (item.city) liveDeclSheet.getRange(i + 1, 3).setValue(item.city);
            if (item.notes !== undefined) liveDeclSheet.getRange(i + 1, 4).setValue(item.notes);
            if (item.mobile !== undefined) liveDeclSheet.getRange(i + 1, 5).setValue(item.mobile);
            if (item.amount !== undefined) liveDeclSheet.getRange(i + 1, 6).setValue(Number(item.amount) || 0);
            if (item.receipt !== undefined) liveDeclSheet.getRange(i + 1, 7).setValue(item.receipt);
            if (item.date) liveDeclSheet.getRange(i + 1, 8).setValue(item.date);
            updated = true;
            targetSheetName = "Live Declaration";
            break;
          }
        }
      }

      if (!updated) {
        var declSheet = ss.getSheetByName("Declarations");
        if (declSheet) {
          var dData = declSheet.getDataRange().getValues();
          for (var j = 1; j < dData.length; j++) {
            if (String(dData[j][0]).trim() === String(item.sno).trim()) {
              if (item.name) declSheet.getRange(j + 1, 2).setValue(item.name);
              if (item.city) declSheet.getRange(j + 1, 3).setValue(item.city);
              if (item.notes !== undefined) declSheet.getRange(j + 1, 4).setValue(item.notes);
              if (item.mobile !== undefined) declSheet.getRange(j + 1, 5).setValue(item.mobile);
              if (item.amount !== undefined) {
                var newAmt = Number(item.amount) || 0;
                declSheet.getRange(j + 1, 6).setValue(newAmt);
                var depAmt = parseFloat(String(dData[j][8]).replace(/[^0-9.]/g, '') || 0);
                declSheet.getRange(j + 1, 12).setValue(Math.max(0, newAmt - depAmt));
              }
              if (item.receipt !== undefined) declSheet.getRange(j + 1, 7).setValue(item.receipt);
              if (item.date) declSheet.getRange(j + 1, 8).setValue(item.date);
              updated = true;
              targetSheetName = "Declarations";
              break;
            }
          }
        }
      }

      if (updated) {
        // Record in Audit Log
        recordAuditLog(
          ss,
          "घोषणा संशोधन",
          item.sno,
          item.name || "",
          item.city || "",
          item.amount || 0,
          item.modified_by || "karyakarta",
          item.modified_by_name || "",
          item.modified_at || new Date().toISOString(),
          targetSheetName + " में विवरण अपडेट किया गया।"
        );
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: updated ? "success" : "not_found",
        message: updated ? "घोषणा प्रविष्टि सफलतापूर्वक अपडेट हो गई।" : "घोषणा रिकॉर्ड नहीं मिला।"
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "deleteDeclaration") {
      // 4. SOFT DELETE DECLARATION (LOGS TO 'Deleted Archive' AND CLEANS ACTIVE LIST)
      var liveDeclSheet = ss.getSheetByName("Live Declaration");
      var deleted = false;
      var archivedName = item.name || "";
      var archivedCity = item.city || "";
      var archivedAmt = item.amount || 0;

      if (liveDeclSheet) {
        var data = liveDeclSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(item.sno).trim()) {
            archivedName = data[i][1] || archivedName;
            archivedCity = data[i][2] || archivedCity;
            archivedAmt = data[i][5] || archivedAmt;
            liveDeclSheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
      }

      if (!deleted) {
        var declSheet = ss.getSheetByName("Declarations");
        if (declSheet) {
          var dData = declSheet.getDataRange().getValues();
          for (var j = 1; j < dData.length; j++) {
            if (String(dData[j][0]).trim() === String(item.sno).trim()) {
              archivedName = dData[j][1] || archivedName;
              archivedCity = dData[j][2] || archivedCity;
              archivedAmt = dData[j][5] || archivedAmt;
              declSheet.deleteRow(j + 1);
              deleted = true;
              break;
            }
          }
        }
      }

      // Record Soft Delete in 'Deleted Archive' with deleted_by and deleted_at timestamps
      recordDeletedArchive(
        ss,
        "घोषणा संकल्प",
        item.sno,
        archivedName,
        archivedCity,
        archivedAmt,
        item.deleted_by || "karyakarta",
        item.deleted_by_name || "",
        item.deleted_at || new Date().toISOString(),
        item
      );

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "घोषणा प्रविष्टि सफलतापूर्वक हटा दी गई (सॉफ्ट डिलीट पुरालेख 'Deleted Archive' में सुरक्षित दर्ज)।",
        sno: item.sno
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "editCollection") {
      // 5. EDIT COLLECTION (CHECKS 'Live Collection' FIRST, THEN 'Collections')
      var liveCollSheet = ss.getSheetByName("Live Collection");
      var updated = false;
      var targetSheetName = "";

      if (liveCollSheet) {
        var data = liveCollSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim() === String(item.receiptNo).trim()) {
            if (item.donorName) liveCollSheet.getRange(i + 1, 4).setValue(item.donorName);
            if (item.city) liveCollSheet.getRange(i + 1, 5).setValue(item.city);
            if (item.amount !== undefined) liveCollSheet.getRange(i + 1, 6).setValue(Number(item.amount) || 0);
            if (item.paymentMode) liveCollSheet.getRange(i + 1, 7).setValue(item.paymentMode);
            if (item.date) liveCollSheet.getRange(i + 1, 8).setValue(item.date);
            if (item.refNo !== undefined) liveCollSheet.getRange(i + 1, 9).setValue(item.refNo);
            if (item.remarks !== undefined) liveCollSheet.getRange(i + 1, 12).setValue(item.remarks);
            updated = true;
            targetSheetName = "Live Collection";
            break;
          }
        }
      }

      if (!updated) {
        var collSheet = ss.getSheetByName("Collections");
        if (collSheet) {
          var cData = collSheet.getDataRange().getValues();
          for (var j = 1; j < cData.length; j++) {
            if (String(cData[j][1]).trim() === String(item.receiptNo).trim()) {
              if (item.donorName) collSheet.getRange(j + 1, 4).setValue(item.donorName);
              if (item.city) collSheet.getRange(j + 1, 5).setValue(item.city);
              if (item.amount !== undefined) collSheet.getRange(j + 1, 6).setValue(Number(item.amount) || 0);
              if (item.paymentMode) collSheet.getRange(j + 1, 7).setValue(item.paymentMode);
              if (item.date) collSheet.getRange(j + 1, 8).setValue(item.date);
              if (item.refNo !== undefined) collSheet.getRange(j + 1, 9).setValue(item.refNo);
              if (item.remarks !== undefined) collSheet.getRange(j + 1, 12).setValue(item.remarks);
              updated = true;
              targetSheetName = "Collections";
              break;
            }
          }
        }
      }

      if (updated) {
        recordAuditLog(
          ss,
          "रसीद संशोधन",
          item.receiptNo,
          item.donorName || "",
          item.city || "",
          item.amount || 0,
          item.modified_by || "karyakarta",
          item.modified_by_name || "",
          item.modified_at || new Date().toISOString(),
          targetSheetName + " में रसीद विवरण अपडेट किया गया।"
        );
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: updated ? "success" : "not_found",
        message: updated ? "रसीद प्रविष्टि सफलतापूर्वक अपडेट हो गई।" : "रसीद रिकॉर्ड नहीं मिला।"
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "deleteCollection") {
      // 6. SOFT DELETE COLLECTION (LOGS TO 'Deleted Archive' AND CLEANS ACTIVE LIST)
      var liveCollSheet = ss.getSheetByName("Live Collection");
      var deleted = false;
      var archivedName = item.donorName || "";
      var archivedCity = item.city || "";
      var archivedAmt = item.amount || 0;

      if (liveCollSheet) {
        var data = liveCollSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim() === String(item.receiptNo).trim()) {
            archivedName = data[i][3] || archivedName;
            archivedCity = data[i][4] || archivedCity;
            archivedAmt = data[i][5] || archivedAmt;
            liveCollSheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
      }

      if (!deleted) {
        var collSheet = ss.getSheetByName("Collections");
        if (collSheet) {
          var cData = collSheet.getDataRange().getValues();
          for (var j = 1; j < cData.length; j++) {
            if (String(cData[j][1]).trim() === String(item.receiptNo).trim()) {
              archivedName = cData[j][3] || archivedName;
              archivedCity = cData[j][4] || archivedCity;
              archivedAmt = cData[j][5] || archivedAmt;
              collSheet.deleteRow(j + 1);
              deleted = true;
              break;
            }
          }
        }
      }

      recordDeletedArchive(
        ss,
        "संग्रह रसीद",
        item.receiptNo,
        archivedName,
        archivedCity,
        archivedAmt,
        item.deleted_by || "karyakarta",
        item.deleted_by_name || "",
        item.deleted_at || new Date().toISOString(),
        item
      );

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "रसीद प्रविष्टि सफलतापूर्वक हटा दी गई (सॉफ्ट डिलीट पुरालेख 'Deleted Archive' में सुरक्षित दर्ज)।",
        receiptNo: item.receiptNo
      })).setMimeType(ContentService.MimeType.JSON);

    } else {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "अमान्य क्रिया (Invalid action)"
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper to get an existing sheet or create it with styled headers
 */
function getOrCreateSheet(ss, name, headers, headerColor) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground(headerColor || "#123F42")
      .setFontColor("#FFFFFF");
  }
  return sheet;
}

/**
 * Record soft-deleted item in 'Deleted Archive' sheet with full audit fields
 */
function recordDeletedArchive(ss, type, id, name, city, amount, deletedBy, deletedByName, deletedAt, rawItem) {
  try {
    var archiveSheet = getOrCreateSheet(ss, "Deleted Archive", [
      "हटाने का समय (Deleted At)",
      "प्रकार (Type)",
      "क्रम / रसीद नं.",
      "दानदाता का नाम",
      "स्थान / ग्राम",
      "राशि (₹)",
      "हटाया गया यूजरनेम (Deleted By)",
      "कार्यकर्ता नाम",
      "विवरण",
      "मूल डेटा (JSON)"
    ], "#8E1E1D");

    archiveSheet.appendRow([
      deletedAt || new Date().toISOString(),
      type || "सामान्य",
      id || "-",
      name || "",
      city || "",
      amount || 0,
      deletedBy || "karyakarta",
      deletedByName || "",
      "UI कार्यकर्ता पोर्टल से हटाया गया (Soft Deleted)",
      JSON.stringify(rawItem || {})
    ]);
  } catch (err) {
    Logger.log("Soft delete archive log failed: " + err.toString());
  }
}

/**
 * Record edits in 'Audit Log' sheet for full accountability
 */
function recordAuditLog(ss, type, id, name, city, amount, modifiedBy, modifiedByName, modifiedAt, details) {
  try {
    var auditSheet = getOrCreateSheet(ss, "Audit Log", [
      "संशोधन समय (Modified At)",
      "प्रकार (Type)",
      "क्रम / रसीद नं.",
      "दानदाता का नाम",
      "स्थान / ग्राम",
      "राशि (₹)",
      "संशोधनकर्ता यूजरनेम (Modified By)",
      "कार्यकर्ता नाम",
      "परिवर्तन विवरण"
    ], "#2E4057");

    auditSheet.appendRow([
      modifiedAt || new Date().toISOString(),
      type || "संशोधन",
      id || "-",
      name || "",
      city || "",
      amount || 0,
      modifiedBy || "karyakarta",
      modifiedByName || "",
      details || "संशोधित किया गया"
    ]);
  } catch (err) {
    Logger.log("Audit log failed: " + err.toString());
  }
}
