// Whitespace Hub: staff hub, forms and submissions dashboard.
// Uses Node's built-in HTTP server. Optional packages: pg (Postgres) and nodemailer (email).
const http = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Engine = require('./public/engine.js');
const makeStore = require('./lib/store');
const { notify, taskAssigned } = require('./lib/mail');
const { makeBoard, EMOJIS } = require('./lib/board');
const { makeTodo } = require('./lib/mstodo');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const Content = require('./lib/content');
// Forms and hub content live in the database; these are in-memory copies kept in step with it.
const byId = {};
let HUB = null;
async function initContent() {
  const forms = await store.listForms();
  if (!forms.length) { const seed = Content.seedForms(); await store.saveForms(seed); forms.push(...seed); console.log(`[content] Loaded ${seed.length} starting forms.`); }
  for (const f of forms) byId[f.id] = f;
  HUB = await store.getSetting('hub');
  if (!HUB) {
    const doc = Content.cleanHub(Content.seedHub((await store.getSetting('deptNames')) || {}), new Set(Object.keys(byId)));
    HUB = Object.assign({ version: 1 }, doc);
    await store.setSetting('hub', HUB);
    console.log(`[content] Set up the hub with ${HUB.departments.length} folders.`);
  }
}
const formIndex = () => Object.values(byId).map(f => ({ id: f.id, name: f.name })).sort((a, b) => a.name.localeCompare(b.name));
const store = makeStore();
const board = makeBoard(store);
let todo = null;   // set up once the session secret is known
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

