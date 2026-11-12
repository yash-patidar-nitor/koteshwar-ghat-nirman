/**
 * ==============================================================================
 * माँ नर्मदा घाट निर्माण सेवा महाअभियान | कोटेश्वर तीर्थ (कोठड़ा)
 * श्री कोटेश्वर नर्मदा बहुउद्देशीय सेवा संस्थान
 * 
 * GOOGLE APPS SCRIPT WEBHOOK (Declarations & Collections Sync)
 * ==============================================================================
 * 
 * निर्देश (SETUP INSTRUCTIONS):
 * 1. अपनी Google Sheet खोलें:
 *    https://docs.google.com/spreadsheets/d/1Gw-tjQuVRzp6jO57jdH7OzvfEx4Brw_DV6uRb1cUDt8/edit
 * 2. मेनू में जाएं: Extensions > Apps Script
 * 3. पुराना कोड हटाकर इस पूरी फ़ाइल का कोड पेस्ट करें।
 * 4. ऊपर "Deploy" (तैनात करें) बटन पर क्लिक करें > "New deployment" चुनें।
 * 5. Gear icon पर क्लिक करके "Web app" चुनें:
 *    - Description: Koteshwar Karyakarta Webhook
 *    - Execute as: Me (आपका Google खाता)
 *    - Who has access: Anyone (कोई भी)
 * 6. "Deploy" पर क्लिक करें और जनरेट हुआ "Web app URL" कॉपी करें।
 * 7. इस URL को कार्यकर्ता पोर्टल (karyakarta.html) की सेटिंग्स में पेस्ट कर दें।
 * ==============================================================================
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    message: "कोटेश्वर नर्मदा सेवा महाअभियान वेबहुक सक्रिय है।"
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
      var declSheet = ss.getSheetByName("Declarations") || ss.getActiveSheet();
      var lastRow = declSheet.getLastRow();
      var nextSno = lastRow; // हेडर के बाद का क्रम

      var notesWithCollector = item.notes || "";
      if (item.collector) {
        var userTag = item.collectorUsername ? " (@" + item.collectorUsername + ")" : "";
        notesWithCollector = (notesWithCollector ? notesWithCollector + " | " : "") + "कार्यकर्ता: " + item.collector + userTag;
      }

      // Col A: S.No., Col B: Name, Col C: City, Col D: Notes, Col E: Mobile, Col F: Pledged, Col G: Receipt, Col H: Date, Col I: Deposited, Col L: Balance
      declSheet.appendRow([
        item.sno || nextSno,
        item.name || "",
        item.city || "अन्य",
        notesWithCollector,
        item.mobile || "",
        item.amount || 0,
        item.receipt || "-",
        item.date || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy"),
        item.deposited || 0,
        "", // Mode
        "", // Date
        item.amount || 0 // Initial balance = pledged
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "घोषणा प्रविष्टि सफलतापूर्वक Google Sheet में जुड़ गई।",
        sno: item.sno || nextSno
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (action === "addCollection") {
      var collSheet = ss.getSheetByName("Collections");
      if (!collSheet) {
        collSheet = ss.insertSheet("Collections");
        // हेडर बनाएं
        collSheet.appendRow([
          "क्र.",
          "रसीद क्रमांक",
          "दानदाता क्र.",
          "दानदाता का शुभ नाम",
          "स्थान / नगर",
          "प्राप्त सहयोग राशि",
          "जमा माध्यम",
          "प्राप्ति दिनांक",
          "विवरण / चेक / UTR",
          "संग्रहकर्ता कार्यकर्ता",
          "प्रविष्टि समय"
        ]);
        collSheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#123F42").setFontColor("#FFFFFF");
      }

      var collLastRow = collSheet.getLastRow();
      var collSno = collLastRow; // हेडर के बाद का क्रमांक

      var collectorString = item.karyakartaName || item.collector || "";
      if (item.collectorUsername && !collectorString.includes(item.collectorUsername)) {
        collectorString += (collectorString ? " (@" + item.collectorUsername + ")" : "@" + item.collectorUsername);
      }

      collSheet.appendRow([
        collSno,
        item.receiptNo || ("R-" + collSno),
        item.donorSno || "",
        item.donorName || "",
        item.city || "",
        item.amount || 0,
        item.paymentMode || "नकद",
        item.paymentDate || Utilities.formatDate(new Date(), "Asia/Kolkata", "dd/MM/yyyy"),
        item.transactionRef || "",
        collectorString,
        new Date().toISOString()
      ]);

      // यदि दानदाता का संदर्भ है, तो Declarations शीट में जमा राशि भी अपडेट करें
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
        message: "धन प्राप्ति रसीद सफलतापूर्वक Google Sheet में जुड़ गई।",
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
