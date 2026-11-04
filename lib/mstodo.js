// Microsoft To Do on the dashboard, through Microsoft Graph, on behalf of each signed-in person.
// Each person's refresh token is encrypted (AES-256-GCM) with a key derived from the session secret.
const crypto = require('crypto');
const GRAPH = (process.env.MS_GRAPH_HOST || 'https://graph.microsoft.com').replace(/\/$/, '') + '/v1.0';

function makeTodo(store, MS, getSecret) {
  const key = () => crypto.createHash('sha256').update('mstodo:' + getSecret()).digest();
  const seal = obj => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(), iv); const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]); return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.'); };
  const open = str => { try { const [iv, tag, enc] = String(str).split('.').map(x => Buffer.from(x, 'base64')); const d = crypto.createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag); return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString('utf8')); } catch { return null; } };
  const access = new Map();        // userId -> { access, exp }   (memory only)
  const cache = new Map();         // userId -> { at, data }      (short cache so the dashboard is quick)
  const K = id => 'mstodo:' + id;

  async function saveTokens(userId, t, email) {
    await store.setSetting(K(userId), { rt: seal({ r: t.refresh }), email, connectedAt: new Date().toISOString() });
    access.set(userId, { access: t.access, exp: t.exp }); cache.delete(userId);
  }
  async function disconnect(userId) { access.delete(userId); cache.delete(userId); await store.setSetting(K(userId), null); }
  async function status(userId) { const s = await store.getSetting(K(userId)); return s && s.rt ? { connected: true, email: s.email, connectedAt: s.connectedAt } : { connected: false }; }
  async function token(userId) {
    const a = access.get(userId); if (a && a.exp > Date.now() + 60e3) return a.access;
    const s = await store.getSetting(K(userId)); const rt = s && open(s.rt);
    if (!rt) throw Object.assign(new Error('Not connected'), { code: 'reconnect' });
    try {
      const t = await MS.refresh(rt.r);
      access.set(userId, { access: t.access, exp: t.exp });
      if (t.refresh !== rt.r) await store.setSetting(K(userId), Object.assign({}, s, { rt: seal({ r: t.refresh }) }));
      return t.access;
    } catch (e) { if (e.code === 'reconnect') await disconnect(userId); throw e; }
  }
  async function graph(userId, path, { method = 'GET', body } = {}) {
    let r;
    try { r = await fetch(path.startsWith('http') ? path : GRAPH + path, { method, headers: { Authorization: 'Bearer ' + await token(userId), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) }); }
    catch (e) { if (e.code) throw e; throw Object.assign(new Error(e.name === 'TimeoutError' ? 'Microsoft took too long to reply' : 'Couldn’t connect to Microsoft (' + (e.cause && e.cause.code || e.message) + ')'), { status: 0 }); }
    if (r.status === 401) { access.delete(userId); throw Object.assign(new Error('Microsoft asked you to connect again.'), { code: 'reconnect' }); }
    const out = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) {
      const er = out.error || {};
      throw Object.assign(new Error(`${r.status} ${er.code || ''}: ${er.message || 'no details'}`.replace(' :', ':')), { status: r.status, graphCode: er.code });
    }
    return out;
  }
  // GET every page (Microsoft returns @odata.nextLink when there's more), up to a limit
  async function all(userId, path, maxPages = 5) {
    let out = [], next = path;
    for (let i = 0; next && i < maxPages; i++) { const page = await graph(userId, next); out = out.concat(page.value || []); next = page['@odata.nextLink']; }
    return out;
  }
  // To Do keeps a due date as midnight in the person's time zone, sent back in UTC; round to the nearest day.
  const dueOf = d => { if (!d || !d.dateTime) return ''; const t = new Date(d.dateTime.replace(/(\.\d{3})\d*/, '$1') + (d.timeZone === 'UTC' || !d.timeZone ? 'Z' : '')); return isNaN(t) ? d.dateTime.slice(0, 10) : new Date(t.getTime() + 12 * 3600e3).toISOString().slice(0, 10); };
  async function tasks(userId, fresh) {
    const c = cache.get(userId); if (!fresh && c && Date.now() - c.at < 30e3) return c.data;
    const lists = (await all(userId, '/me/todo/lists')).filter(l => l.wellknownListName !== 'flaggedEmails').slice(0, 25);
    const skipped = [];
    const per = await Promise.all(lists.map(async l => {
      const base = `/me/todo/lists/${encodeURIComponent(l.id)}/tasks`;
      let v;
      try {
        try { v = await all(userId, base + "?$filter=status ne 'completed'"); }
        catch (e) { if (e.code === 'reconnect' || !(e.status >= 400 && e.status < 500)) throw e; v = await all(userId, base, 10); }   // some accounts don't accept the filter
      } catch (e) { if (e.code === 'reconnect') throw e; console.error(`[mstodo] skipped list "${l.displayName}":`, e.message); skipped.push(l.displayName); return []; }
      return v.filter(t => t.status !== 'completed').map(t => ({ id: t.id, listId: l.id, list: l.displayName, title: t.title || '(No title)', due: dueOf(t.dueDateTime), important: t.importance === 'high', created: t.createdDateTime || '' }));
    }));
    const data = { lists: lists.map(l => ({ id: l.id, name: l.displayName, isDefault: l.wellknownListName === 'defaultList' })), tasks: per.flat(), skipped };
    cache.set(userId, { at: Date.now(), data });
    return data;
  }
  async function setDone(userId, listId, taskId, done) {
    cache.delete(userId);
    return graph(userId, `/me/todo/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', body: { status: done ? 'completed' : 'notStarted' } });
  }
  async function add(userId, listId, title, due) {
    cache.delete(userId);
    const body = { title };
    if (due) body.dueDateTime = { dateTime: due + 'T00:00:00', timeZone: process.env.TODO_TIMEZONE || 'Europe/London' };
    return graph(userId, `/me/todo/lists/${encodeURIComponent(listId)}/tasks`, { method: 'POST', body });
  }
  return { saveTokens, disconnect, status, tasks, setDone, add };
}
module.exports = { makeTodo };
