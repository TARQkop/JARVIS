<div align="center">

<img src="jarvis-frontend/images/image-nova-chat.png" alt="JARVIS logo" width="140" />

# JARVIS

**A fast, private, voice-enabled personal AI assistant — Arabic & English.**

Streaming chat powered by [Groq](https://groq.com) · Natural voice replies by [ElevenLabs](https://elevenlabs.io) · Zero-dependency Node backend

![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![Dependencies](https://img.shields.io/badge/backend%20dependencies-0-success)
![Frontend](https://img.shields.io/badge/frontend-vanilla%20JS-F7DF1E?logo=javascript&logoColor=black)
![Deploy](https://img.shields.io/badge/deploy-Railway%20%7C%20Render%20%7C%20Vercel%20%7C%20GitHub%20Pages-blue)

</div>

---

## Overview

JARVIS (also called **NOVA**) is a personal AI assistant split into two independent parts:

| Part | Folder | Role |
|------|--------|------|
| **Backend** | [`jarvis-backend/`](jarvis-backend) | Thin API layer that holds all secret keys, streams AI replies and proxies text-to-speech. |
| **Frontend** | [`jarvis-frontend/`](jarvis-frontend) | A single static page (`nova-chat.html`) — no build step, no framework. |

The browser **never sees an API key**. It only talks to your backend, which is locked down to the origins you allow.

## Features

**Chat**
- Real-time **streaming** responses with a Stop button
- Full **Markdown** rendering with syntax-highlighted, copyable code blocks (line numbers, wrap toggle)
- Multiple conversations with **search**, rename and date grouping (Today / Yesterday / Previous 7 days / Older)
- Dark & light themes, responsive layout, keyboard shortcuts
- Replies in the **same language** you write in (Arabic or English)
- Chats and preferences stored locally in your browser (`localStorage`) — nothing is saved server-side

**Voice**
- **Voice replies** — JARVIS reads answers aloud through ElevenLabs
- **Hands-free conversation mode** — you speak → JARVIS answers → JARVIS speaks → it listens again
- Speech recognition in Arabic (`ar-IQ`) and English (`en-US`) with a one-tap language switch

**Backend**
- **No runtime dependencies** — plain Node.js, works as a standalone server or as Vercel serverless functions
- **Automatic model fallback** — if the configured Groq model is retired, the best available one is selected
- Strict **CORS allow-list**, per-IP **rate limiting**, request size limits and input sanitising
- Voice audio is **streamed straight through and never stored**

## Architecture

```
┌──────────────────┐   POST /api/chat    ┌──────────────────┐        ┌──────────────┐
│                  │ ──────────────────▶ │                  │ ─────▶ │  Groq API    │
│    Frontend      │ ◀── text stream ─── │     Backend      │ ◀───── │  (LLM)       │
│  (static page)   │                     │  (holds secrets) │        └──────────────┘
│                  │   POST /api/speak   │                  │        ┌──────────────┐
│                  │ ──────────────────▶ │                  │ ─────▶ │  ElevenLabs  │
│                  │ ◀── audio/mpeg ──── │                  │ ◀───── │  (TTS)       │
└──────────────────┘                     └──────────────────┘        └──────────────┘
```

## Project structure

```
JARVIS-split/
├── .github/workflows/pages.yml   # Deploys the frontend to GitHub Pages
├── jarvis-backend/
│   ├── api/
│   │   ├── chat.js               # POST /api/chat   – streams Groq replies
│   │   ├── speak.js              # POST /api/speak  – ElevenLabs TTS proxy
│   │   └── health.js             # GET  /api/health – configuration check
│   ├── server.js                 # Standalone Node server (Railway / Render / any host)
│   ├── vercel.json               # Vercel function settings
│   ├── .env.example              # Environment variable template
│   └── package.json
└── jarvis-frontend/
    ├── nova-chat.html            # The whole app (HTML + CSS + JS)
    ├── config.js                 # Backend URL (no secrets)
    ├── vercel.json               # Serves nova-chat.html at "/"
    ├── icons/ images/ svg/       # Static assets
    └── test.mp3
```

## Quick start (local)

**Requirements:** Node.js 18+, a [Groq API key](https://console.groq.com/keys) and, optionally, an [ElevenLabs API key](https://elevenlabs.io) for voice.

### 1. Run the backend

```bash
cd jarvis-backend
cp .env.example .env        # then edit .env and add your keys
npm start                   # → http://localhost:3000
```

Minimal `.env` for local use:

```env
GROQ_API_KEY=your-groq-key
ALLOWED_ORIGIN=http://localhost:5500
ELEVENLABS_API_KEY=your-elevenlabs-key   # optional – enables voice
```

Verify it is configured:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"keyConfigured":true,"voiceConfigured":true}
```

### 2. Run the frontend

Point the frontend to your backend in [`jarvis-frontend/config.js`](jarvis-frontend/config.js):

```js
window.NOVA_API_URL = 'http://localhost:3000';
```

Then serve the folder with any static server and open it in the browser:

```bash
cd jarvis-frontend
npx serve -l 5500           # or: python3 -m http.server 5500
# open http://localhost:5500/nova-chat.html
```

> If `NOVA_API_URL` is empty, the UI runs in **Demo mode** with simulated replies.

## Configuration

All settings live in environment variables on the backend (see [`.env.example`](jarvis-backend/.env.example)).

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `GROQ_API_KEY` | ✅ | — | Groq API key used for chat. |
| `ALLOWED_ORIGIN` | ✅ | — | Frontend URL(s) allowed to call the API. Comma-separated, **no trailing slash**. |
| `GROQ_MODEL` | | `llama-3.3-70b-versatile` | Preferred chat model. Falls back automatically if unavailable. |
| `ELEVENLABS_API_KEY` | for voice | — | ElevenLabs API key. |
| `ELEVENLABS_VOICE_ID` | | `eOfixqlnH3y0tByWpp4o` | Voice used for replies. |
| `ELEVENLABS_MODEL_ID` | | `eleven_flash_v2_5` | TTS model (low latency). |
| `ELEVENLABS_MAX_CHARS` | | `5000` | Maximum characters per voice request. |
| `ELEVENLABS_OUTPUT_FORMAT` | | `mp3_44100_128` | Audio output format. |
| `PORT` | | `3000` | Port for the standalone server. |

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Streams an AI reply as `text/plain`. Body: `{ "messages": [{ "role": "user", "content": "Hi" }] }` |
| `POST` | `/api/speak` | Converts text to speech. Body: `{ "text": "Hello" }` → returns `audio/mpeg`. |
| `GET` | `/api/health` | Reports whether the AI and voice keys are configured. |
| `GET` | `/api/models` | Lists chat models available to your Groq account (standalone server). |

**Examples**

```bash
# Chat (streamed)
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello!"}]}'

# Text-to-speech
curl -X POST http://localhost:3000/api/speak \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, I am NOVA."}' --output test.mp3
```

**Error responses** are JSON — `{ "error": "..." }`:

| Status | Meaning |
|:------:|---------|
| `400` | Invalid or empty input |
| `403` | Origin not allowed |
| `405` | Method not allowed |
| `413` | Text too long |
| `429` | Rate limited |
| `502` / `503` / `504` | AI or voice provider problem (bad key, quota, unreachable) |

**Limits:** chat — 20 requests/min per IP, last 30 messages, 8,000 chars per message, 1,500 tokens per reply · voice — 12 requests/min per IP, 5,000 chars per request.

## Deployment

Deploy the backend first, then the frontend, then connect them.

### 1. Backend — Railway / Render / Vercel

- **Railway / Render:** create a service from the `jarvis-backend/` folder. Start command: `npm start`.
- **Vercel:** import the repository with `jarvis-backend` as the root directory. The `api/` folder is picked up automatically.

Add the environment variables (`GROQ_API_KEY`, `ALLOWED_ORIGIN`, and the ElevenLabs ones for voice), then open `/api/health` and confirm `"keyConfigured": true` (and `"voiceConfigured": true`).

### 2. Frontend — Vercel or GitHub Pages

1. Set your backend URL in `jarvis-frontend/config.js`.
2. Deploy `jarvis-frontend/`:
   - **Vercel:** import with `jarvis-frontend` as the root directory (`vercel.json` already serves the app at `/`).
   - **GitHub Pages:** enable *Settings → Pages → Source: GitHub Actions*. Pushes to `main` that touch `jarvis-frontend/**` deploy automatically via [`pages.yml`](.github/workflows/pages.yml).

### 3. Connect them

Add the frontend's public URL to `ALLOWED_ORIGIN` on the backend and **redeploy the backend**. Without this step the browser will be blocked by CORS.

### 4. Enable voice

Make sure `/api/health` shows `"voiceConfigured": true`, then turn on the speaker icon in the chat header (or **Settings → Voice replies**).

## Security notes

- API keys exist **only** as server environment variables — never in the frontend or the repository. `.env` is git-ignored.
- Only origins in `ALLOWED_ORIGIN` receive CORS headers; `/api/speak` additionally rejects browser requests from other origins.
- The browser cannot choose the voice or model; both are fixed on the server.
- Rate limiting is **best-effort and in-memory** (per instance). For production traffic, add a shared limiter or a gateway in front.
- Don't commit real URLs or keys to `.env.example`.

## Tech stack

- **Backend:** Node.js 18+ (native `fetch`, no packages), Groq OpenAI-compatible API, ElevenLabs Text-to-Speech
- **Frontend:** HTML / CSS / vanilla JavaScript, [Lucide](https://lucide.dev) icons, [highlight.js](https://highlightjs.org), Web Speech API, Inter & JetBrains Mono fonts
- **Hosting:** Railway, Render, Vercel, GitHub Pages

## Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| UI says **Demo** / replies are simulated | `NOVA_API_URL` in `config.js` is empty or wrong. |
| Browser console shows a **CORS** error | The frontend URL is missing from `ALLOWED_ORIGIN` (no trailing slash), or the backend wasn't redeployed. |
| `keyConfigured: false` | `GROQ_API_KEY` is not set on the backend. |
| `voiceConfigured: false` / voice errors | Set `ELEVENLABS_API_KEY`; check voice ID and remaining quota. |
| Voice doesn't autoplay | Browsers require a tap first — press play when prompted. |
| Microphone doesn't work | Speech recognition needs a supported browser (Chrome / Edge / Safari), HTTPS or `localhost`, and mic permission. |

## License

No license file is included yet. Add one (for example [MIT](https://choosealicense.com/licenses/mit/)) before publishing the project publicly.