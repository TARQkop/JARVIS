// POST /api/speak  —  ElevenLabs Text-to-Speech proxy.
// Body: { "text": "..." }  ->  200 audio/mpeg (streamed, never written to disk)
// The ElevenLabs key stays on the server (env var) and is never sent to the browser.
// Voice and model are fixed by env vars; the browser cannot choose them.

const ELEVEN = (process.env.ELEVENLABS_API_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
const DEFAULT_VOICE = 'eOfixqlnH3y0tByWpp4o';
const DEFAULT_MODEL = 'eleven_flash_v2_5';
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';
const MAX_TEXT_CHARS = Number(process.env.ELEVENLABS_MAX_CHARS) > 0 ? Number(process.env.ELEVENLABS_MAX_CHARS) : 5000;
const UPSTREAM_TIMEOUT_MS = 20_000;               // time allowed until ElevenLabs starts answering
const WINDOW_MS = 60_000, MAX_REQ = 12;           // best-effort rate limit per IP (TTS costs credits)

const hits = new Map();
function limited(ip) {
  const t = Date.now(), arr = (hits.get(ip) || []).filter(x => t - x < WINDOW_MS);
  arr.push(t); hits.set(ip, arr);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.some(x => t - x < WINDOW_MS)) hits.delete(k);
  return arr.length > MAX_REQ;
}

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGIN || '').split(',').map(x => x.trim().replace(/\/$/, '')).filter(Boolean);
}

// Same CORS policy as /api/chat: only the sites listed in ALLOWED_ORIGIN may call this from a browser.
function cors(req, res) {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  res.setHeader('Vary', 'Origin');
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b || '{}'); } catch { return null; } }
  return b && typeof b === 'object' && !Array.isArray(b) ? b : null;
}

// Turn an ElevenLabs failure into a safe message for the browser (details only go to the server log).
function mapUpstreamError(status, detail) {
  let code = '';
  try { const d = JSON.parse(detail).detail; code = String((d && (d.status || d.code)) || ''); } catch {}
  if (/quota/i.test(code) || /quota_exceeded/i.test(detail)) return [503, 'The voice quota has been used up.'];
  if (status === 401 || status === 403) return [502, 'The voice key was rejected. Check ELEVENLABS_API_KEY on the server.'];
  if (status === 404) return [502, 'Voice not found. Check ELEVENLABS_VOICE_ID on the server.'];
  if (status === 429) return [429, 'The voice service is busy right now. Try again in a moment.'];
  if (status === 400 || status === 422) return [502, 'The voice service could not read that text.'];
  return [502, 'The voice service returned an error.'];
}

const handler = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(405).json({ error: 'Method not allowed' }); }

  // Browsers always send Origin on cross-origin POSTs; refuse sites that are not on the allow-list.
  // (Requests with no Origin, e.g. curl, are still accepted so you can test — they are rate limited.)
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  if (origin && !allowedOrigins().includes(origin)) return res.status(403).json({ error: 'Origin not allowed.' });

  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;
  if (!key) return res.status(503).json({ error: 'Voice is not configured on the server.' });
  if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) return res.status(503).json({ error: 'Voice is misconfigured on the server.' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (limited(ip)) { res.setHeader('Retry-After', '10'); return res.status(429).json({ error: 'Too many voice requests, slow down a bit.' }); }

  const body = parseBody(req);
  if (!body) return res.status(400).json({ error: 'Send a JSON body like {"text":"..."}.' });
  if (typeof body.text !== 'string') return res.status(400).json({ error: '"text" must be a string.' });
  const text = body.text.replace(/\u0000/g, '').trim();
  if (!text) return res.status(400).json({ error: 'Text is empty.' });
  if (!/[\p{L}\p{N}]/u.test(text)) return res.status(400).json({ error: 'There is nothing speakable in that text.' });
  if (text.length > MAX_TEXT_CHARS) return res.status(413).json({ error: `Text is too long (max ${MAX_TEXT_CHARS} characters).` });

  const ac = new AbortController();
  res.on('close', () => ac.abort());                         // listener pressed Stop / closed the tab
  const timer = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);

  let upstream;
  try {
    upstream = await fetch(`${ELEVEN}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=${encodeURIComponent(OUTPUT_FORMAT)}`, {
      method: 'POST',
      signal: ac.signal,
      headers: { 'xi-api-key': key, 'content-type': 'application/json', 'accept': 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: modelId }),
    });
  } catch (e) {
    clearTimeout(timer);
    if (res.destroyed) return;                               // client already left
    console.error('ElevenLabs unreachable:', e && e.name);
    return res.status(504).json({ error: 'Could not reach the voice service.' });
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    const detail = (await upstream.text().catch(() => '')).slice(0, 500);
    console.error('ElevenLabs error', upstream.status, detail);
    const [code, msg] = mapUpstreamError(upstream.status, detail);
    if (code === 429) res.setHeader('Retry-After', upstream.headers.get('retry-after') || '5');
    return res.status(code).json({ error: msg });
  }

  res.writeHead(200, {
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Accel-Buffering': 'no',
  });
  try {
    for await (const chunk of upstream.body) {                // piped straight through, nothing is stored
      if (res.destroyed) break;
      if (!res.write(chunk)) await new Promise(r => { res.once('drain', r); res.once('close', r); });
    }
  } catch { /* upstream aborted or client left */ }
  res.end();
};

module.exports = handler;
