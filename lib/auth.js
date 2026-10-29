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

// First account, created only when there are no users yet.
// Only the scrypt hash is stored here; the password itself is not in the code.
const SEED_ADMIN = { email: 'kai@skylinewhitespace.com', name: 'Kai', role: 'admin',
  passwordHash: process.env.SEED_ADMIN_HASH || 'scrypt$16384$36e4132b7c485a46b2cc94265e862bc9$348a494c408d734fab644fb5fc29df28d9daeef56539457eb09cb0ef24455d7c41fdca4061c140a59f6e56946399f6b630ead858db38ac60143de9fe31a68e91' };

module.exports = { hashPassword, verifyPassword, passwordProblem, tempPassword, makeSessions, SEED_ADMIN };
