# app.py
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Sample data based on provided donation information
PROJECTED_SPENDING = 200000  # अनुमानित खर्च

DONATIONS = [
    {"village": "नगर कुक्षी", "amount": 146221},
    {"village": "ग्राम सुसारी", "amount": 91776},
]

TOTAL_ANNOUNCED = sum(d["amount"] for d in DONATIONS)  # घोषण राशि
TOTAL_RECEIVED = TOTAL_ANNOUNCED  # मान लिया गया कि सभी प्राप्त हुए
TOTAL_SPENT = 50000  # उदाहरण के लिये अभ्यस्त खर्च

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/summary')
def summary():
    return jsonify({
        "projected_spending": PROJECTED_SPENDING,
        "total_announced": TOTAL_ANNOUNCED,
        "total_received": TOTAL_RECEIVED,
        "total_spent": TOTAL_SPENT,
        "donations": DONATIONS,
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
