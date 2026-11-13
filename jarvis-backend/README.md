# JARVIS backend (API only)
Holds the secret keys. The frontend never sees them.

Endpoints: `POST /api/chat` (streams text) · `POST /api/speak` (ElevenLabs voice, returns `audio/mpeg`) · `GET /api/health` · `GET /api/models`

Works on Railway/Render (`npm start` -> server.js) and on Vercel (api/ folder).

Environment variables:
- `GROQ_API_KEY`  (required)
- `ALLOWED_ORIGIN` (required: frontend URL(s), comma-separated, no trailing slash)
- `GROQ_MODEL` (optional)
- `ELEVENLABS_API_KEY` (required for voice)
- `ELEVENLABS_VOICE_ID` (default `eOfixqlnH3y0tByWpp4o`)
- `ELEVENLABS_MODEL_ID` (default `eleven_flash_v2_5`)
- `ELEVENLABS_MAX_CHARS` (optional, default 5000)

Then open `/api/health` — it should show `"keyConfigured":true,"voiceConfigured":true`.

## /api/speak
```
curl -X POST http://localhost:3000/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, I am JARVIS."}' --output test.mp3
```
Errors come back as JSON `{ "error": "..." }`: 400 bad/empty text, 413 too long, 403 origin not allowed,
429 rate limited, 502/503/504 voice service problems. Audio is streamed through and never stored.
