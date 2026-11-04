// Accounts and sessions: scrypt password hashes and a signed, expiring session cookie.
const crypto = require('crypto');

const N = 16384, KEYLEN = 64;
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, KEYLEN, { N });
  return `scrypt$${N}$${salt.toString('hex')}$${key.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [kind, n, saltHex, keyHex] = String(stored).split('$');
    if (kind !== 'scrypt') return false;
    const key = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), KEYLEN, { N: Number(n) });
    return crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
  } catch { return false; }
}
// Rules kept simple on purpose: 8+ characters, not just letters.
function passwordProblem(pw) {
  pw = String(pw || '');
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (pw.length > 200) return 'That password is too long.';
  if (/^[a-z]+$/i.test(pw)) return 'Add a number or symbol.';
  return '';
}
const tempPassword = () => 'Ws-' + crypto.randomBytes(6).toString('base64url');

// Session cookie: base64url(JSON {u: user id, v: token version, e: expiry}) + "." + HMAC
function makeSessions(secret) {
  const mac = s => crypto.createHmac('sha256', secret).update(s).digest('base64url');
  return {
    issue(user, days = 14) {
      const body = Buffer.from(JSON.stringify({ u: user.id, v: user.tokenVersion || 0, e: Date.now() + days * 864e5 })).toString('base64url');
      return body + '.' + mac(body);
    },
    read(token) {
      if (!token || token.indexOf('.') < 0) return null;
      const [body, sig] = token.split('.');
      const good = mac(body);
      if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
      try { const d = JSON.parse(Buffer.from(body, 'base64url').toString()); return d.e > Date.now() ? d : null; } catch { return null; }
    }
  };
}

// First admin account. No password is kept in the code: it comes from the INITIAL_ADMIN_PASSWORD
// setting, or a one-time password is printed in the server log.
const FIRST_ADMIN = { email: process.env.INITIAL_ADMIN_EMAIL || 'kai@skylinewhitespace.com', name: 'Kai', role: 'admin' };
// Fingerprint of the password that earlier versions had built in. Any account still using it gets a new one.
const RETIRED = new Set(['e95d42745637d70f6d2bfae6d22e98a199e0f44f8eb6ffce76d1ae2b57a172bd']);
const isRetiredHash = h => RETIRED.has(crypto.createHash('sha256').update(String(h)).digest('hex'));
// Used to keep sign-in timing the same whether or not an email exists.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

module.exports = { hashPassword, verifyPassword, passwordProblem, tempPassword, makeSessions, FIRST_ADMIN, isRetiredHash, DUMMY_HASH };
