// Questions passed from Helpful HR to a person (Jack Stevens by default).
// Each question is a small conversation. The HR contact gets a hub task for every new question,
// can reply live in the Helpful HR window when online, and the task is ticked off when they reply.
const crypto = require('crypto');
const newId = () => 'q' + crypto.randomBytes(6).toString('hex');
class Invalid extends Error {}
const text = (v, max, what) => { v = String(v ?? '').trim(); if (!v) throw new Invalid(`Write ${what}.`); if (v.length > max) throw new Invalid(`That’s too long (max ${max} characters).`); return v; };

function makeHelpdesk(store, board, { defaultStaffEmails = ['jack@skylinewhitespace.com'] } = {}) {
  let queue = Promise.resolve();
  const locked = fn => (queue = queue.then(fn, fn));
  const load = async () => (await store.getSetting('HHR_TICKETS')) || [];
  const save = list => store.setSetting('HHR_TICKETS', list.slice(0, 2000));
  const seen = new Map();   // userId -> last time the hub was open and visible (memory only)

  async function staffIds() {
    const set = await store.getSetting('HHR_STAFF');
    if (Array.isArray(set) && set.length) return set.map(Number);
    const out = [];
    for (const e of defaultStaffEmails) { const u = await store.getUserByEmail(e); if (u) out.push(u.id); }
    return out;
  }
  async function staff() {
    const ids = await staffIds(), out = [];
    for (const id of ids) { const u = await store.getUser(id); if (u) out.push({ id: u.id, name: u.name, online: isOnline(u.id) }); }
    return out;
  }
  const isOnline = id => Date.now() - (seen.get(id) || 0) < 75e3;
  const ping = (userId, visible) => { if (visible) seen.set(userId, Date.now()); };

  // what each side is allowed to see
  const forUser = (t, me, isStaff) => ({
    id: t.id, question: t.question, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt,
    from: { id: t.fromId, name: t.fromName }, context: isStaff ? t.context : undefined,
    messages: t.messages.map(m => ({ by: m.by, name: m.name, text: m.text, at: m.at, mine: m.userId === me.id })),
    unread: isStaff ? !!t.unreadStaff : !!t.unreadUser, assignedTo: t.assignedName || null
  });

  async function create(me, b) {
    const question = text(b.question, 2000, 'your question');
    const context = (Array.isArray(b.context) ? b.context : []).slice(-4).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 1500) }));
    const ids = await staffIds();
    if (!ids.length) throw new Invalid('No one has been set up to answer questions yet. Ask an admin.');
    const assignee = await store.getUser(ids[0]);
    const now = new Date().toISOString();
    const t = { id: newId(), fromId: me.id, fromName: me.name, question, context, status: 'open', createdAt: now, updatedAt: now,
      messages: [{ by: 'user', userId: me.id, name: me.name, text: question, at: now }], unreadStaff: true, unreadUser: false, assignedId: assignee.id, assignedName: assignee.name };
    // a task, so it's never missed
    const task = await board.createTask({ title: `Reply to ${me.name}’s question`, notes: question.length > 400 ? question.slice(0, 400) + '…' : question, link: '#hhr/' + t.id, assignee: assignee.id }, { id: me.id, name: me.name });
    t.taskId = task.id;
    await locked(async () => { const list = await load(); list.unshift(t); await save(list); });
    return { ticket: t, task, assignee };
  }
  async function get(id) { return (await load()).find(t => t.id === id) || null; }
  const canSee = async (t, me) => t && (t.fromId === me.id || (await staffIds()).includes(me.id));
  async function mine(me) { return (await load()).filter(t => t.fromId === me.id); }
  async function inbox() { return (await load()).filter(t => t.status !== 'closed' || Date.now() - new Date(t.updatedAt) < 14 * 864e5); }

  async function reply(id, me, body) {
    const msg = text(body, 4000, 'a reply');
    const isStaff = (await staffIds()).includes(me.id);
    let result = null;
    await locked(async () => {
      const list = await load(), t = list.find(x => x.id === id);
      if (!t) return;
      const fromStaff = isStaff && t.fromId !== me.id;
      if (!fromStaff && t.fromId !== me.id) return;
      t.messages.push({ by: fromStaff ? 'staff' : 'user', userId: me.id, name: me.name, text: msg, at: new Date().toISOString() });
      t.updatedAt = new Date().toISOString();
      if (fromStaff) { t.status = 'answered'; t.unreadUser = true; t.unreadStaff = false; }
      else { t.status = 'open'; t.unreadStaff = true; }
      await save(list); result = { t, fromStaff };
    });
    if (!result) return null;
    // the task follows the conversation: done when HR has replied, back on the list if the person asks again
    if (result.t.taskId) await board.setDone(result.t.taskId, result.fromStaff, me, true).catch(() => {});
    return result;
  }
  async function markRead(id, me) {
    const isStaff = (await staffIds()).includes(me.id);
    return locked(async () => {
      const list = await load(), t = list.find(x => x.id === id); if (!t) return;
      let ch = false;
      if (t.fromId === me.id && t.unreadUser) { t.unreadUser = false; ch = true; }
      else if (isStaff && t.fromId !== me.id && t.unreadStaff) { t.unreadStaff = false; ch = true; }
      if (ch) await save(list);
    });
  }
  async function close(id, me) {
    let t0 = null;
    await locked(async () => {
      const list = await load(), t = list.find(x => x.id === id); if (!t) return;
      t.status = 'closed'; t.updatedAt = new Date().toISOString(); t.unreadStaff = false; t.closedBy = me.name;
      await save(list); t0 = t;
    });
    if (t0 && t0.taskId) await board.setDone(t0.taskId, true, me, true).catch(() => {});
    return t0;
  }
  return { Invalid, staff, staffIds, isOnline, ping, create, get, canSee, mine, inbox, reply, markRead, close, forUser,
    setStaff: ids => store.setSetting('HHR_STAFF', ids.map(Number)) };
}
module.exports = { makeHelpdesk };
