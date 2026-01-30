# Python Lab (local only)

These scripts are for **local OpenCV experiments**.

Netlify (static hosting) cannot run Python for real-time webcam inference, so the production demos are in `/src`.

## Setup

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python neon_hand.py
```
