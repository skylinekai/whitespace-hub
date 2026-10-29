// Whitespace Hub: staff hub, forms and submissions dashboard.
// Uses Node's built-in HTTP server. Optional packages: pg (Postgres) and nodemailer (email).
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Engine = require('./public/engine.js');
const makeStore = require('./lib/store');
const { notify } = require('./lib/mail');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const FORMS = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'forms.json'), 'utf8'));
const byId = Object.fromEntries(FORMS.map(f => [f.id, f]));
const store = makeStore();
const MAX_FILE = 25 * 1024 * 1024, MAX_BODY = 200 * 1024 * 1024;

// ---------- helpers ----------
const SEC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin', 'X-Robots-Tag': 'noindex, nofollow' };
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const data = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({}, SEC_HEADERS, { 'Content-Type': isBuf || typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8' }, headers));
  res.end(data);
}
const json = (res, status, obj, headers) => send(res, status, obj, headers);
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too big'), { code: 'TOO_BIG' })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) { try { return JSON.parse((await readBody(req, 1e6)).toString('utf8') || '{}'); } catch { return {}; } }
const clientIp = req => (String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';
const isSecure = req => req.headers['x-forwarded-proto'] === 'https';

// ---------- admin sign-in (one shared password, signed cookie) ----------
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('wsh:' + (process.env.ADMIN_PASSWORD || '')).digest('hex');
const sign = v => v + '.' + crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function isAdmin(req) {
  const c = readCookie(req, 'wsh_admin');
  if (!c || !process.env.ADMIN_PASSWORD) return false;
  const v = c.slice(0, c.lastIndexOf('.'));
  const good = sign(v);
  if (good.length !== c.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(c))) return false;
  return Number(v) > Date.now();
}

// Small in-memory rate limit, keyed by IP and action.
const hits = new Map();
function limited(req, key, max, windowMs) {
  const k = clientIp(req) + key, now = Date.now();
  const h = (hits.get(k) || []).filter(t => now - t < windowMs);
  if (h.length >= max) return true;
  h.push(now); hits.set(k, h); return false;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

// ---------- submitting a form ----------
function answersFor(form, values, visible) {
  return form.fields
    .filter(f => visible.has(f.id) && Engine.INPUT_TYPES.has(f.type) && f.type !== 'file' && f.type !== 'signature')
    .map(f => {
      const v = f.type === 'calculation' ? Engine.calc(form, f, values) : values[f.id];
      return { id: f.id, label: f.label || f.type, type: f.type, value: Engine.display(f, v) };
    });
}

async function handleSubmit(req, res, formId) {
  const form = byId[formId];
  if (!form) return json(res, 404, { error: 'This form no longer exists.' });
  if (limited(req, 'submit', 40, 10 * 60e3)) return json(res, 429, { error: 'Too many submissions from this connection. Wait a few minutes and try again.' });
  const ct = req.headers['content-type'] || '';
  if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'The form data could not be read. Refresh the page and try again.' });
  let fd;
  try {
    const body = await readBody(req, MAX_BODY);
    fd = await new Request('http://local/', { method: 'POST', headers: { 'content-type': ct }, body }).formData();
  } catch (e) {
    return json(res, e.code === 'TOO_BIG' ? 413 : 400, { error: e.code === 'TOO_BIG' ? 'The files are too large in total. Send fewer or smaller files.' : 'The form data could not be read. Refresh the page and try again.' });
  }
  if (fd.get('website')) return json(res, 200, { ok: true, ref: 'WS-00000' }); // spam trap
  let values;
  try { values = JSON.parse(fd.get('data') || '{}'); } catch { return json(res, 400, { error: 'The form data could not be read. Refresh the page and try again.' }); }
  if (!values || typeof values !== 'object' || Array.isArray(values)) values = {};

  const files = [], counts = {};
  for (const [name, val] of fd.entries()) {
    if (!name.startsWith('file_') || typeof val === 'string') continue;
    const fieldId = name.slice(5);
    const field = form.fields.find(x => x.id === fieldId && x.type === 'file');
    if (!field) continue;
    if (val.size > MAX_FILE) return json(res, 413, { error: `${val.name} is over 25 MB. Upload a smaller version.` });
    counts[fieldId] = (counts[fieldId] || 0) + 1;
    files.push({ fieldId, fieldLabel: field.label || 'File upload', filename: String(val.name || 'file').slice(0, 200), mime: val.type || 'application/octet-stream', buffer: Buffer.from(await val.arrayBuffer()) });
  }
  const { errors, visible } = Engine.validate(form, values, counts);
  if (Object.keys(errors).length) return json(res, 422, { error: 'Some answers are missing.', fields: errors });

  for (const f of form.fields.filter(f => f.type === 'signature' && visible.has(f.id))) {
    const m = typeof values[f.id] === 'string' && values[f.id].match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
    if (m) files.push({ fieldId: f.id, fieldLabel: f.label || 'Signature', filename: `signature-${f.id}.png`, mime: 'image/png', buffer: Buffer.from(m[1], 'base64') });
  }
  const kept = files.filter(f => visible.has(f.fieldId));
  const answers = answersFor(form, values, visible);
  const useful = answers.filter(a => a.value && !['radio', 'checkbox', 'rating', 'scale', 'dropdown', 'date', 'time', 'datetime'].includes(a.type));
  const summary = (useful.length ? useful : answers.filter(a => a.value)).slice(0, 3).map(a => a.value.replace(/\s+/g, ' ')).join(' · ').slice(0, 240);
  const search = (form.name + ' ' + answers.map(a => a.value).join(' ')).toLowerCase().slice(0, 20000);
  try {
    const saved = await store.create({ formId: form.id, formName: form.name, summary, answers, search }, kept);
    notify(form, saved, answers, kept).then(r => { if (r && !r.sent) console.log(`No email for ${saved.ref}: ${r.reason}`); }).catch(e => console.error('Email failed:', e.message));
    json(res, 200, { ok: true, ref: saved.ref });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: 'Your answers could not be saved. Try again in a minute.' });
  }
}

