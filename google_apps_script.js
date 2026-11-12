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

      // 3. यदि दानदाता का संदर्भ है, तो Declarations शीट में जमा राशि एवं शेष अपडेट करें
      if (item.donorSno) {
        var declSheet = ss.getSheetByName("Declarations");
        if (declSheet) {
          var data = declSheet.getDataRange().getValues();
          for (var i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim() === String(item.donorSno).trim() || 
                String(data[i][1]).trim() === String(item.donorName).trim()) {
              var currDep = parseFloat(String(data[i][8]).replace(/[^0-9.]/g, '') || 0);
              var addDep = parseFloat(item.amount) || 0;
              var newDep = currDep + addDep;
              var pledged = parseFloat(String(data[i][5]).replace(/[^0-9.]/g, '') || 0);
              var newBal = Math.max(0, pledged - newDep);

              declSheet.getRange(i + 1, 9).setValue(newDep); // Col I (Deposited)
              declSheet.getRange(i + 1, 12).setValue(newBal); // Col L (Balance)
              break;
            }
          }
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "धन प्राप्ति रसीद सफलतापूर्वक 'Live Collection' शीट में जुड़ गई।",
        receiptNo: item.receiptNo || ("R-" + collSno)
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
