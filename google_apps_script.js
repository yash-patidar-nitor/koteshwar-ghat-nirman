/**
 * ==============================================================================
 * माँ नर्मदा घाट निर्माण सेवा महाअभियान | कोटेश्वर तीर्थ (कोठड़ा)
 * श्री कोटेश्वर नर्मदा बहुउद्देशीय सेवा संस्थान
 * 
 * GOOGLE APPS SCRIPT WEBHOOK (Live Declaration & Live Collection Sync)
 * ==============================================================================
 * 
 * निर्देश (SETUP INSTRUCTIONS):
 * 1. अपनी Google Sheet खोलें:
 *    https://docs.google.com/spreadsheets/d/1Gw-tjQuVRzp6jO57jdH7OzvfEx4Brw_DV6uRb1cUDt8/edit
 * 2. मेनू में जाएं: Extensions > Apps Script
 * 3. पुराना कोड हटाकर इस पूरी फ़ाइल का कोड पेस्ट करें।
 * 4. ऊपर "Deploy" (तैनात करें) बटन पर क्लिक करें > "Manage deployments" या "New deployment" चुनें:
 *    - Type: Web app
 *    - Description: Koteshwar Live Sync Webhook
 *    - Execute as: Me (आपका Google खाता)
 *    - Who has access: Anyone (कोई भी)
 * 5. "Deploy" पर क्लिक करें और जनरेट हुआ "Web app URL" कॉपी करें।
 * 6. इस URL को कार्यकर्ता पोर्टल (karyakarta.html) की सेटिंग्स में पेस्ट कर दें।
 * ==============================================================================
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "कोटेश्वर नर्मदा सेवा महाअभियान (Live Declaration & Live Collection) वेबहुक सक्रिय है।"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // 30 सेकंड तक समवर्ती अनुरोधों (Concurrent requests) के लिए सुरक्षित लॉक
    lock.waitLock(30000);

    var rawData = e.postData.contents;
    var payload = JSON.parse(rawData);
    var action = payload.action; // 'addDeclaration' या 'addCollection'
    var item = payload.data;

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "addDeclaration") {
      // 1. LIVE DECLARATION TAB (नया लाइव घोषणा सिंक)
      var liveDeclSheet = ss.getSheetByName("Live Declaration");
      if (!liveDeclSheet) {
        liveDeclSheet = ss.insertSheet("Live Declaration");
      }

      // यदि शीट बिल्कुल खाली है तो हेडर बनाएं
      if (liveDeclSheet.getLastRow() === 0) {
        liveDeclSheet.appendRow([
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
        ]);
        liveDeclSheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#123F42").setFontColor("#FFFFFF");
      }

      var lastRow = liveDeclSheet.getLastRow();
      // क्रम संख्या: हेडर के बाद (584 + new row)
      var nextSno = item.sno || (584 + lastRow);

      liveDeclSheet.appendRow([
        nextSno,
        item.name || "",
        item.city || "अन्य",
        item.notes || "",
        item.mobile || "",
        item.amount || 0,
        item.receipt || "-",
        item.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy"),
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
      var liveCollSheet = ss.getSheetByName("Live Collection");
      if (!liveCollSheet) {
        liveCollSheet = ss.insertSheet("Live Collection");
      }

      // यदि शीट बिल्कुल खाली है तो हेडर बनाएं
      if (liveCollSheet.getLastRow() === 0) {
        liveCollSheet.appendRow([
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
        ]);
        liveCollSheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#123F42").setFontColor("#FFFFFF");
      }

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
        item.paymentDate || item.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy"),
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
      // 3. EDIT DECLARATION IN LIVE DECLARATION TAB
      var liveDeclSheet = ss.getSheetByName("Live Declaration");
      var updated = false;
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
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: updated ? "success" : "not_found",
        message: updated ? "घोषणा प्रविष्टि सफलतापूर्वक अपडेट हो गई।" : "घोषणा रिकॉर्ड नहीं मिला।"
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "deleteDeclaration") {
      // 4. DELETE DECLARATION FROM LIVE DECLARATION TAB
      var liveDeclSheet = ss.getSheetByName("Live Declaration");
      var deleted = false;
      if (liveDeclSheet) {
        var data = liveDeclSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(item.sno).trim()) {
            liveDeclSheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: deleted ? "success" : "not_found",
        message: deleted ? "घोषणा प्रविष्टि सफलतापूर्वक हटा दी गई।" : "घोषणा रिकॉर्ड नहीं मिला।"
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "editCollection") {
      // 5. EDIT COLLECTION IN LIVE COLLECTION TAB
      var liveCollSheet = ss.getSheetByName("Live Collection");
      var updated = false;
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
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: updated ? "success" : "not_found",
        message: updated ? "रसीद प्रविष्टि सफलतापूर्वक अपडेट हो गई।" : "रसीद रिकॉर्ड नहीं मिला।"
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "deleteCollection") {
      // 6. DELETE COLLECTION FROM LIVE COLLECTION TAB
      var liveCollSheet = ss.getSheetByName("Live Collection");
      var deleted = false;
      if (liveCollSheet) {
        var data = liveCollSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (String(data[i][1]).trim() === String(item.receiptNo).trim()) {
            liveCollSheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        status: deleted ? "success" : "not_found",
        message: deleted ? "रसीद प्रविष्टि सफलतापूर्वक हटा दी गई।" : "रसीद रिकॉर्ड नहीं मिला।"
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
