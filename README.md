NOTAM Parser — Offline Fallback

Files:
- index.html
- notam-parser.js

Purpose:
- A self-contained client-side NOTAM parsing tool to use when backend or AI services are unavailable.
- Runs entirely in the user's browser; no network calls, no modification of backend code.

How to use:
1) Put both files in the same folder.
2) Open index.html in a modern browser (Chrome, Edge, Firefox, Safari).
3) Paste NOTAM text into the box or click "Load .txt" to open a local .txt file.
4) Click "Parse" to extract fields; click "Export CSV" to download results.

Safety notes:
- This fallback is intentionally conservative and heuristic-based. It will not cover every national NOTAM format. Test it with your real NOTAM samples.
- Do NOT overwrite or place these files inside your backend deployment directories. They are offline utilities only.

Extending:
- If you share 3–10 real NOTAM lines (redact sensitive info), the parser regexes can be hardened to your exact format.
