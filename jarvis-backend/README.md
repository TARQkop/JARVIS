# JARVIS backend (API only)
Holds the secret key. The frontend never sees it.

Endpoints: `POST /api/chat` (streams text) · `GET /api/health`

Works on Railway/Render (`npm start` -> server.js) and on Vercel (api/ folder).

Environment variables:
- `GROQ_API_KEY`  (required)
- `ALLOWED_ORIGIN` (required: frontend URL(s), comma-separated, no trailing slash)
- `GROQ_MODEL` (optional)
Then open `/api/health` — it should show `"keyConfigured":true`.
