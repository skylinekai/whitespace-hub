// Dashboard data: tasks assigned to people, and announcements for everyone.
// Both are small lists kept in the settings store; changes are queued so two saves can't overwrite each other.
const crypto = require('crypto');
const newId = p => p + crypto.randomBytes(6).toString('hex');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
class Invalid extends Error {}
const text = (v, max, what, required) => {
  v = v == null ? '' : String(v).trim();
  if (required && !v) throw new Invalid(`${what} is required.`);
  if (v.length > max) throw new Invalid(`${what} is too long (max ${max} characters).`);
  return v;
};
const LINK_RE = /^(https?:\/\/\S+|\/\S*|#\S*)$/i;

function makeBoard(store) {
  let queue = Promise.resolve();
  const locked = fn => (queue = queue.then(fn, fn));
  const load = async key => (await store.getSetting(key)) || [];

  function cleanTask(b, old = {}) {
    const t = {
      title: text(b.title ?? old.title, 200, 'The task', true),
      notes: text(b.notes ?? old.notes, 3000, 'The notes'),
      due: b.due === undefined ? old.due || '' : (b.due && DATE_RE.test(b.due) ? b.due : ''),
      link: text(b.link ?? old.link, 2000, 'The link'),
      assignee: b.assignee === undefined ? old.assignee : Number(b.assignee)
    };
    if (t.link && !LINK_RE.test(t.link)) throw new Invalid('The link must start with https://');
    if (!t.assignee) throw new Invalid('Choose who the task is for.');
    return t;
  }
  function cleanNews(b, old = {}) {
    const n = {
      title: text(b.title ?? old.title, 200, 'The headline', true),
      body: text(b.body ?? old.body, 5000, 'The message'),
      link: text(b.link ?? old.link, 2000, 'The link'),
      pinned: b.pinned === undefined ? !!old.pinned : !!b.pinned
    };
    if (n.link && !LINK_RE.test(n.link)) throw new Invalid('The link must start with https://');
    return n;
  }

  return {
    Invalid,
    // tasks
    async tasksFor(userId) { return (await load('TASKS')).filter(t => t.assignee === userId); },
    async allTasks() { return load('TASKS'); },
    createTask: (b, by) => locked(async () => {
      const list = await load('TASKS');
      const t = Object.assign({ id: newId('t'), done: false, doneAt: null, createdAt: new Date().toISOString(), createdBy: by.name, createdById: by.id }, cleanTask(b));
      list.unshift(t); if (list.length > 5000) list.length = 5000;
      await store.setSetting('TASKS', list); return t;
    }),
    updateTask: (id, b) => locked(async () => {
      const list = await load('TASKS'), i = list.findIndex(t => t.id === id);
      if (i < 0) return null;
      list[i] = Object.assign(list[i], cleanTask(b, list[i]));
      await store.setSetting('TASKS', list); return list[i];
    }),
    setDone: (id, done, user, admin) => locked(async () => {
      const list = await load('TASKS'), t = list.find(x => x.id === id);
      if (!t) return null;
      if (t.assignee !== user.id && !admin) return false;
      t.done = !!done; t.doneAt = done ? new Date().toISOString() : null;
      await store.setSetting('TASKS', list); return t;
    }),
    deleteTask: id => locked(async () => {
      const list = await load('TASKS'), n = list.filter(t => t.id !== id);
      if (n.length === list.length) return false;
      await store.setSetting('TASKS', n); return true;
    }),
    // announcements
    async news() { return (await load('NEWS')).sort((a, b) => (b.pinned - a.pinned) || b.at.localeCompare(a.at)); },
    createNews: (b, by) => locked(async () => {
      const list = await load('NEWS');
      const n = Object.assign({ id: newId('a'), at: new Date().toISOString(), by: by.name }, cleanNews(b));
      list.unshift(n); if (list.length > 500) list.length = 500;
      await store.setSetting('NEWS', list); return n;
    }),
    updateNews: (id, b) => locked(async () => {
      const list = await load('NEWS'), i = list.findIndex(n => n.id === id);
      if (i < 0) return null;
      list[i] = Object.assign(list[i], cleanNews(b, list[i]), { edited: new Date().toISOString() });
      await store.setSetting('NEWS', list); return list[i];
    }),
    deleteNews: id => locked(async () => {
      const list = await load('NEWS'), n = list.filter(x => x.id !== id);
      if (n.length === list.length) return false;
      await store.setSetting('NEWS', n); return true;
    })
  };
}
module.exports = { makeBoard };