// ---------- accounts and sign-in ----------
const Auth = require('./lib/auth');
const MS = require('./lib/microsoft');
const PASSWORD_LOGIN = process.env.PASSWORD_LOGIN !== 'off' || !MS.enabled;   // never lock everyone out
let SECRET = process.env.SESSION_SECRET || '';
let sessions = null;
async function initAuth() {
  if (!SECRET) {   // keep a stable secret in the database so sign-ins survive restarts
    SECRET = await store.getSetting('sessionSecret');
    if (!SECRET) { SECRET = crypto.randomBytes(32).toString('hex'); await store.setSetting('sessionSecret', SECRET); }
  }
  sessions = Auth.makeSessions(SECRET);
  todo = makeTodo(store, MS, () => SECRET);
  if (MS.problem) console.error('[microsoft] ' + MS.problem);
  console.log(`[auth] Sign in with Microsoft: ${MS.enabled && !MS.problem ? 'on' : 'off'} · email and password: ${PASSWORD_LOGIN ? 'on' : 'off'}`);
  const initialPassword = () => {
    if (!PASSWORD_LOGIN) return { pw: Auth.tempPassword(), microsoft: true };
    const pw = process.env.INITIAL_ADMIN_PASSWORD;
    if (pw && !Auth.passwordProblem(pw)) return { pw, fromSetting: true };
    if (pw) console.warn('[auth] INITIAL_ADMIN_PASSWORD is too weak (use 8+ characters with a number or symbol). Using a one-time password instead.');
    return { pw: Auth.tempPassword(), fromSetting: false };
  };
  const announce = (email, p, why) => console.log(p.microsoft ? `[auth] ${why} ${email}. Sign in with Microsoft using that account.` : p.fromSetting
    ? `[auth] ${why} ${email}. Sign in with the password in INITIAL_ADMIN_PASSWORD, then change it from your account menu.`
    : `[auth] ${why} ${email}. One-time password: ${p.pw}  (sign in, then change it from your account menu)`);
  if ((await store.countUsers()) === 0) {
    const f = Auth.FIRST_ADMIN, p = initialPassword();
    await store.createUser({ email: f.email, name: f.name, role: f.role, passwordHash: Auth.hashPassword(p.pw) });
    announce(f.email, p, 'Created the first admin account:');
  }
  // Make sure these people are admins. Runs once per person, so a later change in Users is respected.
  // Never removes or downgrades anyone. ADMIN_EMAILS (comma-separated) can add more.
  const ADMINS = [{ email: 'jack@skylinewhitespace.com', name: 'Jack Stevens' },
    ...(process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean).map(email => ({ email, name: email.split('@')[0] }))];
  const done = new Set((await store.getSetting('adminsEnsured')) || []);
  for (const a of ADMINS) {
    if (done.has(a.email)) continue;
    const u = await store.getUserByEmail(a.email);
    if (u && u.role !== 'admin') { await store.updateUser(u.id, { role: 'admin' }); console.log(`[auth] ${u.name} (${a.email}) is now an admin.`); }
    else if (!u) {
      const p = initialPassword(); if (p.fromSetting) p.pw = Auth.tempPassword(), p.fromSetting = false;   // never reuse Kai's starting password
      await store.createUser({ email: a.email, name: a.name, role: 'admin', passwordHash: Auth.hashPassword(p.pw) });
      announce(a.email, p, `Created an admin account for ${a.name}:`);
    }
    done.add(a.email);
  }
  await store.setSetting('adminsEnsured', [...done]);
  // Replace the password that older versions had built in, wherever it is still in use.
  for (const u of await store.listUsers()) {
    if (!Auth.isRetiredHash(u.passwordHash)) continue;
    const p = initialPassword();
    await store.updateUser(u.id, { passwordHash: Auth.hashPassword(p.pw), tokenVersion: (u.tokenVersion || 0) + 1 });
    announce(u.email, p, 'Replaced the old built-in password for');
  }
}
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
const COOKIE = 'wsh_session';
const sessionCookie = (req, user) => `${COOKIE}=${encodeURIComponent(sessions.issue(user))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${14 * 86400}${isSecure(req) ? '; Secure' : ''}`;
const clearCookie = `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
async function currentUser(req) {
  if (req._user !== undefined) return req._user;
  const d = sessions.read(readCookie(req, COOKIE));
  let u = d ? await store.getUser(d.u) : null;
  if (u && (u.tokenVersion || 0) !== d.v) u = null;
  return (req._user = u);
}
const pub = u => u && { id: u.id, email: u.email, name: u.name, role: u.role, lastLogin: u.lastLogin || null, createdAt: u.createdAt || null, microsoft: !!u.msOid };
const isAdmin = u => !!u && u.role === 'admin';
const ROLES = ['admin', 'viewer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

async function handleSubmit(req, res, formId, user) {
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
  if (user) answers.unshift({ id: '_by', label: 'Submitted by', type: 'meta', value: `${user.name} (${user.email})` });
  const useful = answers.filter(a => a.value && a.id !== '_by' && !['radio', 'checkbox', 'rating', 'scale', 'dropdown', 'date', 'time', 'datetime'].includes(a.type));
  const summary = (useful.length ? useful : answers.filter(a => a.value && a.id !== '_by')).slice(0, 3).map(a => a.value.replace(/\s+/g, ' ')).join(' · ').slice(0, 240);
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
    CARBON_TRUST_HUB: '1',
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
function proxyCarbon(req, res, user) {
  const headers = Object.assign({}, req.headers);
  for (const k of Object.keys(headers)) if (k.startsWith('x-hub-')) delete headers[k];   // never trust these from the browser
  Object.assign(headers, {
    'x-hub-user-email': user.email,
    'x-hub-user-name': encodeURIComponent(user.name),
    'x-hub-user-role': user.role,
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

// ---------- content editing ----------
const MAX_DOC = 50 * 1024 * 1024;
async function saveHub(doc, by) {
  const clean = Content.cleanHub(doc, new Set(Object.keys(byId)));
  HUB = Object.assign({ version: (HUB.version || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: by }, clean);
  await store.setSetting('hub', HUB);
  tidyDocs().catch(e => console.error('[content] tidy-up failed:', e.message));
  return HUB;
}
// Delete uploaded files nothing links to any more (after an hour, so a fresh upload isn't removed before it's used)
async function tidyDocs() {
  const used = Content.referencedDocIds(HUB), cutoff = Date.now() - 3600e3;
  for (const n of await board.allNews()) { const m = n.image && n.image.match(/^\/files\/([0-9a-f-]{36})\//); if (m) used.add(m[1]); }   // announcement pictures
  for (const d of await store.listDocs()) if (!used.has(d.id) && new Date(d.createdAt).getTime() < cutoff) await store.deleteDoc(d.id);
}
async function contentRoute(req, res, p, m, url) {
  let mt;
  if (p === '/api/admin/content' && m === 'PUT') {
    const body = await readJson(req);
    if (Number(body.version) !== HUB.version) return json(res, 409, { error: 'Someone else changed the hub a moment ago. The latest version has been loaded; make your change again.', hub: HUB });
    return json(res, 200, await saveHub(body, req._user.email));
  }
  if (p === '/api/admin/forms' && m === 'POST') {
    const body = await readJson(req);
    const id = Content.newId('n');
    const src = body.copyOf && byId[body.copyOf];
    const def = src ? Object.assign(JSON.parse(JSON.stringify(src)), { id, name: (String(body.name || '').trim() || src.name + ' (copy)').slice(0, 120) })
      : { id, name: (String(body.name || '').trim() || 'Untitled form').slice(0, 120), fields: [{ id: '1', type: 'head', label: String(body.name || '').trim() || 'Untitled form' }, { id: '2', type: 'fullname', label: 'Your name', required: true }], rules: [] };
    const clean = Content.cleanForm(def);
    await store.saveForm(clean); byId[id] = clean;
    return json(res, 201, clean);
  }
  if ((mt = p.match(/^\/api\/admin\/forms\/([A-Za-z0-9_-]{1,64})$/))) {
    const id = mt[1];
    if (!byId[id]) return json(res, 404, { error: 'This form no longer exists.' });
    if (m === 'PUT') {
      const clean = Content.cleanForm(Object.assign(await readJson(req), { id }));
      await store.saveForm(clean); byId[id] = clean;
      return json(res, 200, clean);
    }
    if (m === 'DELETE') {
      await store.deleteForm(id); delete byId[id];
      const doc = JSON.parse(JSON.stringify(HUB));
      for (const d of doc.departments) for (const s of d.sections) s.items = s.items.filter(it => !(it.kind === 'form' && it.formId === id));
      return json(res, 200, { ok: true, hub: await saveHub(doc, req._user.email) });
    }
  }
  if (p === '/api/admin/files' && m === 'POST') {
    const ct = req.headers['content-type'] || '';
    if (!ct.startsWith('multipart/form-data')) return json(res, 400, { error: 'Choose a file to upload.' });
    let fd;
    try { fd = await new Request('http://local/', { method: 'POST', headers: { 'content-type': ct }, body: await readBody(req, MAX_DOC + 1e6) }).formData(); }
    catch (e) { return json(res, e.code === 'TOO_BIG' ? 413 : 400, { error: e.code === 'TOO_BIG' ? 'That file is over 50 MB. Upload a smaller version, or link to it instead.' : 'The file could not be read.' }); }
    const file = fd.get('file');
    if (!file || typeof file === 'string' || !file.size) return json(res, 400, { error: 'Choose a file to upload.' });
    if (file.size > MAX_DOC) return json(res, 413, { error: 'That file is over 50 MB. Upload a smaller version, or link to it instead.' });
    const filename = String(file.name || 'file').replace(/[\\/\0]/g, '_').slice(0, 200);
    const d = await store.createDoc({ filename, mime: file.type || 'application/octet-stream', buffer: Buffer.from(await file.arrayBuffer()) });
    return json(res, 201, { id: d.id, filename, size: d.size, url: `/files/${d.id}/${encodeURIComponent(filename)}` });
  }
  if (p === '/api/admin/import-docs') {
    if (m === 'POST' && !importJob.running) runImport(req._user.email);
    return json(res, 200, importStatus());
  }
  return json(res, 404, { error: 'Not found' });
}
const SAFE_INLINE = /^(image\/(png|jpeg|gif|webp)|application\/pdf|video\/mp4|text\/plain)$/;
async function serveDoc(req, res, id, url) {
  const f = await store.getDoc(id);
  if (!f) return send(res, 404, 'This file has been removed.');
  const inline = SAFE_INLINE.test(f.mime) && !url.searchParams.has('download');
  res.writeHead(200, Object.assign({}, SEC_HEADERS, { 'Content-Type': inline ? f.mime : 'application/octet-stream', 'Content-Length': f.buffer.length,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.filename)}`, 'Cache-Control': 'private, max-age=86400',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox" }));
  res.end(req.method === 'HEAD' ? undefined : f.buffer);
}