// ---------- CSV ----------
async function exportCsv(res, formId) {
  const form = byId[formId];
  if (!form) return send(res, 404, 'Unknown form');
  const rows = await store.all(form.id);
  const cols = form.fields.filter(f => Engine.INPUT_TYPES.has(f.type) && f.type !== 'file' && f.type !== 'signature');
  const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [['Reference', 'Submitted', 'Status', ...cols.map(c => c.label || c.type)].map(q).join(',')];
  for (const r of rows) {
    const map = Object.fromEntries(r.answers.map(a => [a.id, a.value]));
    lines.push([r.ref, new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 16), r.status, ...cols.map(c => map[c.id] ?? '')].map(q).join(','));
  }
  const name = form.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  send(res, 200, '﻿' + lines.join('\r\n'), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.csv"` });
}

// ---------- static files ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res, urlPath) {
  let rel = urlPath === '/' ? '/index.html' : urlPath === '/admin' ? '/admin.html' : urlPath;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, Object.assign({}, SEC_HEADERS, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': /\.(html|json|js|css)$/.test(ext) ? 'no-cache' : 'public, max-age=86400' }));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

// ---------- carbon platform (Python app running alongside, mounted at /carbon) ----------
const CARBON = new URL(process.env.CARBON_URL || 'http://127.0.0.1:5001');
let carbonProblem = '';
// With the Docker setup, start.sh starts the carbon platform and sets CARBON_URL.
// Otherwise (e.g. a plain Node service on Render) the hub starts it itself.
function startCarbon() {
  const { spawn, spawnSync } = require('child_process');
  const dir = path.join(__dirname, 'carbon');
  const py = ['python3', 'python'].find(p => { try { return spawnSync(p, ['--version']).status === 0; } catch { return false; } });
  if (!py) { carbonProblem = 'Python is not installed on this server.'; console.error('[carbon] ' + carbonProblem + ' Deploy with the Docker setup in render.yaml.'); return; }
  const deps = path.join(dir, '.pydeps');
  const env = Object.assign({}, process.env, {
    CARBON_PREFIX: '/carbon',
    PYTHONPATH: [deps, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    DATABASE_PATH: process.env.DATABASE_PATH || (fs.existsSync('/var/data') ? '/var/data/swcarbon.db' : path.join(__dirname, 'data', 'swcarbon.db')),
    SECRET_KEY: process.env.SECRET_KEY || crypto.createHash('sha256').update('swc:' + SECRET).digest('hex')
  });
  fs.mkdirSync(path.dirname(env.DATABASE_PATH), { recursive: true });
  const check = spawnSync(py, ['-c', 'import flask, openpyxl'], { cwd: dir, env });
  if (check.status !== 0) { carbonProblem = 'The carbon platform\'s Python packages are not installed.'; console.error('[carbon] ' + carbonProblem + ' ' + String(check.stderr).trim().split('\n').pop()); return; }
  const hasGunicorn = spawnSync(py, ['-c', 'import gunicorn'], { cwd: dir, env }).status === 0;
  const args = hasGunicorn
    ? ['-m', 'gunicorn', 'app:app', '--workers', '2', '--threads', '4', '--timeout', '200', '--bind', `127.0.0.1:${CARBON.port}`]
    : ['-c', `from app import app; from werkzeug.serving import run_simple; run_simple('127.0.0.1', ${CARBON.port}, app, threaded=True)`];
  let tries = 0;
  const run = () => {
    const child = spawn(py, args, { cwd: dir, env, stdio: 'inherit' });
    console.log(`[carbon] started (${hasGunicorn ? 'gunicorn' : 'built-in server'}), data at ${env.DATABASE_PATH}`);
    carbonProblem = '';
    child.on('exit', code => {
      carbonProblem = `The carbon platform stopped (exit code ${code}).`;
      console.error('[carbon] ' + carbonProblem + ' Restarting…');
      if (++tries < 20) setTimeout(run, Math.min(30e3, 1000 * tries));
    });
    process.on('exit', () => { try { child.kill(); } catch { } });
  };
  run();
}
if (!process.env.CARBON_URL && process.env.CARBON_AUTOSTART !== '0') startCarbon();
function proxyCarbon(req, res) {
  const headers = Object.assign({}, req.headers, {
    'x-forwarded-for': clientIp(req),
    'x-forwarded-proto': isSecure(req) ? 'https' : 'http',
    'x-forwarded-host': req.headers.host || ''
  });
  const up = http.request({ host: CARBON.hostname, port: CARBON.port, method: req.method, path: req.url, headers }, r => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.setTimeout(200e3, () => up.destroy(new Error('timeout')));
  up.on('error', e => {
    console.error('Carbon platform unavailable:', e.message);
    if (res.headersSent) return res.destroy();
    res.writeHead(502, Object.assign({}, SEC_HEADERS, { 'Content-Type': 'text/html; charset=utf-8' }));
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carbon is starting</title>
      <body style="font-family:'Segoe UI',Arial,sans-serif;background:#F0F0F0;margin:0;display:grid;place-items:center;min-height:100vh;color:#242424">
      <div style="background:#fff;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.14);padding:28px;max-width:420px;margin:16px">
      <h1 style="font-size:20px;margin:0 0 8px">The carbon platform isn’t available right now</h1>
      <p style="color:#616161;margin:0 0 16px">${carbonProblem ? carbonProblem.replace(/[<>&]/g, '') + ' Check the server log on Render for details.' : 'It may still be starting up. Wait a few seconds and try again.'}</p>
      <a href="" style="display:inline-block;background:#0F6CBD;color:#fff;padding:7px 14px;border-radius:4px;text-decoration:none;font-weight:600">Try again</a>
      <a href="/" style="margin-left:12px;color:#0F6CBD">Back to the hub</a></div></body>`);
  });
  req.pipe(up);
}

// ---------- router ----------
async function route(req, res) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname, m = req.method;
  let mt;
  if (p === '/healthz') return send(res, 200, 'ok');
  if (p === '/carbon') return send(res, 301, '', { Location: '/carbon/' });
  if (p.startsWith('/carbon/')) return proxyCarbon(req, res);
  if ((mt = p.match(/^\/api\/forms\/(\d+)\/submit$/)) && m === 'POST') return handleSubmit(req, res, mt[1]);

  if (p === '/api/admin/login' && m === 'POST') {
    if (limited(req, 'login', 10, 15 * 60e3)) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes and try again.' });
    const want = process.env.ADMIN_PASSWORD;
    if (!want) return json(res, 503, { error: 'The dashboard password has not been set. Add ADMIN_PASSWORD in Render.' });
    const got = String((await readJson(req)).password || '');
    const a = crypto.createHash('sha256').update(got).digest(), b = crypto.createHash('sha256').update(want).digest();
    if (!crypto.timingSafeEqual(a, b)) return json(res, 401, { error: 'That password is not right.' });
    const days = 14;
    return json(res, 200, { ok: true }, { 'Set-Cookie': `wsh_admin=${encodeURIComponent(sign(String(Date.now() + days * 864e5)))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${isSecure(req) ? '; Secure' : ''}` });
  }
  // Department folder names (renamed from the hub's folder pane; shared by everyone)
  if (p === '/api/dept-names' && m === 'GET') return json(res, 200, (await store.getSetting('deptNames')) || {}, { 'Cache-Control': 'no-cache' });
  if ((mt = p.match(/^\/api\/admin\/dept-names\/([a-z0-9-]{1,60})$/)) && m === 'PUT') {
    if (!isAdmin(req)) return json(res, 401, { error: 'Sign in to Submissions to rename folders.' });
    const name = String((await readJson(req)).name ?? '').replace(/\s+/g, ' ').trim();
    if (name.length > 60) return json(res, 400, { error: 'Keep folder names to 60 characters or fewer.' });
    const names = (await store.getSetting('deptNames')) || {};
    if (name) names[mt[1]] = name; else delete names[mt[1]];   // empty name = back to the original
    await store.setSetting('deptNames', names);
    return json(res, 200, names);
  }
  if (p === '/api/admin/logout' && m === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': 'wsh_admin=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
  if (p === '/api/admin/me') return json(res, 200, { signedIn: isAdmin(req), passwordSet: !!process.env.ADMIN_PASSWORD, storage: store.kind, email: !!process.env.SMTP_HOST });

  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return json(res, 401, { error: 'Sign in to see submissions.' });
    if (p === '/api/admin/summary') return json(res, 200, await store.summary());
    if (p === '/api/admin/submissions' && m === 'GET') {
      const g = k => url.searchParams.get(k) || '';
      return json(res, 200, await store.list({ formId: g('form'), status: g('status'), q: g('q').slice(0, 100), limit: Math.min(Number(g('limit')) || 50, 200), offset: Math.max(0, Number(g('offset')) || 0) }));
    }
    if ((mt = p.match(/^\/api\/admin\/submissions\/(\d+)$/))) {
      const id = Number(mt[1]);
      if (m === 'GET') {
        const s = await store.get(id);
        if (!s) return json(res, 404, { error: 'That submission has been deleted.' });
        if (s.status === 'new') { await store.setStatus(id, 'read'); s.status = 'read'; }
        return json(res, 200, s);
      }
      if (m === 'PATCH') {
        const st = String((await readJson(req)).status);
        if (!['new', 'read', 'done'].includes(st)) return json(res, 400, { error: 'Unknown status.' });
        await store.setStatus(id, st); return json(res, 200, { ok: true });
      }
      if (m === 'DELETE') { await store.remove(id); return json(res, 200, { ok: true }); }
    }
    if ((mt = p.match(/^\/api\/admin\/files\/([0-9a-f-]{36})$/))) {
      const f = await store.file(mt[1]);
      if (!f) return send(res, 404, 'Not found');
      const inline = /^(image\/(png|jpeg|gif|webp)|application\/pdf)$/.test(f.mime) && !url.searchParams.has('download');
      return send(res, 200, f.buffer, { 'Content-Type': inline ? f.mime : 'application/octet-stream', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.filename)}`, 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" });
    }
    if ((mt = p.match(/^\/api\/admin\/export\/(\d+)$/))) return exportCsv(res, mt[1]);
    return json(res, 404, { error: 'Not found' });
  }
  if (m === 'GET' || m === 'HEAD') return serveStatic(req, res, p);
  send(res, 405, 'Method not allowed');
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, 500, { error: 'Something went wrong on the server.' }); });
});
server.requestTimeout = 10 * 60e3;
store.init().then(() => server.listen(PORT, () => console.log(`Whitespace Hub on port ${PORT} (storage: ${store.kind}, email: ${process.env.SMTP_HOST ? 'on' : 'off'})`)))
  .catch(e => { console.error('Could not start storage:', e); process.exit(1); });
