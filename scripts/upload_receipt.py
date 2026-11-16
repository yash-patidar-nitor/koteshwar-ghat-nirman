#!/usr/bin/env python3
"""
Koteshwar Ghat Nirman - AI Receipt Auto-Uploader CLI
Usage:
    python scripts/upload_receipt.py path/to/receipt.jpg
    python scripts/upload_receipt.py path/to/receipt.jpg --no-save  # test extraction without writing to sheet
"""

import sys
import os
import base64
import json
import urllib.request
import mimetypes

ENDPOINT_URL = os.environ.get('RECEIPT_ENDPOINT_URL', 'https://koteshwar-ghat-nirman.vercel.app/api/upload-receipt')

def upload_receipt(image_path, auto_save=True, collector="श्री महेंद्र पाटीदार"):
    if not os.path.exists(image_path):
        print(f"Error: File not found: {image_path}")
        sys.exit(1)

    mime_type, _ = mimetypes.guess_type(image_path)
    if not mime_type:
        mime_type = "image/jpeg"

    with open(image_path, "rb") as f:
        img_bytes = f.read()

    b64_data = base64.b64encode(img_bytes).decode("utf-8")
    
    payload = {
        "imageBase64": b64_data,
        "mimeType": mime_type,
        "autoSave": auto_save,
        "collector": collector,
        "collectorUsername": "cli_uploader"
    }

    req = urllib.request.Request(
        ENDPOINT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    print(f"📡 Sending {image_path} to AI Receipt Endpoint: {ENDPOINT_URL} ...")
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)
            print("\n✅ AI Extraction Result:")
            print(json.dumps(result, ensure_ascii=False, indent=2))
            
            ext = result.get("extracted", {})
            print("\n-------------------------------------------")
            print(f"📜 रसीद क्र. (Receipt No)  : {ext.get('receiptNo')}")
            print(f"👤 दानदाता का नाम (Donor)  : {ext.get('donorName')}")
            print(f"🏡 ग्राम / स्थान (Village)  : {ext.get('city')}")
            print(f"💰 राशि (Amount)           : ₹{ext.get('amount')}")
            print(f"📝 स्मृति / विवरण (Notes)  : {ext.get('notes')}")
            print(f"📅 दिनांक (Date)           : {ext.get('date')}")
            print(f"💳 भुगतान माध्यम (Mode)    : {ext.get('paymentMode')}")
            print("-------------------------------------------")
            if result.get("syncedToSheet"):
                print("🟢 Google Sheet में 'Live Collection' में सफलतापूर्वक लाइव सिंक हो गया!")
            else:
                print("ℹ️ Google Sheet में दर्ज नहीं किया गया (autoSave false या त्रुटि)।")

    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8', errors='ignore')
        print(f"❌ HTTP Error {e.code}: {err_msg}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/upload_receipt.py <image_path> [--no-save]")
        sys.exit(1)

    img_file = sys.argv[1]
    auto_save = "--no-save" not in sys.argv
    upload_receipt(img_file, auto_save)
