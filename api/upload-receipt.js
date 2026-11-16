const https = require('https');
const { URL } = require('url');

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwS98khdbLX3wgfZWUgA5Qkb5OiKjbXOkB6g1uIGWGNWuDwP2WJp_K95wj5_TyE9wt9kw/exec';

const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash'
];

const DEFAULT_KEY_STORE = 'QVEuQWI4Uk42SWhUM1AxSmtBODFJbkcwdzRCek9zY21uSVZzVFl4c1lJb3NJTHRaWkc5bmc=';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function callGemini(model, apiKey, promptText, fileBase64, mimeType) {
  return new Promise((resolve, reject) => {
    const parts = [{ text: promptText }];
    if (fileBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'application/pdf',
          data: fileBase64
        }
      });
    }

    const payload = JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 60000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
              return reject(new Error('No text returned in Gemini candidate response'));
            }
            try {
              const obj = JSON.parse(text);
              resolve(obj);
            } catch (jsonErr) {
              const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              const obj = JSON.parse(clean);
              resolve(obj);
            }
          } catch (e) {
            reject(new Error(`Failed to parse Gemini output: ${e.message}\nRaw: ${data.slice(0, 300)}`));
          }
        } else {
          reject(new Error(`Gemini API error (HTTP ${res.statusCode}): ${data.slice(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Model ${model} request timed out after 60s`));
    });

    req.write(payload);
    req.end();
  });
}

