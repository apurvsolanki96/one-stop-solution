# One-Stop NOTAM Parser (Online + Offline)

A unified NOTAM processing system designed for aviation use.  
Supports **AI-powered online parsing** via the backend API and **fully offline parsing** in the browser using pure JavaScript.

This project is optimized for deployment on **Render.com** and includes:
- Backend (FastAPI + Uvicorn)
- Offline JavaScript NOTAM parser
- Automatic fallback to offline mode if backend is unavailable
- A clean HTML/JS frontend with two parsing paths: online + offline
- Dockerfile for production deployment
- Pytest suite for validating offline parsing accuracy

---

## 🚀 Features

### ✔ Online Mode (AI-Enabled)
- FastAPI backend with multiple AI providers (OpenAI, Copilot, fallback engine).
- Robust route extraction logic.
- Automatic integration with frontend via `/process-notam`.

### ✔ Offline Mode (No Internet Needed)
- Pure JavaScript parser inside `docs/offline-parser.js`
- Extracts:
  - Airways (L736, W187, N5, etc.)
  - Segment descriptions
  - Flight levels (`FLxxx-FLyyy`)
  - Meters → FL conversion using conservative floor rounding
- Auto-used whenever the backend API is unreachable
- User is notified via a small banner: *(“Offline mode: simplified parser output.”)*

### ✔ Test Suite (Optional)
- A Python version of the offline parser exists:  
  `tools/offline_parser_py.py`
- Test coverage via:
backend/ FastAPI backend, AI providers, route logic
docs/ Frontend (index.html + scripts)
├── index.html
├── script.js
├── offline-parser.js
tools/
└── offline_parser_py.py Python test port of offline parser
tests/
└── test_offline_parser.py
Dockerfile Deployment image for Render
render.yaml (Optional) Render configuration
awy outputs only.txt Reference NOTAM samples + expected outputs


---

## 🐳 Deploying on Render (Recommended)

### Option 1 — Deploy via Dockerfile (Simplest)
Render will auto-detect the root `Dockerfile`.

1. Create a new **Web Service**
2. Select **Docker** environment
3. Point to your repo
4. Render will automatically:
   - Install requirements
   - Start FastAPI with Uvicorn
5. Add environment variables (if using AI features):
   - `OPENAI_API_KEY`
   - `COPILOT_API_KEY` (optional)

### Option 2 — Native Build (No Docker)
Build Command:
