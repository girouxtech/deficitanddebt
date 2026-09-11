// Deficit and Debt Calculator · Giroux Technologies
// Static server plus one API route that asks Claude for a side-effects summary.
// Zero dependencies apart from the official Anthropic SDK.
//
// Credentials come from the environment, never the client. Either set
// ANTHROPIC_API_KEY (Replit Secrets), or on a host that mints OIDC identity tokens
// set the Workload Identity Federation variables (ANTHROPIC_FEDERATION_RULE_ID,
// ANTHROPIC_ORGANIZATION_ID, ANTHROPIC_SERVICE_ACCOUNT_ID, ANTHROPIC_IDENTITY_TOKEN_FILE)
// and the SDK exchanges the token itself. With neither, the route answers 503 and
// the page hides the feature.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FiscalModel = require('./public/model.js');
const OPTIONS = require('./public/options.js');
const Analysis = require('./public/analysis.js');

let Anthropic = null;
try { Anthropic = require('@anthropic-ai/sdk'); } catch (e) { console.warn('Anthropic SDK not installed; /api/analyze disabled. Run: npm install'); }

const ROOT = path.join(__dirname, 'public');

// True when the SDK's zero-argument client will find a credential: a static key,
// a bearer token, or the full set of Workload Identity Federation variables.
function hasCredentials() {
  const e = process.env;
  if (e.ANTHROPIC_API_KEY || e.ANTHROPIC_AUTH_TOKEN) return true;
  return !!(e.ANTHROPIC_FEDERATION_RULE_ID && e.ANTHROPIC_ORGANIZATION_ID && e.ANTHROPIC_SERVICE_ACCOUNT_ID &&
    (e.ANTHROPIC_IDENTITY_TOKEN_FILE || e.ANTHROPIC_IDENTITY_TOKEN));
}
const PORT = process.env.PORT || 8080;
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon'
};

// ---- Abuse controls: small body, per-IP rate limit, global concurrency cap, short answer cache ----
const MAX_BODY = 16 * 1024;
const RATE = { windowMs: 10 * 60 * 1000, max: 8 };
const hits = new Map();          // ip -> [timestamps]
let inFlight = 0;
const MAX_IN_FLIGHT = 4;
const cache = new Map();         // hash -> { at, data }
const CACHE_TTL = 10 * 60 * 1000;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < RATE.windowMs);
  if (list.length >= RATE.max) { hits.set(ip, list); return true; }
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}
function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleAnalyze(req, res) {
  if (!Anthropic || !hasCredentials()) return send(res, 503, { error: 'Analysis is not configured on this server.' });
  if (req.headers['x-requested-with'] !== 'deficit-calculator') return send(res, 400, { error: 'Bad request.' });
  if (!/^application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Send JSON.' });
  const ip = clientIp(req);
  if (rateLimited(ip)) return send(res, 429, { error: 'Too many requests. Try again in a few minutes.' });

  let body;
  try { body = JSON.parse(await readBody(req, MAX_BODY)); } catch (e) { return send(res, 400, { error: 'Body must be JSON under 16 KB.' }); }

  // Only validated numbers and allowlisted option ids get past this line.
  const v = Analysis.validateRequest(body, OPTIONS);
  if (v.error) return send(res, 400, { error: v.error });

  // The server recomputes the scenario itself; nothing the client computed is trusted.
  const result = FiscalModel.run(v.params);
  const request = Analysis.buildRequest(result, OPTIONS, v.opts);

  const key = crypto.createHash('sha256').update(MODEL + '\n' + request.user).digest('hex');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL) return send(res, 200, { analysis: hit.data, model: MODEL, cached: true });

  if (inFlight >= MAX_IN_FLIGHT) return send(res, 503, { error: 'Busy. Try again in a moment.' });
  inFlight++;
  try {
    const client = new Anthropic({ timeout: 120 * 1000, maxRetries: 1 });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: request.user }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: request.schema } }
    });
    if (response.stop_reason === 'refusal') return send(res, 502, { error: 'Claude declined to analyze this scenario.' });
    if (response.stop_reason === 'max_tokens') return send(res, 502, { error: 'The answer ran too long. Try again.' });
    const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
    const analysis = Analysis.validateAnalysis(parsed);
    if (!analysis) return send(res, 502, { error: 'The answer did not match the expected shape.' });
    cache.set(key, { at: Date.now(), data: analysis });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return send(res, 200, { analysis, model: MODEL, cached: false });
  } catch (err) {
    if (Anthropic && err instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'Claude is rate limited right now. Try again shortly.' });
    if (Anthropic && err instanceof Anthropic.AuthenticationError) return send(res, 503, { error: 'Analysis is misconfigured on this server.' });
    if (Anthropic && err instanceof Anthropic.APIError) { console.error('Claude API error', err.status, err.message); return send(res, 502, { error: 'Claude could not be reached.' }); }
    console.error('analyze failed', err);
    return send(res, 500, { error: 'Something went wrong.' });
  } finally {
    inFlight--;
  }
}

function serveStatic(req, res) {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err2, data) => {
      if (err2) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    });
  });
}

http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/analyze') {
    if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end(); }
    return handleAnalyze(req, res);
  }
  if (url === '/api/status') return send(res, 200, { analysis: !!(Anthropic && hasCredentials()) });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
}).listen(PORT, '0.0.0.0', () => console.log(`Deficit and Debt Calculator on http://0.0.0.0:${PORT}`));