function postToGoogleAppsScript(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    function follow(url) {
      const u = new URL(url);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 25000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location);
        }
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve({ raw: body });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Google Apps Script request timed out'));
      });
      req.write(payload);
      req.end();
    }

    follow(GOOGLE_APPS_SCRIPT_URL);
  });
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'Koteshwar Ghat Nirman - AI Receipt Auto-Entry & PDF Batch Hub',
      status: 'active',
      models: GEMINI_MODELS,
      defaultTarget: 'declarations',
      supportedFormats: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      usage: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          fileBase64: '<Base64 encoded string of receipt image or multi-page PDF>',
          mimeType: 'application/pdf (or image/jpeg, image/png)',
          target: 'declarations (default) or collections',
          autoSave: false
        }
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    let fileBase64 = (body && (body.fileBase64 || body.imageBase64)) || '';
    let mimeType = (body && body.mimeType) || 'application/pdf';
    let target = (body && body.target) || 'declarations'; // Default to declarations
    let autoSave = body && body.autoSave === true; // Default false so UI gets preview first
    let collector = (body && body.collector) || 'अधिकृत कार्यकर्ता';
    let collectorUsername = (body && body.collectorUsername) || 'ai_verified';

    if (!fileBase64) {
      return res.status(400).json({
        error: 'Missing fileBase64 in request body.',
        hint: 'Send JSON with { fileBase64: "...base64 data...", mimeType: "application/pdf" or "image/jpeg" }'
      });
    }

    // Strip data URI prefix if present (e.g. data:application/pdf;base64,...)
    if (fileBase64.includes('base64,')) {
      const parts = fileBase64.split('base64,');
      if (parts[0].includes('application/') || parts[0].includes('image/')) {
        const m = parts[0].match(/(application|image)\/[a-zA-Z0-9.+_-]+/);
        if (m) mimeType = m[0];
      }
      fileBase64 = parts[1];
    }
    fileBase64 = fileBase64.replace(/\s+/g, '');

    const isPdf = mimeType.includes('pdf');

    const ocrPrompt = `You are an expert Devanagari (Hindi) and English document OCR AI specializing in Indian temple/charity donation receipts of 'श्री कोटेश्वर नर्मदा बहुउद्देशीय सेवा संस्थान' (कोटेश्वर तीर्थ / निसरपुर / कुक्षी / धार).

This document (${isPdf ? 'multi-page PDF containing donation receipt slips' : 'receipt slip image'}) contains handwritten donation receipts.
Extract EVERY single receipt slip into structured JSON according to the following strict rules:

IMPORTANT RULES:
1. 'isDeferred' & 'paymentMode':
   - Check if Cash (नकद), UPI (PhonePe/GPay), Cheque (चेक), or Bank Transfer is explicitly written or ticked anywhere on the slip.
   - If NO payment mode is explicitly written, payment is DEFERRED ('isDeferred': true, 'paymentMode': 'आस्थगित').
   - If Cash or UPI is explicitly written, set that paymentMode and 'isDeferred': false.
2. 'bookNo':
   - Handwritten book number under 'बुक नं.' (e.g. '25', '01', '153', '34', '49').
3. 'receiptNo':
   - Handwritten receipt number under 'रसीद नं.' (e.g. '613', '76', '6193', '830', '1125').
4. 'fullReceipt':
   - Combined book and receipt number: (bookNo ? ('बुक ' + bookNo + ' / ' + receiptNo) : ('रसीद ' + receiptNo)).
5. 'donorName':
   - Donor's full name under 'मान्यवर श्री'.
6. 'fatherName':
   - Father's or husband's name under 'पिता श्री' or 'पति श्री'.
7. 'city':
   - Address, village, town or city under 'पता', 'स्थान', 'ग्राम', 'नगर' (e.g. 'बड़वानी', 'निसरपुर', 'बोरलाय (बड़वानी)', 'सुसारी'). Default to 'अन्य' if blank.
8. 'mobile':
   - Mobile number under 'मोबा.नं.' (e.g. '7999901039', '9977129792', '7898000173', '9993106947'), or '' if blank.
9. 'memorial':
   - Memorial or dedication under 'पुण्य स्मृति' (e.g. 'स्व. मांगी बाई एवं स्व. काशीनाथजी अग्रे', 'स्व. श्री प्रकाश सोनी', 'जसनबाई मंगाजी गुजरात्या बोरलाय', 'स्व. पूँजी बाई स्व. गोकुल जी जिराती'), or '' if blank.
10. 'constructionScope':
   - Construction dedication under 'दान स्वरूप' (e.g. 'एक पेढ़ी / 111 वर्गफीट', '51 वर्गफीट', '2.5 पेढ़ी / 255 वर्गफीट', 'दो पेढ़ी / 211 वर्गफीट', '3.5 पेढ़ी / 355 वर्गफीट').
11. 'cleanNotes':
   - Clean Hindi string combining memorial and construction scope:
     [memorial ? ('पुण्य स्मृति: ' + memorial) : '', constructionScope ? ('निर्माण: ' + constructionScope) : ''].filter(Boolean).join(' • ').
   - ABSOLUTELY DO NOT mention AI, robots, or model names in notes or remarks!
12. 'amount':
   - Numeric integer amount in rupees (e.g. 11111, 5111, 25555, 21111, 35555).
13. 'date':
   - Date in YYYY-MM-DD format. If written as DD/MM/YY (e.g. '16/11/26'), convert to '2026-11-16'. If DD-MM-YY, convert accordingly.

Schema to strictly return:
{
  "receipts": [
    {
      "page": 1,
      "bookNo": "25",
      "receiptNo": "613",
      "fullReceipt": "बुक 25 / 613",
      "donorName": "उमेशचंद्र अग्रे",
      "fatherName": "काशीनाथ अग्रे",
      "city": "बड़वानी",
      "mobile": "",
      "amount": 11111,
      "date": "2026-11-16",
      "memorial": "स्व. मांगी बाई एवं स्व. काशीनाथजी अग्रे",
      "constructionScope": "एक पेढ़ी / 111 वर्गफीट",
      "cleanNotes": "पुण्य स्मृति: स्व. मांगी बाई एवं स्व. काशीनाथजी अग्रे • निर्माण: एक पेढ़ी / 111 वर्गफीट",
      "paymentMode": "आस्थगित",
      "isDeferred": true
    }
  ]
}

Return ONLY the raw JSON object. No conversational text or markdown code fences.`;

    let extractedObj = null;
    let lastError = null;

    const activeApiKey = process.env.GEMINI_API_KEY || 
      (req.headers && req.headers['x-gemini-api-key']) || 
      (body && body.apiKey) || 
      Buffer.from(DEFAULT_KEY_STORE, 'base64').toString('utf8');

    // Try models with automatic fallback
    for (const model of GEMINI_MODELS) {
      try {
        extractedObj = await callGemini(model, activeApiKey, ocrPrompt, fileBase64, mimeType);
        if (extractedObj && (extractedObj.receipts || extractedObj.receiptNo)) {
          extractedObj.modelUsed = model;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next fallback:`, err.message);
      }
    }

    if (!extractedObj) {
      throw new Error('AI Vision OCR failed across all models: ' + (lastError ? lastError.message : 'Unknown'));
    }

    // Normalize output into array
    let receiptsList = [];
    if (Array.isArray(extractedObj.receipts)) {
      receiptsList = extractedObj.receipts;
    } else if (extractedObj.receiptNo || extractedObj.donorName) {
      receiptsList = [extractedObj];
    }

    // Sanitize and ensure clean fields
    receiptsList.forEach((r, idx) => {
      r.bookNo = String(r.bookNo || '').trim();
      r.receiptNo = String(r.receiptNo || '').trim();
      r.fullReceipt = r.fullReceipt || (r.bookNo ? `बुक ${r.bookNo} / ${r.receiptNo}` : `रसीद ${r.receiptNo || (idx + 1)}`);
      r.donorName = String(r.donorName || 'दानदाता').trim();
      r.fatherName = String(r.fatherName || '').trim();
      r.city = String(r.city || 'अन्य').trim();
      r.mobile = String(r.mobile || '').replace(/[^0-9]/g, '');
      r.amount = Number(r.amount) || 0;
      r.date = r.date || new Date().toISOString().split('T')[0];
      r.isDeferred = (r.isDeferred === true || !r.paymentMode || r.paymentMode === 'आस्थगित');
      r.paymentMode = r.isDeferred ? 'आस्थगित' : (r.paymentMode || 'नकद');
      r.notes = (r.cleanNotes || r.notes || '').replace(/\[AI.*?\]/gi, '').trim();
      r.verified = false; // Pending human verification in preview
    });

    let syncResults = [];

    // Flow into Google Sheets only if explicitly requested (autoSave === true)
    if (autoSave && receiptsList.length > 0) {
      for (const rec of receiptsList) {
        let sheetPayload;

        if (target === 'declarations') {
          const fullName = rec.fatherName ? `${rec.donorName} (पिता: ${rec.fatherName})` : rec.donorName;
          sheetPayload = {
            action: 'addDeclaration',
            data: {
              name: fullName,
              city: rec.city || 'अन्य',
              notes: rec.notes || '',
              mobile: rec.mobile || '',
              amount: rec.amount,
              receipt: rec.fullReceipt,
              date: rec.date,
              collector: collector,
              collectorUsername: collectorUsername
            }
          };
        } else {
          sheetPayload = {
            action: 'addCollection',
            data: {
              receiptNo: rec.fullReceipt || rec.receiptNo,
              donorName: rec.fatherName ? `${rec.donorName} (पिता: ${rec.fatherName})` : rec.donorName,
              city: rec.city || 'अन्य',
              amount: rec.amount,
              paymentMode: rec.paymentMode || 'नकद',
              paymentDate: rec.date,
              transactionRef: '',
              remarks: rec.notes || '',
              collector: collector,
              collectorUsername: collectorUsername
            }
          };
        }

        try {
          const resSync = await postToGoogleAppsScript(sheetPayload);
          syncResults.push({ receipt: rec.fullReceipt, sync: resSync });
        } catch (syncErr) {
          syncResults.push({ receipt: rec.fullReceipt, error: syncErr.message });
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      modelUsed: extractedObj.modelUsed,
      target: target,
      count: receiptsList.length,
      receipts: receiptsList,
      syncedToSheet: autoSave,
      syncResults: syncResults
    });

  } catch (error) {
    console.error('Receipt upload endpoint error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
