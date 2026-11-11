# JARVIS – split project
- `jarvis-backend/`  → Vercel project #1 (API + secret key)
- `jarvis-frontend/` → Vercel project #2 (static chat page)

1. Deploy backend, add GROQ_API_KEY + ALLOWED_ORIGIN, check /api/health.
2. Put the backend URL in jarvis-frontend/config.js, deploy frontend.
3. Put the frontend URL into ALLOWED_ORIGIN of the backend and redeploy it.

## Voice (ElevenLabs)
Backend env: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` (see `jarvis-backend/.env.example`).
Check `/api/health` shows `"voiceConfigured":true`, then turn on the speaker icon in the chat header.