// ---------- copy documents that still live on Jotform into the hub ----------
const IMPORT_HOSTS = (process.env.IMPORT_DOC_HOSTS || 'jotform.com').split(',').map(s => s.trim()).filter(Boolean);
const isImportable = u => { try { const h = new URL(u).hostname; return IMPORT_HOSTS.some(x => h === x || h.endsWith('.' + x)); } catch { return false; } };
const importJob = { running: false, total: 0, done: 0, copied: 0, failed: [], finishedAt: null };
function importStatus() {
  const waiting = []; for (const d of HUB.departments) for (const s of d.sections) for (const it of s.items) if (it.kind === 'doc' && isImportable(it.url)) waiting.push(it.id);
  return Object.assign({ remaining: waiting.length }, importJob);
}
async function runImport(by) {
  Object.assign(importJob, { running: true, total: 0, done: 0, copied: 0, failed: [], finishedAt: null });
  try {
    const todo = [];
    for (const d of HUB.departments) for (const s of d.sections) for (const it of s.items) if (it.kind === 'doc' && isImportable(it.url)) todo.push(it);
    importJob.total = todo.length;
    const moved = {};
    for (const it of todo) {
      try {
        const r = await fetch(it.url, { signal: AbortSignal.timeout(90e3), redirect: 'follow' });
        if (!r.ok) throw new Error(`the file server answered ${r.status}`);
        const len = Number(r.headers.get('content-length') || 0);
        if (len > MAX_DOC) throw new Error('it is over 50 MB, so it stays as a link');
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > MAX_DOC) throw new Error('it is over 50 MB, so it stays as a link');
        let filename = decodeURIComponent(new URL(it.url).pathname.split('/').pop() || 'file');
        filename = filename.replace(/\.[0-9a-f]{12,}\.[0-9]+(?=\.[a-z0-9]+$)/i, '').replace(/-[0-9a-f]{12,}\.[0-9]+(?=\.[a-z0-9]+$)/i, '').replace(/[\\/\0]/g, '_').slice(0, 200);
        const mime = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
        const doc = await store.createDoc({ filename, mime, buffer: buf });
        moved[it.id] = { url: `/files/${doc.id}/${encodeURIComponent(filename)}`, fileName: filename };
        importJob.copied++;
      } catch (e) { importJob.failed.push({ title: it.title, reason: e.name === 'TimeoutError' ? 'it took too long to download' : e.message === 'fetch failed' ? 'it couldn’t be downloaded (the link may be broken)' : e.message }); }
      importJob.done++;
    }
    if (Object.keys(moved).length) {
      const doc = JSON.parse(JSON.stringify(HUB));
      for (const d of doc.departments) for (const s of d.sections) for (const it of s.items) if (moved[it.id]) Object.assign(it, moved[it.id]);
      await saveHub(doc, by);
    }
    console.log(`[content] Copied ${importJob.copied} of ${importJob.total} documents from Jotform.`);
  } catch (e) { console.error('[content] Document copy failed:', e); importJob.failed.push({ title: 'All documents', reason: e.message }); }
  Object.assign(importJob, { running: false, finishedAt: new Date().toISOString() });
}

