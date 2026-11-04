// Dashboard data: tasks assigned to people, and announcements for everyone.
// Both are small lists kept in the settings store; changes are queued so two saves can't overwrite each other.
const crypto = require('crypto');
const { sanitizeHtml: sanitize } = require('./content');
const newId = p => p + crypto.randomBytes(6).toString('hex');
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
class Invalid extends Error {}
const text = (v, max, what, required) => {
  v = v == null ? '' : String(v).trim();
  if (required && !v) throw new Invalid(`${what} is required.`);
  if (v.length > max) throw new Invalid(`${what} is too long (max ${max} characters).`);
  return v;
};
const IMG_RE = /^\/files\/[0-9a-f-]{36}\/[^\s"<>]{0,300}$/;
const EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '😮', '😢', '🙏', '🔥', '💯'];
const DEFAULT_TOPICS = [
  { id: 'company-news', name: 'Company news', color: '#5B5FC7' }, { id: 'events', name: 'Events', color: '#0F6CBD' },
  { id: 'new-joiners', name: 'New joiners', color: '#4F9E7B' }, { id: 'action-required', name: 'Your action required', color: '#E06D2B' },
  { id: 'breaking-news', name: 'Breaking news', color: '#C4314B' }, { id: 'staff-social', name: 'Staff social events', color: '#2BB673' },
  { id: 'health-safety', name: 'Health & safety', color: '#D13438' }];
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
  function cleanNews(b, old = {}, topics = []) {
    const n = {
      title: text(b.title ?? old.title, 200, 'The headline', true),
      html: sanitize(b.html !== undefined ? b.html : old.html !== undefined ? old.html : plainToHtml(old.body || '')),
      link: text(b.link ?? old.link, 2000, 'The link'),
      pinned: b.pinned === undefined ? !!old.pinned : !!b.pinned,
      image: b.image === undefined ? old.image || '' : String(b.image || ''),
      topic: b.topic === undefined ? old.topic || '' : String(b.topic || ''),
      status: (b.status ?? old.status) === 'draft' ? 'draft' : 'published'
    };
    if (n.html.length > 20000) throw new Invalid('The message is too long.');
    if (n.link && !LINK_RE.test(n.link)) throw new Invalid('The link must start with https://');
    if (n.image && !IMG_RE.test(n.image)) throw new Invalid('The picture couldn’t be found. Upload it again.');
    if (n.topic && !topics.some(t => t.id === n.topic)) n.topic = '';
    return n;
  }
  const plainToHtml = t => String(t || '').trim() ? String(t).trim().split(/\n\s*\n/).map(p => '<p>' + p.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/\n/g, '<br>') + '</p>').join('') : '';
  const topicsOf = async () => (await store.getSetting('NEWS_TOPICS')) || DEFAULT_TOPICS;

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
    topics: topicsOf,
    saveTopics: list => locked(async () => {
      if (!Array.isArray(list) || list.length > 30) throw new Invalid('Up to 30 tags.');
      const seen = new Set();
      const clean = list.map(t => {
        const name = text(t.name, 40, 'A tag name', true);
        const id = /^[a-z0-9-]{1,40}$/.test(t.id || '') ? t.id : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || newId('t');
        if (seen.has(id)) throw new Invalid(`There are two tags called “${name}”.`);
        seen.add(id);
        return { id, name, color: /^#[0-9a-fA-F]{6}$/.test(t.color || '') ? t.color : '#616161' };
      });
      await store.setSetting('NEWS_TOPICS', clean); return clean;
    }),
    async allNews() { return load('NEWS'); },
    createNews: (b, by) => locked(async () => {
      const list = await load('NEWS'), topics = await topicsOf();
      const author = b.author && b.author.id ? b.author : by;
      const now = new Date().toISOString();
      const n = Object.assign({ id: newId('a'), at: now, createdAt: now, createdBy: by.name, by: author.name, authorId: author.id, reactions: {}, hiddenBy: [] }, cleanNews(b, {}, topics));
      list.unshift(n); if (list.length > 2000) list.length = 2000;
      await store.setSetting('NEWS', list); return n;
    }),
    updateNews: (id, b, author) => locked(async () => {
      const list = await load('NEWS'), i = list.findIndex(n => n.id === id);
      if (i < 0) return null;
      const was = list[i].status;
      Object.assign(list[i], cleanNews(b, list[i], await topicsOf()), { edited: new Date().toISOString() });
      if (author) { list[i].by = author.name; list[i].authorId = author.id; }
      if (was === 'draft' && list[i].status === 'published') list[i].at = new Date().toISOString();   // a draft is dated when it's posted
      delete list[i].body;
      await store.setSetting('NEWS', list); return list[i];
    }),
    deleteNews: id => locked(async () => {
      const list = await load('NEWS'), n = list.filter(x => x.id !== id);
      if (n.length === list.length) return false;
      await store.setSetting('NEWS', n); return true;
    }),
    react: (id, emoji, userId) => locked(async () => {
      if (!EMOJIS.includes(emoji)) throw new Invalid('That reaction isn’t available.');
      const list = await load('NEWS'), n = list.find(x => x.id === id);
      if (!n || n.status === 'draft') return null;
      const r = n.reactions = n.reactions || {};
      const who = new Set(r[emoji] || []);
      who.has(userId) ? who.delete(userId) : who.add(userId);
      if (who.size) r[emoji] = [...who]; else delete r[emoji];
      await store.setSetting('NEWS', list); return n;
    }),
    hide: (id, hidden, userId) => locked(async () => {
      const list = await load('NEWS'), n = list.find(x => x.id === id);
      if (!n) return null;
      const s = new Set(n.hiddenBy || []); hidden ? s.add(userId) : s.delete(userId); n.hiddenBy = [...s];
      await store.setSetting('NEWS', list); return n;
    })
  };
}
module.exports = { makeBoard, EMOJIS };
