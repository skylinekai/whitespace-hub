// Submission storage. Uses Postgres when DATABASE_URL is set, otherwise a local folder.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ref = id => 'WS-' + String(id).padStart(5, '0');

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    const local = /localhost|127\.0\.0\.1|\/tmp|host=\//.test(url);
    this.pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
    this.kind = 'postgres';
  }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        form_id TEXT NOT NULL,
        form_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        status TEXT NOT NULL DEFAULT 'new',
        summary TEXT NOT NULL DEFAULT '',
        answers JSONB NOT NULL,
        search TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS submissions_form_idx ON submissions (form_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        field_id TEXT NOT NULL,
        field_label TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        content BYTEA NOT NULL
      );
      CREATE INDEX IF NOT EXISTS files_sub_idx ON files (submission_id);
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        token_version INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login TIMESTAMPTZ
      );`);
  }
  _user(r) { return r ? { id: r.id, email: r.email, name: r.name, passwordHash: r.password_hash, role: r.role, tokenVersion: r.token_version, createdAt: r.created_at, lastLogin: r.last_login } : null; }
  async listUsers() { return (await this.pool.query('SELECT * FROM users ORDER BY lower(name)')).rows.map(r => this._user(r)); }
  async getUser(id) { return this._user((await this.pool.query('SELECT * FROM users WHERE id=$1', [id])).rows[0]); }
  async getUserByEmail(email) { return this._user((await this.pool.query('SELECT * FROM users WHERE email=$1', [String(email).toLowerCase()])).rows[0]); }
  async countUsers() { return (await this.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n; }
  async createUser(u) {
    const r = await this.pool.query('INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING *', [u.email.toLowerCase(), u.name, u.passwordHash, u.role]);
    return this._user(r.rows[0]);
  }
  async updateUser(id, f) {
    const cols = { name: 'name', role: 'role', passwordHash: 'password_hash', tokenVersion: 'token_version', lastLogin: 'last_login' };
    const sets = [], p = [id];
    for (const [k, c] of Object.entries(cols)) if (k in f) { p.push(f[k]); sets.push(`${c}=$${p.length}`); }
    if (sets.length) await this.pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=$1`, p);
  }
  async deleteUser(id) { await this.pool.query('DELETE FROM users WHERE id=$1', [id]); }
  async getSetting(key) {
    const r = await this.pool.query('SELECT value FROM settings WHERE key=$1', [key]);
    return r.rows[0] ? r.rows[0].value : null;
  }
  async setSetting(key, value) {
    await this.pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(value)]);
  }
  async create(sub, files) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query(
        'INSERT INTO submissions (form_id, form_name, summary, answers, search) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at',
        [sub.formId, sub.formName, sub.summary, JSON.stringify(sub.answers), sub.search]);
      const id = r.rows[0].id;
      for (const f of files) {
        await c.query('INSERT INTO files (id, submission_id, field_id, field_label, filename, mime, size, content) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [crypto.randomUUID(), id, f.fieldId, f.fieldLabel, f.filename, f.mime, f.buffer.length, f.buffer]);
      }
      await c.query('COMMIT');
      return { id, ref: ref(id), createdAt: r.rows[0].created_at };
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  async summary() {
    const r = await this.pool.query(`SELECT form_id, count(*)::int AS total,
      count(*) FILTER (WHERE status='new')::int AS unread, max(created_at) AS latest FROM submissions GROUP BY form_id`);
    return r.rows.map(x => ({ formId: x.form_id, total: x.total, unread: x.unread, latest: x.latest }));
  }
  async list({ formId, status, q, limit = 50, offset = 0 }) {
    const w = [], p = [];
    if (formId) { p.push(formId); w.push(`form_id = $${p.length}`); }
    if (status && status !== 'all') { p.push(status); w.push(`status = $${p.length}`); }
    if (q) { p.push('%' + q.toLowerCase() + '%'); w.push(`search LIKE $${p.length}`); }
    const where = w.length ? 'WHERE ' + w.join(' AND ') : '';
    p.push(limit, offset);
    const r = await this.pool.query(`SELECT s.id, s.form_id, s.form_name, s.created_at, s.status, s.summary,
      (SELECT count(*)::int FROM files f WHERE f.submission_id = s.id) AS files
      FROM submissions s ${where} ORDER BY s.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p);
    const t = await this.pool.query(`SELECT count(*)::int AS n FROM submissions ${where}`, p.slice(0, -2));
    return { total: t.rows[0].n, rows: r.rows.map(x => ({ id: x.id, ref: ref(x.id), formId: x.form_id, formName: x.form_name, createdAt: x.created_at, status: x.status, summary: x.summary, files: x.files })) };
  }
  async get(id) {
    const r = await this.pool.query('SELECT * FROM submissions WHERE id=$1', [id]);
    if (!r.rows[0]) return null;
    const x = r.rows[0];
    const f = await this.pool.query('SELECT id, field_id, field_label, filename, mime, size FROM files WHERE submission_id=$1 ORDER BY filename', [id]);
    return { id: x.id, ref: ref(x.id), formId: x.form_id, formName: x.form_name, createdAt: x.created_at, status: x.status, answers: x.answers,
      files: f.rows.map(y => ({ id: y.id, fieldId: y.field_id, fieldLabel: y.field_label, filename: y.filename, mime: y.mime, size: y.size })) };
  }
  async file(id) {
    const r = await this.pool.query('SELECT filename, mime, content FROM files WHERE id=$1', [id]);
    return r.rows[0] ? { filename: r.rows[0].filename, mime: r.rows[0].mime, buffer: r.rows[0].content } : null;
  }
  async setStatus(id, status) { await this.pool.query('UPDATE submissions SET status=$2 WHERE id=$1', [id, status]); }
  async remove(id) { await this.pool.query('DELETE FROM submissions WHERE id=$1', [id]); }
  async all(formId) {
    const r = await this.pool.query('SELECT id, created_at, status, answers FROM submissions WHERE form_id=$1 ORDER BY created_at DESC', [formId]);
    return r.rows.map(x => ({ id: x.id, ref: ref(x.id), createdAt: x.created_at, status: x.status, answers: x.answers }));
  }
}

class FileStore {
  constructor(dir) { this.dir = dir; this.kind = 'folder'; }
  async init() {
    fs.mkdirSync(path.join(this.dir, 'files'), { recursive: true });
    this.dbPath = path.join(this.dir, 'submissions.json');
    this.db = fs.existsSync(this.dbPath) ? JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) : { next: 1, rows: [] };
    this.db.settings = this.db.settings || {};
    this.db.users = this.db.users || [];
    this.db.nextUser = this.db.nextUser || 1;
  }
  async listUsers() { return [...this.db.users].sort((a, b) => a.name.localeCompare(b.name)); }
  async getUser(id) { return this.db.users.find(u => u.id === Number(id)) || null; }
  async getUserByEmail(email) { return this.db.users.find(u => u.email === String(email).toLowerCase()) || null; }
  async countUsers() { return this.db.users.length; }
  async createUser(u) {
    if (this.db.users.some(x => x.email === u.email.toLowerCase())) throw Object.assign(new Error('duplicate'), { code: '23505' });
    const user = { id: this.db.nextUser++, email: u.email.toLowerCase(), name: u.name, passwordHash: u.passwordHash, role: u.role, tokenVersion: 0, createdAt: new Date().toISOString(), lastLogin: null };
    this.db.users.push(user); this.save(); return user;
  }
  async updateUser(id, f) { const u = await this.getUser(id); if (u) { Object.assign(u, f); this.save(); } }
  async deleteUser(id) { this.db.users = this.db.users.filter(u => u.id !== Number(id)); this.save(); }
  async getSetting(key) { return this.db.settings[key] ?? null; }
  async setSetting(key, value) { this.db.settings[key] = value; this.save(); }
  save() { fs.writeFileSync(this.dbPath + '.tmp', JSON.stringify(this.db)); fs.renameSync(this.dbPath + '.tmp', this.dbPath); }
  async create(sub, files) {
    const id = this.db.next++;
    const createdAt = new Date().toISOString();
    const meta = files.map(f => {
      const fid = crypto.randomUUID();
      fs.writeFileSync(path.join(this.dir, 'files', fid), f.buffer);
      return { id: fid, fieldId: f.fieldId, fieldLabel: f.fieldLabel, filename: f.filename, mime: f.mime, size: f.buffer.length };
    });
    this.db.rows.unshift({ id, formId: sub.formId, formName: sub.formName, createdAt, status: 'new', summary: sub.summary, answers: sub.answers, search: sub.search, files: meta });
    this.save();
    return { id, ref: ref(id), createdAt };
  }
  async summary() {
    const m = {};
    for (const r of this.db.rows) {
      const s = m[r.formId] = m[r.formId] || { formId: r.formId, total: 0, unread: 0, latest: null };
      s.total++; if (r.status === 'new') s.unread++; if (!s.latest || r.createdAt > s.latest) s.latest = r.createdAt;
    }
    return Object.values(m);
  }
  async list({ formId, status, q, limit = 50, offset = 0 }) {
    let rows = this.db.rows;
    if (formId) rows = rows.filter(r => r.formId === formId);
    if (status && status !== 'all') rows = rows.filter(r => r.status === status);
    if (q) rows = rows.filter(r => r.search.includes(q.toLowerCase()));
    return { total: rows.length, rows: rows.slice(offset, offset + limit).map(r => ({ id: r.id, ref: ref(r.id), formId: r.formId, formName: r.formName, createdAt: r.createdAt, status: r.status, summary: r.summary, files: r.files.length })) };
  }
  async get(id) {
    const r = this.db.rows.find(x => x.id === Number(id));
    return r ? { id: r.id, ref: ref(r.id), formId: r.formId, formName: r.formName, createdAt: r.createdAt, status: r.status, answers: r.answers, files: r.files } : null;
  }
  async file(id) {
    for (const r of this.db.rows) {
      const f = r.files.find(x => x.id === id);
      if (f) return { filename: f.filename, mime: f.mime, buffer: fs.readFileSync(path.join(this.dir, 'files', id)) };
    }
    return null;
  }
  async setStatus(id, status) { const r = this.db.rows.find(x => x.id === Number(id)); if (r) { r.status = status; this.save(); } }
  async remove(id) {
    const r = this.db.rows.find(x => x.id === Number(id));
    if (!r) return;
    for (const f of r.files) fs.rmSync(path.join(this.dir, 'files', f.id), { force: true });
    this.db.rows = this.db.rows.filter(x => x !== r); this.save();
  }
  async all(formId) { return this.db.rows.filter(r => r.formId === formId).map(r => ({ id: r.id, ref: ref(r.id), createdAt: r.createdAt, status: r.status, answers: r.answers })); }
}

module.exports = function makeStore() {
  return process.env.DATABASE_URL ? new PgStore(process.env.DATABASE_URL)
    : new FileStore(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
};
