// Standalone Node server (for Railway / Render / any host). No dependencies.
const http = require('http');
const chat = require('./api/chat.js');
const health = require('./api/health.js');
const speak = require('./api/speak.js');

// Tiny .env loader for local runs (no dependency). Real environment variables always win,
// and on Railway/Vercel there is no .env file, so this does nothing there.
try {
  for (const line of require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
} catch { /* no .env file */ }

const MAX_BODY = 200_000; // bytes

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0, data = '';
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); } else data += c; });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

http.createServer(async (req, res) => {
  // small Express-like helpers used by the handlers
  res.status = c => { res.statusCode = c; return res; };
  res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };

  const path = (req.url || '/').split('?')[0];
  try {
    if (path === '/api/chat') {
      if (req.method === 'POST') {
        try { req.body = await readJson(req); } catch { return res.status(400).json({ error: 'Invalid or too large body' }); }
      }
      return await chat(req, res);
    }
    if (path === '/api/speak') {
      if (req.method === 'POST') {
        try { req.body = await readJson(req); } catch { return res.status(400).json({ error: 'Invalid or too large body' }); }
      }
      return await speak(req, res);
    }
    if (path === '/api/models') {
      try { return res.json({ models: await chat.listChatModels() }); }
      catch { return res.status(502).json({ error: 'Could not list models (check GROQ_API_KEY).' }); }
    }
    if (path === '/api/health' || path === '/') return health(req, res);
    res.status(404).json({ error: 'Not found' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' }); else res.end();
  }
}).listen(process.env.PORT || 3000, '0.0.0.0', () => console.log('JARVIS backend listening on', process.env.PORT || 3000));
