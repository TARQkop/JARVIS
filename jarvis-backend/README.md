# JARVIS backend (API only)
Holds the secret key. The frontend never sees it.

Endpoints: `POST /api/chat` (streams text) · `GET /api/health`

Deploy as its own Vercel project, then set Environment Variables:
- `GROQ_API_KEY`  (required)
- `ALLOWED_ORIGIN` (required: the frontend URL(s), comma-separated)
- `GROQ_MODEL` (optional)
Redeploy, then open `/api/health` — it should show `"keyConfigured":true`.
