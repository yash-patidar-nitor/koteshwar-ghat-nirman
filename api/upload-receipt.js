const https = require('https');

const DEFAULT_KEY_STORE = 'QVEuQWI4Uk42SWhUM1AxSmtBODFJbkcwdzRCek9zY21uSVZzVFl4c1lJb3NJTHRaeEc5bmc=';
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwS98khdbLX3wgfZWUgA5Qkb5OiKjbXOkB6g1uIGWGNWuDwP2WJp_K95wj5_TyE9wt9kw/exec';

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];

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
          mimeType: mimeType || 'image/jpeg',
          data: fileBase64
        }
      });
    }

    const payload = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 35000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            const candidate = json.candidates && json.candidates[0];
            const text = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0].text;
            if (text) {
              return resolve(JSON.parse(text));
            }
            return reject(new Error('No text part found in model response'));
          } catch (e) {
            return reject(new Error('Failed to parse model response JSON: ' + e.message + ' | Raw: ' + data.substring(0, 200)));
          }
        } else {
          return reject(new Error(`Model ${model} returned HTTP ${res.statusCode}: ${data.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Model ${model} request timed out after 35s`));
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
      reconciliationTag: '[AI_UNVERIFIED]',
      collectorSignature: '🤖 AI ऑटो-प्रविष्टि (सत्यापन लंबित)',
      supportedFormats: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      usage: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          fileBase64: '<Base64 encoded string of receipt image or multi-page PDF>',
          mimeType: 'application/pdf (or image/jpeg, image/png)',
          autoSave: true,
          reconcileTag: '[AI_UNVERIFIED]'
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
    let mimeType = (body && body.mimeType) || 'image/jpeg';
    let autoSave = body && body.autoSave === true; // Default false for hub review, or true if requested
    let collector = (body && body.collector) || '🤖 AI ऑटो-प्रविष्टि (सत्यापन लंबित)';
    let collectorUsername = (body && body.collectorUsername) || 'ai_auto_entry';

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

    const ocrPrompt = `You are an expert Devanagari (Hindi) and English document OCR AI specializing in Indian charity/temple donation receipts (माँ नर्मदा घाट निर्माण सेवा महाअभियान / श्री कोटेश्वर नर्मदा बहुउद्देशीय सेवा संस्थान or similar handwritten receipt slips).

This document (${isPdf ? 'PDF file containing one or more receipts across its pages' : 'receipt image'}) contains donation receipt slips.
Extract EVERY single receipt slip found into an array of objects.

Schema to strictly return:
{
  "receipts": [
    {
      "receiptNo": "Handwritten receipt number (e.g. '19/460', 'R 49/1124', '48/1096', '148/6082'). Look for 'रसीद क्र.', 'क्रमांक', 'बुक क्र./रसीद क्र.'",
      "donorName": "Full name of the donor, including father's/husband's name if written (e.g. 'हितेश जी अंकुश जी पिता सुरेशचन्द्र जी वाणी'). Do not abbreviate.",
      "city": "Village, town or city name (e.g. 'नानपुर', 'कुक्षी', 'सुसारी', 'बड़वानी', 'कोटेश्वर / कोठड़ा', 'निसरपुर', etc.). Look for 'स्थान', 'ग्राम', 'नगर', 'निवासी'. Default to 'अन्य' if unreadable.",
      "amount": 11111, // Numeric integer amount in rupees without symbols or commas. Cross-verify digits and Hindi words (e.g. 'ग्यारह हजार एक सौ ग्यारह').
      "amountInWords": "Amount in Hindi/English words (e.g. 'ग्यारह हजार एक सौ ग्यारह रुपये मात्र')",
      "notes": "Family memory, memorial or purpose (e.g. 'स्व. मोताबाई, स्व. मिश्रीलाल जी वाणी की स्मृति में'). Look for 'स्मृति', 'निमित्त'",
      "paymentMode": "Payment mode: 'Cash' (नकद), 'UPI' (PhonePe/GPay), 'Cheque' (चेक), or 'Bank Deposit'",
      "transactionRef": "Cheque number, UTR, or transaction reference if visible, or ''",
      "date": "Receipt date in YYYY-MM-DD format (if written DD/MM/YYYY or DD.MM.YY, convert accurately). If year missing, assume 2026.",
      "pageNumber": 1, // Page number where this receipt was found
      "confidence": "high" // 'high', 'medium', or 'low'
    }
  ]
}

Return ONLY the raw JSON object. No conversational text or markdown.`;

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

    // Sanitize receipt numbers and tag as AI entry
    receiptsList.forEach((r, idx) => {
      let rNo = String(r.receiptNo || '').trim();
      if (rNo && !rNo.toUpperCase().startsWith('R')) {
        rNo = 'R ' + rNo;
      }
      r.receiptNo = rNo || ('R-AI-' + Date.now().toString().slice(-4) + '-' + (idx + 1));
      r.isAiEntry = true;
      r.reconciliationStatus = 'PENDING_VERIFICATION';
      r.reconciliationTag = '[AI_UNVERIFIED]';
      r.collector = collector;
      r.collectorUsername = collectorUsername;
    });

    let syncResults = [];

    // Automatically flow into Google Sheets if autoSave is requested
    if (autoSave && receiptsList.length > 0) {
      for (const rec of receiptsList) {
        const sheetPayload = {
          action: 'addCollection',
          data: {
            receiptNo: rec.receiptNo,
            donorName: rec.donorName || 'दानदाता',
            city: rec.city || 'अन्य',
            amount: Number(rec.amount) || 0,
            paymentMode: rec.paymentMode || 'नकद',
            paymentDate: rec.date || new Date().toISOString().split('T')[0],
            transactionRef: rec.transactionRef || '',
            remarks: [
              '[AI_UNVERIFIED]',
              rec.notes ? `स्मृति: ${rec.notes}` : '',
              rec.amountInWords ? `(${rec.amountInWords})` : '',
              `[AI Auto-Entry via ${extractedObj.modelUsed}]`
            ].filter(Boolean).join(' | '),
            collector: collector,
            collectorUsername: collectorUsername
          }
        };

        try {
          const resSync = await postToGoogleAppsScript(sheetPayload);
          syncResults.push({ receiptNo: rec.receiptNo, sync: resSync });
        } catch (syncErr) {
          syncResults.push({ receiptNo: rec.receiptNo, error: syncErr.message });
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      modelUsed: extractedObj.modelUsed,
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
