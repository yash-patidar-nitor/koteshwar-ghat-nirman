const https = require('https');

const DEFAULT_KEY_STORE = 'QVEuQWI4Uk42SWhUM1AxSmtBODFJbkcwdzRCek9zY21uSVZzVFl4c1lJb3NJTHRaeEc5bmc=';
const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwS98khdbLX3wgfZWUgA5Qkb5OiKjbXOkB6g1uIGWGNWuDwP2WJp_K95wj5_TyE9wt9kw/exec';

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.8-flash'
];

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function callGemini(model, apiKey, promptText, imageBase64, mimeType) {
  return new Promise((resolve, reject) => {
    const parts = [{ text: promptText }];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: imageBase64
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
      timeout: 30000
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
      reject(new Error(`Model ${model} request timed out after 30s`));
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
      service: 'Koteshwar Ghat Nirman - AI Receipt Auto-Entry Endpoint',
      status: 'active',
      models: GEMINI_MODELS,
      usage: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          imageBase64: '<Base64 encoded string of receipt image>',
          mimeType: 'image/jpeg (or image/png, image/webp)',
          autoSave: true,
          collector: 'श्री महेंद्र पाटीदार (optional)',
          collectorUsername: 'mahendrapatidar (optional)'
        }
      }
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    let body = req.body;

    // Handle stringified bodies from some serverless platforms
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // May be raw multipart or binary
      }
    }

    let imageBase64 = body && body.imageBase64;
    let mimeType = (body && body.mimeType) || 'image/jpeg';
    let autoSave = body && body.autoSave !== false; // default true
    let collector = (body && body.collector) || 'AI रसीद स्कैनर';
    let collectorUsername = (body && body.collectorUsername) || 'ai_agent';

    if (!imageBase64) {
      return res.status(400).json({
        error: 'Missing imageBase64 in request body.',
        hint: 'Send JSON with { imageBase64: "...base64 data...", mimeType: "image/jpeg", autoSave: true }'
      });
    }

    // Strip data URI prefix if present (e.g. data:image/jpeg;base64,...)
    if (imageBase64.includes('base64,')) {
      const parts = imageBase64.split('base64,');
      if (parts[0].includes('image/')) {
        const m = parts[0].match(/image\/[a-zA-Z0-9.+_-]+/);
        if (m) mimeType = m[0];
      }
      imageBase64 = parts[1];
    }
    imageBase64 = imageBase64.replace(/\s+/g, '');

    const ocrPrompt = `You are an expert Devanagari (Hindi) and English document OCR AI specializing in Indian charity/temple donation receipts (माँ नर्मदा घाट निर्माण सेवा महाअभियान / श्री कोटेश्वर नर्मदा बहुउद्देशीय सेवा संस्थान or similar handwritten receipt books).

Carefully read this receipt image and extract all information into a strictly valid JSON object matching this schema:
{
  "receiptNo": "Handwritten receipt number (e.g. '19/460', 'R 49/1124', '48/1096', '148/6082'). Look for 'रसीद क्र.', 'क्रमांक', 'बुक क्र./रसीद क्र.'",
  "donorName": "Full name of the donor, including father's/husband's name if written (e.g. 'हितेश जी अंकुश जी पिता सुरेशचन्द्र जी वाणी'). Do not abbreviate.",
  "city": "Village, town or city name (e.g. 'नानपुर', 'कुक्षी', 'सुसारी', 'बड़वानी', 'कोटेश्वर / कोठड़ा', 'निसरपुर', etc.). Look for 'स्थान', 'ग्राम', 'नगर', 'निवासी'. Default to 'अन्य' if unreadable.",
  "amount": 11111, // Numeric amount in rupees as an integer or float without currency symbols or commas. Cross-verify the digits and the amount written in Hindi words (e.g. 'ग्यारह हजार एक सौ ग्यारह').
  "amountInWords": "Amount written in Hindi or English words (e.g. 'ग्यारह हजार एक सौ ग्यारह रुपये मात्र')",
  "notes": "Family memory, memorial details or purpose (e.g. 'स्व. मोताबाई, स्व. मिश्रीलाल जी वाणी की स्मृति में' or 'कक्ष निर्माण हेतु'). Look for 'स्मृति', 'निमित्त'",
  "paymentMode": "Payment mode: 'Cash' (नकद), 'UPI' (PhonePe/GPay), 'Cheque' (चेक), or 'Bank Deposit'",
  "transactionRef": "Cheque number, UTR, or transaction reference if visible, or ''",
  "date": "Receipt date in YYYY-MM-DD format (if written DD/MM/YYYY or DD.MM.YY, accurately convert to YYYY-MM-DD). If no year specified, assume 2026.",
  "collector": "Name of the karyakarta or signature who issued the receipt, if visible, else ''",
  "confidence": "high" // 'high', 'medium', or 'low'
}

Return ONLY the raw JSON object. No conversational text or markdown formatting.`;

    let extractedData = null;
    let lastError = null;

    const activeApiKey = process.env.GEMINI_API_KEY || 
      (req.headers && req.headers['x-gemini-api-key']) || 
      (body && body.apiKey) || 
      Buffer.from(DEFAULT_KEY_STORE, 'base64').toString('utf8');

    // Try models with automatic fallback
    for (const model of GEMINI_MODELS) {
      try {
        extractedData = await callGemini(model, activeApiKey, ocrPrompt, imageBase64, mimeType);
        if (extractedData && (extractedData.receiptNo || extractedData.donorName || extractedData.amount)) {
          extractedData.modelUsed = model;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next fallback:`, err.message);
      }
    }

    if (!extractedData) {
      throw new Error('AI Vision OCR failed across all models: ' + (lastError ? lastError.message : 'Unknown'));
    }

    // Format receipt number cleanly
    let rNo = String(extractedData.receiptNo || '').trim();
    if (rNo && !rNo.toUpperCase().startsWith('R')) {
      rNo = 'R ' + rNo;
    }
    extractedData.receiptNo = rNo;

    let syncResult = null;

    // Automatically flow into Google Sheets if autoSave is true
    if (autoSave) {
      const sheetPayload = {
        action: 'addCollection',
        data: {
          receiptNo: extractedData.receiptNo || ('R-' + Date.now().toString().slice(-4)),
          donorName: extractedData.donorName || 'दानदाता',
          city: extractedData.city || 'अन्य',
          amount: Number(extractedData.amount) || 0,
          paymentMode: extractedData.paymentMode || 'नकद',
          paymentDate: extractedData.date || new Date().toISOString().split('T')[0],
          transactionRef: extractedData.transactionRef || '',
          remarks: [
            extractedData.notes ? `स्मृति: ${extractedData.notes}` : '',
            extractedData.amountInWords ? `(${extractedData.amountInWords})` : '',
            `[AI Auto-Entry via ${extractedData.modelUsed}]`
          ].filter(Boolean).join(' | '),
          collector: collector,
          collectorUsername: collectorUsername
        }
      };

      try {
        syncResult = await postToGoogleAppsScript(sheetPayload);
      } catch (syncErr) {
        console.error('Google Sheet auto-sync error:', syncErr.message);
        syncResult = { error: syncErr.message, status: 'failed_to_sync_sheet' };
      }
    }

    return res.status(200).json({
      status: 'success',
      extracted: extractedData,
      syncedToSheet: autoSave && syncResult && syncResult.status === 'success',
      sheetResponse: syncResult
    });

  } catch (error) {
    console.error('Receipt upload endpoint error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
