// Vercel Serverless Function: POST /api/chat
// Streams a reply from the Groq API (OpenAI-compatible) as plain text.
// The API key stays on the server (env var) and is never sent to the browser.

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'; // change in Vercel env if Groq retires it
const MAX_MESSAGES = 30;       // history sent to the model
const MAX_CHARS = 8000;        // per message
const MAX_TOKENS = 1500;       // per reply
const WINDOW_MS = 60_000, MAX_REQ = 20;   // best-effort rate limit per IP

const SYSTEM = `You are JARVIS (also called NOVA), a friendly, capable personal AI assistant.
Reply in the same language the user writes in (Arabic or English, etc.).
Be clear and concise. Use Markdown: short paragraphs, lists, and fenced code blocks with a language tag.
If you are not sure about something, say so instead of guessing.`;

const hits = new Map();
function limited(ip) {
  const t = Date.now(), arr = (hits.get(ip) || []).filter(x => t - x < WINDOW_MS);
  arr.push(t); hits.set(ip, arr);
  return arr.length > MAX_REQ;
}

function cors(req, res) {
  // ALLOWED_ORIGIN = comma-separated list of sites allowed to call this API,
  // e.g. https://my-chat.vercel.app,https://nova-web-pearl.vercel.app
  const list = (process.env.ALLOWED_ORIGIN || '').split(',').map(x => x.trim().replace(/\/$/, '')).filter(Boolean);
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  res.setHeader('Vary', 'Origin');
  if (origin && list.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function clean(messages) {
  if (!Array.isArray(messages)) return [];
  let out = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }))
    .slice(-MAX_MESSAGES);
  // merge consecutive same-role messages, and make sure we start with "user"
  const merged = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== 'user') merged.shift();
  return merged;
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.GROQ_API_KEY)
    return res.status(500).json({ error: 'Server is missing GROQ_API_KEY' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Too many requests, slow down a bit.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const messages = clean(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== 'user')
    return res.status(400).json({ error: 'Send at least one user message.' });

  const ac = new AbortController();
  res.on('close', () => ac.abort());   // user pressed Stop / closed the tab

  let upstream;
  try {
    upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, stream: true,
        messages: [{ role: 'system', content: SYSTEM }, ...messages] }),
    });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the AI service.' });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('Groq error', upstream.status, detail);
    return res.status(502).json({ error: 'The AI service returned an error.' });
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });

  const decoder = new TextDecoder();
  let buf = '';
  try {
    for await (const chunk of upstream.body) {
      buf += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data);
          const t = ev.choices?.[0]?.delta?.content;
          if (t) res.write(t);
          if (ev.error) res.write('\n\n[The AI service stopped unexpectedly.]');
        } catch {}
      }
    }
  } catch (e) { /* aborted by client */ }
  res.end();
};
