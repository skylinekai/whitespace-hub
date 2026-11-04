// "Sign in with Microsoft" (Microsoft Entra ID, OpenID Connect authorization code flow with PKCE).
// Two-factor, Authenticator, Face ID / fingerprint etc. are handled by Microsoft, based on your
// company's Entra ID security settings. This app only receives the signed-in person's identity.
const crypto = require('crypto');

const TENANT = (process.env.MS_TENANT_ID || '').trim();
const CLIENT_ID = (process.env.MS_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.MS_CLIENT_SECRET || '').trim();
const LOGIN_HOST = (process.env.MS_LOGIN_HOST || 'https://login.microsoftonline.com').replace(/\/$/, '');
const enabled = !!(TENANT && CLIENT_ID && CLIENT_SECRET);
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const problem = !enabled ? '' : !GUID.test(TENANT) ? 'MS_TENANT_ID must be your Directory (tenant) ID, which looks like 1b2c3d4e-…, not "common" or a domain.'
  : !GUID.test(CLIENT_ID) ? 'MS_CLIENT_ID must be the Application (client) ID from the app registration.' : '';

const b64url = buf => Buffer.from(buf).toString('base64url');

function redirectUri(req) {
  const base = (process.env.PUBLIC_URL || '').replace(/\/$/, '')
    || `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  return base + '/auth/microsoft/callback';
}

// Start: returns { url, pending } — pending is stored (signed) in a short-lived cookie.
const TODO_SCOPE = 'openid profile email offline_access Tasks.ReadWrite';
function start(req, next, { todo = false, loginHint = '' } = {}) {
  const state = b64url(crypto.randomBytes(24)), nonce = b64url(crypto.randomBytes(24)), verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const q = new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: redirectUri(req), response_mode: 'query',
    scope: todo ? TODO_SCOPE : 'openid profile email', state, nonce, code_challenge: challenge, code_challenge_method: 'S256'
  });
  if (todo && loginHint) q.set('login_hint', loginHint); else q.set('prompt', 'select_account');
  return { url: `${LOGIN_HOST}/${TENANT}/oauth2/v2.0/authorize?${q}`, pending: { s: state, n: nonce, v: verifier, next, e: Date.now() + 10 * 60e3, k: todo ? 'todo' : 'login' } };
}

// Finish: exchanges the code and returns { email, name, oid }. Throws an Error with .code on failure.
async function finish(req, params, pending) {
  const fail = (code, detail) => Object.assign(new Error(detail || code), { code });
  if (params.get('error')) throw fail(params.get('error') === 'access_denied' ? 'denied' : 'microsoft', params.get('error_description') || params.get('error'));
  if (!pending || pending.e < Date.now()) throw fail('expired');
  if (!params.get('state') || params.get('state') !== pending.s) throw fail('state');
  const body = new URLSearchParams({
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'authorization_code', code: params.get('code') || '',
    redirect_uri: redirectUri(req), code_verifier: pending.v, scope: pending.k === 'todo' ? TODO_SCOPE : 'openid profile email'
  });
  let tok;
  try {
    const r = await fetch(`${LOGIN_HOST}/${TENANT}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) });
    tok = await r.json();
    if (!r.ok) throw fail('token', tok.error_description || tok.error || `HTTP ${r.status}`);
  } catch (e) { throw e.code ? e : fail('token', e.message); }
  // The ID token came straight from Microsoft over HTTPS in exchange for our client secret,
  // so its claims can be trusted after these checks (OpenID Connect Core 3.1.3.7).
  let c;
  try { c = JSON.parse(Buffer.from(String(tok.id_token).split('.')[1], 'base64url').toString()); } catch { throw fail('token', 'No ID token'); }
  const now = Date.now() / 1000;
  if (c.aud !== CLIENT_ID) throw fail('token', 'Wrong audience');
  if (c.tid !== TENANT || c.iss !== `${LOGIN_HOST}/${TENANT}/v2.0`) throw fail('tenant');
  if (c.nonce !== pending.n) throw fail('state', 'Nonce mismatch');
  if (!(c.exp > now - 300)) throw fail('expired');
  const email = String(c.email || c.preferred_username || c.upn || '').trim().toLowerCase();
  if (!email || !c.oid) throw fail('token', 'No email or account ID');
  const out = { email, name: String(c.name || email).trim(), oid: String(c.oid) };
  if (pending.k === 'todo') {
    if (!tok.refresh_token || !/Tasks\.ReadWrite/i.test(tok.scope || '')) throw fail('todo-scope', 'Microsoft didn’t grant access to To Do');
    out.tokens = { access: tok.access_token, refresh: tok.refresh_token, exp: Date.now() + (Number(tok.expires_in) || 3600) * 1000 };
  }
  return out;
}

// Swap a refresh token for a new access token (Microsoft may also hand back a new refresh token).
async function refresh(rt) {
  const body = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: rt, scope: 'offline_access Tasks.ReadWrite' });
  const r = await fetch(`${LOGIN_HOST}/${TENANT}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(15000) });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(tok.error_description || tok.error || `HTTP ${r.status}`), { code: tok.error === 'invalid_grant' || tok.error === 'interaction_required' ? 'reconnect' : 'microsoft' });
  return { access: tok.access_token, refresh: tok.refresh_token || rt, exp: Date.now() + (Number(tok.expires_in) || 3600) * 1000 };
}

module.exports = { enabled, problem, start, finish, refresh, autoAdd: process.env.MS_AUTO_ADD !== '0', todo: enabled && process.env.MS_TODO !== 'off' };