// Short-lived signed values (used to carry Microsoft sign-in state through the redirect)
const signBlob = obj => { const b = Buffer.from(JSON.stringify(obj)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update('blob:' + b).digest('base64url'); };
function readBlob(v) {
  if (!v || v.indexOf('.') < 0) return null;
  const [b, sig] = v.split('.'), good = crypto.createHmac('sha256', SECRET).update('blob:' + b).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { return JSON.parse(Buffer.from(b, 'base64url').toString()); } catch { return null; }
}
const safeNext = n => (typeof n === 'string' && /^\/(?!\/)/.test(n) && !n.startsWith('/login')) ? n : '/';

// ---------- router ----------
// ---------- announcements as the browser sees them ----------
async function userNames() { return Object.fromEntries((await store.listUsers()).map(u => [u.id, u.name])); }
async function presentNews(n, me, names) {
  names = names || await userNames();
  const reactions = EMOJIS.filter(e => n.reactions && n.reactions[e] && n.reactions[e].length).map(e => ({
    emoji: e, count: n.reactions[e].length, mine: n.reactions[e].includes(me.id), names: n.reactions[e].map(id => names[id] || 'Former colleague') }));
  return { id: n.id, title: n.title, html: n.html !== undefined ? n.html : Content.sanitizeHtml(String(n.body || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>')),
    link: n.link || '', image: n.image || '', pinned: !!n.pinned, topic: n.topic || '', status: n.status || 'published', at: n.at, edited: n.edited || null,
    by: (n.authorId && names[n.authorId]) || n.by, authorId: n.authorId || null, hidden: (n.hiddenBy || []).includes(me.id), reactions,
    reactionCount: reactions.reduce((a, r) => a + r.count, 0) };
}
async function newsFeed(me, { sort, topic, drafts } = {}) {
  const [all, topics, names] = await Promise.all([board.allNews(), board.topics(), userNames()]);
  let list = await Promise.all(all.filter(n => drafts ? n.status === 'draft' : n.status !== 'draft').map(n => presentNews(n, me, names)));
  if (topic) list = list.filter(n => n.topic === topic);
  if (sort === 'oldest') list.sort((a, b) => a.at.localeCompare(b.at));
  else if (sort === 'reacted') list.sort((a, b) => (b.reactionCount - a.reactionCount) || b.at.localeCompare(a.at));
  else list.sort((a, b) => (b.pinned - a.pinned) || b.at.localeCompare(a.at));
  return { news: list, topics, draftCount: isAdmin(me) ? all.filter(n => n.status === 'draft').length : 0 };
}

async function route(req, res) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname, m = req.method;
  let mt;
  if (p === '/healthz') return send(res, 200, 'ok');

  // ----- signing in and out (open to everyone) -----
  if (p === '/api/login-options' && m === 'GET') return json(res, 200, { microsoft: MS.enabled && !MS.problem, password: PASSWORD_LOGIN }, { 'Cache-Control': 'no-cache' });
  if (p === '/auth/microsoft/start' && m === 'GET') {
    if (!MS.enabled || MS.problem) return send(res, 302, '', { Location: '/login?error=ms-off' });
    const { url: to, pending } = MS.start(req, safeNext(url.searchParams.get('next')));
    return send(res, 302, '', { Location: to, 'Set-Cookie': `wsh_ms=${encodeURIComponent(signBlob(pending))}; Path=/auth/microsoft; HttpOnly; SameSite=Lax; Max-Age=600${isSecure(req) ? '; Secure' : ''}` });
  }
  if (p === '/auth/microsoft/callback' && m === 'GET') {
    const clearMs = `wsh_ms=; Path=/auth/microsoft; HttpOnly; SameSite=Lax; Max-Age=0`;
    const back = (code, nxt) => send(res, 302, '', { Location: `/login?error=${code}${nxt && nxt !== '/' ? '&next=' + encodeURIComponent(nxt) : ''}`, 'Set-Cookie': clearMs });
    if (!MS.enabled) return back('ms-off');
    const pending = readBlob(readCookie(req, 'wsh_ms'));
    let who;
    if (pending && pending.k === 'todo') {   // connecting Microsoft To Do for someone already signed in
      const me = await currentUser(req);
      const done = code => send(res, 302, '', { Location: `/?todo=${code}#home`, 'Set-Cookie': clearMs });
      if (!me) return back('ms-expired');
      try { who = await MS.finish(req, url.searchParams, pending); }
      catch (e) { console.error('[mstodo] connect failed:', e.code, e.message); return done(e.code === 'denied' ? 'denied' : e.code === 'todo-scope' ? 'consent' : 'failed'); }
      if (who.email !== me.email && who.oid !== me.msOid) return done('wrong-account');
      await todo.saveTokens(me.id, who.tokens, who.email);
      console.log(`[mstodo] ${me.email} connected Microsoft To Do.`);
      return done('connected');
    }
    try { who = await MS.finish(req, url.searchParams, pending); }
    catch (e) { console.error('[microsoft] sign-in failed:', e.code, e.message); return back(e.code === 'denied' ? 'ms-denied' : e.code === 'tenant' ? 'ms-tenant' : e.code === 'expired' || e.code === 'state' ? 'ms-expired' : 'ms-failed', pending && pending.next); }
    let u = (await store.getUserByMsOid(who.oid)) || (await store.getUserByEmail(who.email));
    if (!u) {
      if (!MS.autoAdd) { console.log(`[microsoft] ${who.email} isn't in Users, so sign-in was refused.`); return back('ms-not-added'); }
      u = await store.createUser({ email: who.email, name: who.name.slice(0, 80), role: 'viewer', passwordHash: Auth.hashPassword(Auth.tempPassword() + Auth.tempPassword()) });
      console.log(`[microsoft] Added ${who.email} as a Viewer on first sign-in.`);
    }
    const f = { lastLogin: new Date().toISOString() };
    if (!u.msOid) f.msOid = who.oid;
    // Fill in the full name from Microsoft 365 when only a first name (or the email) is stored
    if (who.name && who.name.includes(' ') && who.name !== who.email && (!u.name.includes(' ') || u.name === u.email)) f.name = who.name.slice(0, 80);
    await store.updateUser(u.id, f);
    return send(res, 302, '', { Location: safeNext(pending.next), 'Set-Cookie': [sessionCookie(req, u), clearMs] });
  }
  if (p === '/api/login' && m === 'POST') {
    if (!PASSWORD_LOGIN) return json(res, 403, { error: 'Sign in with your Microsoft account.' });
    if (limited(req, 'login', 10, 15 * 60e3)) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes and try again.' });
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase(), pw = String(body.password || '');
    const u = email ? await store.getUserByEmail(email) : null;
    const ok = Auth.verifyPassword(pw, u ? u.passwordHash : Auth.DUMMY_HASH) && !!u;
    if (!ok) return json(res, 401, { error: 'That email or password isn’t right.' });
    await store.updateUser(u.id, { lastLogin: new Date().toISOString() });
    return json(res, 200, { ok: true, user: pub(u) }, { 'Set-Cookie': sessionCookie(req, u) });
  }
  if ((p === '/api/logout' || p === '/api/admin/logout') && m === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie });
  if (p === '/logout') return send(res, 302, '', { Location: '/login', 'Set-Cookie': clearCookie });
  const OPEN = new Set(['/login', '/login.css', '/login.js', '/logo-black.png', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest']);
  if (OPEN.has(p) && (m === 'GET' || m === 'HEAD')) {
    if (p === '/login' && await currentUser(req)) return send(res, 302, '', { Location: safeNext(url.searchParams.get('next')) });
    return serveStatic(req, res, p === '/login' ? '/login.html' : p);
  }

  // ----- everything below needs a signed-in user -----
  const user = await currentUser(req);
  if (!user) {
    if (p.startsWith('/api/')) return json(res, 401, { error: 'Sign in to continue.' });
    if (p.startsWith('/carbon/') && req.method !== 'GET') return send(res, 401, 'Sign in to continue.');
    return send(res, 302, '', { Location: '/login?next=' + encodeURIComponent(p + url.search) });
  }

  if (p === '/carbon') return send(res, 301, '', { Location: '/carbon/' });
  if (p.startsWith('/carbon/')) return proxyCarbon(req, res, user);
  if ((mt = p.match(/^\/api\/forms\/([A-Za-z0-9_-]{1,64})\/submit$/)) && m === 'POST') return handleSubmit(req, res, mt[1], user);

  if (p === '/api/me' && m === 'GET') return json(res, 200, Object.assign(pub(user), { passwordLogin: PASSWORD_LOGIN, microsoftLogin: MS.enabled && !MS.problem }));
  if (p === '/api/me/password' && m === 'POST') {
    if (!PASSWORD_LOGIN) return json(res, 403, { error: 'Passwords are managed by Microsoft. Change yours at mysignins.microsoft.com.' });
    if (limited(req, 'pw', 10, 15 * 60e3)) return json(res, 429, { error: 'Too many attempts. Wait 15 minutes and try again.' });
    const body = await readJson(req);
    if (!Auth.verifyPassword(String(body.current || ''), user.passwordHash)) return json(res, 400, { error: 'Your current password isn’t right.' });
    const problem = Auth.passwordProblem(body.password);
    if (problem) return json(res, 400, { error: problem });
    const tokenVersion = (user.tokenVersion || 0) + 1;
    await store.updateUser(user.id, { passwordHash: Auth.hashPassword(body.password), tokenVersion });
    return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, Object.assign({}, user, { tokenVersion })) });
  }

  // ----- dashboard: my tasks and announcements -----
  if (p === '/api/dashboard' && m === 'GET') {
    const [tasks, feed] = await Promise.all([board.tasksFor(user.id), newsFeed(user, { sort: 'recent' })]);
    const visible = feed.news.filter(n => !n.hidden);
    visible.sort((a, b) => (b.pinned - a.pinned) || b.at.localeCompare(a.at));
    return json(res, 200, { user: pub(user), tasks, news: visible.slice(0, 5), newsTotal: feed.news.length, hiddenCount: feed.news.length - visible.length, topics: feed.topics, emojis: EMOJIS }, { 'Cache-Control': 'no-cache' });
  }
  // ----- Microsoft To Do (each person's own tasks) -----
  if (p === '/auth/microsoft/todo' && m === 'GET') {
    if (!MS.todo || MS.problem) return send(res, 302, '', { Location: '/?todo=off#home' });
    const { url: to, pending } = MS.start(req, '/', { todo: true, loginHint: user.email });
    return send(res, 302, '', { Location: to, 'Set-Cookie': `wsh_ms=${encodeURIComponent(signBlob(pending))}; Path=/auth/microsoft; HttpOnly; SameSite=Lax; Max-Age=600${isSecure(req) ? '; Secure' : ''}` });
  }
  if (p === '/api/mstodo') {
    if (!MS.todo || MS.problem) return json(res, 200, { available: false });
    if (m === 'DELETE') { await todo.disconnect(user.id); return json(res, 200, { available: true, connected: false }); }
    const st = await todo.status(user.id);
    if (!st.connected) return json(res, 200, { available: true, connected: false });
    try { return json(res, 200, Object.assign({ available: true, connected: true, email: st.email }, await todo.tasks(user.id, url.searchParams.has('fresh'))), { 'Cache-Control': 'no-cache' }); }
    catch (e) {
      if (e.code === 'reconnect') return json(res, 200, { available: true, connected: false, expired: true });
      console.error('[mstodo] load failed:', e.message);
      return json(res, 200, { available: true, connected: true, error: 'Couldn’t reach Microsoft To Do just now. Try again in a minute.' });
    }
  }
  if ((p === '/api/mstodo/done' || p === '/api/mstodo/add') && m === 'POST') {
    if (!MS.todo || MS.problem) return json(res, 404, { error: 'Microsoft To Do isn’t set up.' });
    const b = await readJson(req);
    try {
      if (p === '/api/mstodo/done') {
        if (!b.listId || !b.taskId) return json(res, 400, { error: 'Missing task.' });
        await todo.setDone(user.id, String(b.listId), String(b.taskId), b.done !== false); return json(res, 200, { ok: true });
      }
      const title = String(b.title || '').trim().slice(0, 255);
      if (!title) return json(res, 400, { error: 'Write the task.' });
      let listId = String(b.listId || '');
      if (!listId) { const d = await todo.tasks(user.id); listId = (d.lists.find(l => l.isDefault) || d.lists[0] || {}).id; }
      if (!listId) return json(res, 400, { error: 'You don’t have a To Do list yet. Open Microsoft To Do once to create one.' });
      const due = /^\d{4}-\d{2}-\d{2}$/.test(b.due || '') ? b.due : '';
      const t = await todo.add(user.id, listId, title, due);
      return json(res, 201, { id: t.id, listId });
    } catch (e) {
      if (e.code === 'reconnect') return json(res, 409, { error: 'Microsoft needs you to connect To Do again.', reconnect: true });
      console.error('[mstodo] change failed:', e.message);
      return json(res, 502, { error: 'Microsoft To Do didn’t save that. Try again.' });
    }
  }

  // ----- the announcements board (everyone) -----
  if (p === '/api/news' && m === 'GET') {
    const drafts = url.searchParams.get('drafts') === '1' && isAdmin(user);
    return json(res, 200, Object.assign(await newsFeed(user, { sort: url.searchParams.get('sort'), topic: url.searchParams.get('topic'), drafts }), { emojis: EMOJIS }), { 'Cache-Control': 'no-cache' });
  }
  if ((mt = p.match(/^\/api\/news\/([a-z0-9]{1,40})\/(react|hide)$/)) && m === 'POST') {
    const b = await readJson(req);
    try {
      const n = mt[2] === 'react' ? await board.react(mt[1], String(b.emoji || ''), user.id) : await board.hide(mt[1], b.hidden !== false, user.id);
      if (!n) return json(res, 404, { error: 'That announcement has been removed.' });
      return json(res, 200, await presentNews(n, user));
    } catch (e) { if (e instanceof board.Invalid) return json(res, 400, { error: e.message }); throw e; }
  }
  if ((mt = p.match(/^\/api\/tasks\/([a-z0-9]{1,40})\/done$/)) && m === 'POST') {
    const t = await board.setDone(mt[1], (await readJson(req)).done !== false, user, isAdmin(user));
    if (t === null) return json(res, 404, { error: 'That task has been removed.' });
    if (t === false) return json(res, 403, { error: 'That task belongs to someone else.' });
    return json(res, 200, t);
  }
  if (p.startsWith('/api/admin/tasks') || p.startsWith('/api/admin/news')) {
    if (!isAdmin(user)) return json(res, 403, { error: 'Only admins can do that.' });
    try {
      if (p === '/api/admin/tasks' && m === 'GET') {
        const users = await store.listUsers(), names = Object.fromEntries(users.map(u => [u.id, u.name]));
        return json(res, 200, { tasks: (await board.allTasks()).map(t => Object.assign({ assigneeName: names[t.assignee] || 'Removed user' }, t)), people: users.map(u => ({ id: u.id, name: u.name, email: u.email })) });
      }
      if (p === '/api/admin/tasks' && m === 'POST') {
        const b = await readJson(req), who = await store.getUser(Number(b.assignee));
        if (!who) return json(res, 400, { error: 'Choose who the task is for.' });
        const t = await board.createTask(b, user);
        if (who.id !== user.id) taskAssigned(t, who, user.name).catch(e => console.error('[mail] task email failed:', e.message));
        return json(res, 201, t);
      }
      if ((mt = p.match(/^\/api\/admin\/tasks\/([a-z0-9]{1,40})$/))) {
        if (m === 'DELETE') return (await board.deleteTask(mt[1])) ? json(res, 200, { ok: true }) : json(res, 404, { error: 'That task has already been removed.' });
        if (m === 'PUT') {
          const b = await readJson(req);
          if (b.assignee !== undefined && !(await store.getUser(Number(b.assignee)))) return json(res, 400, { error: 'Choose who the task is for.' });
          const before = (await board.allTasks()).find(t => t.id === mt[1]);
          const t = await board.updateTask(mt[1], b);
          if (!t) return json(res, 404, { error: 'That task has been removed.' });
          if (before && before.assignee !== t.assignee && t.assignee !== user.id) store.getUser(t.assignee).then(w => taskAssigned(t, w, user.name)).catch(e => console.error('[mail] task email failed:', e.message));
          return json(res, 200, t);
        }
      }
      if (p === '/api/admin/news-topics' && m === 'PUT') return json(res, 200, { topics: await board.saveTopics((await readJson(req)).topics) });
      const authorOf = async b => { if (b.authorId === undefined) return null; const u = await store.getUser(Number(b.authorId)); if (!u) throw new board.Invalid('Choose who the announcement is from.'); return { id: u.id, name: u.name }; };
      if (p === '/api/admin/news' && m === 'POST') { const b = await readJson(req); const a = await authorOf(b); return json(res, 201, await presentNews(await board.createNews(Object.assign(b, { author: a }), user), user)); }
      if ((mt = p.match(/^\/api\/admin\/news\/([a-z0-9]{1,40})$/))) {
        if (m === 'DELETE') { const gone = await board.deleteNews(mt[1]); tidyDocs().catch(() => {}); return gone ? json(res, 200, { ok: true }) : json(res, 404, { error: 'That announcement has already been removed.' }); }
        if (m === 'PUT') { const b = await readJson(req); const n = await board.updateNews(mt[1], b, await authorOf(b)); return n ? json(res, 200, await presentNews(n, user)) : json(res, 404, { error: 'That announcement has been removed.' }); }
      }
      return json(res, 404, { error: 'Not found' });
    } catch (e) {
      if (e instanceof board.Invalid) return json(res, 400, { error: e.message });
      throw e;
    }
  }

  // ----- hub content (everyone signed in can read it) -----
  if (p === '/api/hub' && m === 'GET') return json(res, 200, HUB, { 'Cache-Control': 'no-cache' });
  if (p === '/api/forms' && m === 'GET') return json(res, 200, formIndex(), { 'Cache-Control': 'no-cache' });
  if ((mt = p.match(/^\/api\/forms\/([A-Za-z0-9_-]{1,64})$/)) && m === 'GET') {
    const f = byId[mt[1]];
    return f ? json(res, 200, f, { 'Cache-Control': 'no-cache' }) : json(res, 404, { error: 'This form no longer exists.' });
  }
  if ((mt = p.match(/^\/files\/([0-9a-f-]{36})(?:\/[^/]*)?$/)) && (m === 'GET' || m === 'HEAD')) return serveDoc(req, res, mt[1], url);

  // ----- editing content (admins) -----
  if (p.startsWith('/api/admin/content') || p.startsWith('/api/admin/forms') || p === '/api/admin/files' || p.startsWith('/api/admin/import-docs')) {
    if (!isAdmin(user)) return json(res, 403, { error: 'Only admins can change the hub.' });
    try { return await contentRoute(req, res, p, m, url); }
    catch (e) { if (e instanceof Content.Invalid) return json(res, 400, { error: e.message }); throw e; }
  }
  if (p === '/api/admin/me') return json(res, 200, { signedIn: isAdmin(user), user: pub(user), storage: store.kind, email: !!process.env.SMTP_HOST, passwordLogin: PASSWORD_LOGIN, microsoftLogin: MS.enabled && !MS.problem, msAutoAdd: MS.autoAdd });
  if (p === '/admin' && !isAdmin(user)) return send(res, 302, '', { Location: '/?notice=admin-only' });

  if (p.startsWith('/api/admin/') && !isAdmin(user)) return json(res, 403, { error: 'Only admins can do that.' });

  // ----- user management (admins) -----
  if (p === '/api/admin/users' && m === 'GET') return json(res, 200, (await store.listUsers()).map(pub));
  if (p === '/api/admin/users' && m === 'POST') {
    const b2 = await readJson(req);
    const email = String(b2.email || '').trim().toLowerCase(), name = String(b2.name || '').replace(/\s+/g, ' ').trim(), role = String(b2.role || 'viewer');
    if (!name) return json(res, 400, { error: 'Enter the person’s name.', field: 'name' });
    if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'Enter an email address like name@skylinewhitespace.com.', field: 'email' });
    if (!ROLES.includes(role)) return json(res, 400, { error: 'Choose Admin or Viewer.', field: 'role' });
    const needsPw = PASSWORD_LOGIN && !(MS.enabled && !b2.password);
    const problem = needsPw ? Auth.passwordProblem(b2.password) : '';
    if (problem) return json(res, 400, { error: problem, field: 'password' });
    if (!PASSWORD_LOGIN) b2.password = Auth.tempPassword() + Auth.tempPassword();
    if (!b2.password) b2.password = Auth.tempPassword() + Auth.tempPassword();
    if (await store.getUserByEmail(email)) return json(res, 409, { error: 'Someone with that email already has an account.', field: 'email' });
    const u = await store.createUser({ email, name: name.slice(0, 80), role, passwordHash: Auth.hashPassword(b2.password) });
    return json(res, 201, pub(u));
  }
  if ((mt = p.match(/^\/api\/admin\/users\/(\d+)$/))) {
    const target = await store.getUser(Number(mt[1]));
    if (!target) return json(res, 404, { error: 'That user no longer exists.' });
    const admins = (await store.listUsers()).filter(u => u.role === 'admin');
    const lastAdmin = target.role === 'admin' && admins.length === 1;
    if (m === 'PATCH') {
      const b2 = await readJson(req), f = {};
      if ('name' in b2) { const n = String(b2.name || '').replace(/\s+/g, ' ').trim(); if (!n) return json(res, 400, { error: 'Enter a name.' }); f.name = n.slice(0, 80); }
      if ('role' in b2) {
        if (!ROLES.includes(b2.role)) return json(res, 400, { error: 'Choose Admin or Viewer.' });
        if (b2.role !== 'admin' && lastAdmin) return json(res, 400, { error: 'There must be at least one admin. Make someone else an admin first.' });
        f.role = b2.role;
      }
      if ('password' in b2) {
        if (!PASSWORD_LOGIN) return json(res, 400, { error: 'Passwords are managed by Microsoft.' });
        const problem = Auth.passwordProblem(b2.password);
        if (problem) return json(res, 400, { error: problem });
        f.passwordHash = Auth.hashPassword(b2.password); f.tokenVersion = (target.tokenVersion || 0) + 1;   // signs them out everywhere
      }
      await store.updateUser(target.id, f);
      return json(res, 200, pub(await store.getUser(target.id)));
    }
    if (m === 'DELETE') {
      if (target.id === user.id) return json(res, 400, { error: 'You can’t remove your own account.' });
      if (lastAdmin) return json(res, 400, { error: 'There must be at least one admin.' });
      await store.deleteUser(target.id);
      return json(res, 200, { ok: true });
    }
  }

  if (p.startsWith('/api/admin/')) {
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
    if ((mt = p.match(/^\/api\/admin\/export\/([A-Za-z0-9_-]{1,64})$/))) return exportCsv(res, mt[1]);
    return json(res, 404, { error: 'Not found' });
  }
  if (m === 'GET' || m === 'HEAD') return serveStatic(req, res, p);
  send(res, 405, 'Method not allowed');
}

const server = http.createServer((req, res) => {
  route(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, 500, { error: 'Something went wrong on the server.' }); });
});
server.requestTimeout = 10 * 60e3;
store.init().then(initAuth).then(initContent).then(() => { if (!process.env.CARBON_URL && process.env.CARBON_AUTOSTART !== '0') startCarbon(); }).then(() => server.listen(PORT, () => console.log(`Whitespace Hub on port ${PORT} (storage: ${store.kind}, email: ${process.env.SMTP_HOST ? 'on' : 'off'})`)))
  .catch(e => { console.error('Could not start storage:', e); process.exit(1); });
