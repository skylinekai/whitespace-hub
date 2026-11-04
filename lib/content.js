// Hub content (folders, sections, items) and form definitions: seeding, validation and clean-up.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const SEED = path.join(__dirname, '..', 'seed');
const newId = (p = '') => p + crypto.randomBytes(5).toString('hex');
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const KINDS = new Set(['form', 'doc', 'link', 'page', 'app', 'note']);

// ---------- seeding from the files the hub originally shipped with ----------
function seedHub(deptNames = {}) {
  const ctx = {}; ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(SEED, 'hub-data.js'), 'utf8'), ctx);
  const W = ctx.window, U = W.HUB_U, HOME = W.HUB_HOME, QUICK = new Set(W.HUB_QUICK.map(q => q[1]));
  const quickDone = new Set();
  const conv = it => {
    const [k, t, u, m] = it, base = { id: newId('i'), title: t || '', sub: m || '' };
    if (k === 'f') { const o = Object.assign(base, { kind: 'form', formId: u }); if (QUICK.has(u) && !quickDone.has(u)) { o.quick = true; quickDone.add(u); } return o; }
    if (k === 'd') return Object.assign(base, { kind: 'doc', url: u.startsWith('~') ? U + u.slice(1) : u });
    if (k === 'l') return Object.assign(base, { kind: 'link', url: u });
    if (k === 'p') return Object.assign(base, { kind: 'page', target: u });
    if (k === 'a') return Object.assign(base, { kind: 'app', url: u });
    return { id: newId('i'), kind: 'note', html: t || '' };
  };
  const order = [...HOME, ...W.HUB.map(d => d.id).filter(id => !HOME.includes(id))];
  const departments = order.map(id => W.HUB.find(d => d.id === id)).filter(Boolean).map(d => ({
    id: d.id, name: deptNames[d.id] || d.name, color: d.c, group: HOME.includes(d.id) ? 'main' : 'more',
    sections: d.g.map(([title, items]) => ({ id: newId('s'), title, items: items.map(conv) }))
  }));
  return { version: 1, departments };
}
const seedForms = () => JSON.parse(fs.readFileSync(path.join(SEED, 'forms.json'), 'utf8'));

// ---------- notes: a small allow-list sanitiser ----------
const ALLOWED = new Set(['p', 'br', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 's', 'h3', 'a', 'div']);
function sanitizeHtml(html) {
  return String(html || '').slice(0, 20000)
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(\/?)\s*([a-z0-9]+)([^>]*)>/gi, (m, close, tag, attrs) => {
      tag = tag.toLowerCase();
      if (!ALLOWED.has(tag)) return '';
      if (close) return `</${tag}>`;
      if (tag === 'a') {
        const href = (attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i) || [])[1] || '';
        return /^(https?:\/\/|\/(?!\/))/i.test(href.trim()) ? `<a href="${href.trim().replace(/"/g, '&quot;')}" target="_blank" rel="noopener">` : '<a>';
      }
      return `<${tag}>`;
    });
}

// ---------- validation ----------
class Invalid extends Error {}
const str = (v, max, what) => {
  if (v == null) return '';
  if (typeof v !== 'string') throw new Invalid(`${what} must be text.`);
  v = v.replace(/\s+$/,'');
  if (v.length > max) throw new Invalid(`${what} is too long (max ${max} characters).`);
  return v;
};
const urlOk = u => /^(https?:\/\/[^\s]+|\/[^\s]*)$/i.test(u);

function cleanHub(doc, formIds) {
  if (!doc || !Array.isArray(doc.departments)) throw new Invalid('The hub content could not be read.');
  if (doc.departments.length > 60) throw new Invalid('Too many folders (max 60).');
  const seen = new Set(), deptIds = new Set(doc.departments.map(d => d && d.id));
  const departments = doc.departments.map(d => {
    if (!d || !ID_RE.test(d.id) || seen.has(d.id)) throw new Invalid('A folder has a missing or duplicate ID.');
    seen.add(d.id);
    const name = str(d.name, 60, 'A folder name').trim();
    if (!name) throw new Invalid('Every folder needs a name.');
    if (!Array.isArray(d.sections) || d.sections.length > 60) throw new Invalid(`“${name}” has too many sections.`);
    return {
      id: d.id, name, color: COLOR_RE.test(d.color) ? d.color : '#0F6CBD', group: d.group === 'more' ? 'more' : 'main',
      ...(typeof d.icon === 'string' && /^[a-z]{1,20}$/.test(d.icon) ? { icon: d.icon } : {}),
      ...(typeof d.image === 'string' && /^\/files\/[0-9a-f-]{36}\/[^\s"<>]{0,300}$/.test(d.image) ? { image: d.image } : {}),
      sections: d.sections.map(s => {
        if (!s || !ID_RE.test(s.id) || seen.has(s.id)) throw new Invalid('A section has a missing or duplicate ID.');
        seen.add(s.id);
        if (!Array.isArray(s.items) || s.items.length > 300) throw new Invalid('A section has too many items.');
        return {
          id: s.id, title: str(s.title, 120, 'A section title').trim(),
          items: s.items.map(it => {
            if (!it || !ID_RE.test(it.id) || seen.has(it.id) || !KINDS.has(it.kind)) throw new Invalid('An item has a missing ID or unknown type.');
            seen.add(it.id);
            const o = { id: it.id, kind: it.kind };
            if (it.kind === 'note') { o.html = sanitizeHtml(it.html); return o; }
            o.title = str(it.title, 200, 'An item title').trim();
            o.sub = str(it.sub, 300, 'An item description').trim();
            if (!o.title) throw new Invalid('Every item needs a title.');
            if (it.kind === 'form') {
              if (!formIds.has(it.formId)) throw new Invalid(`“${o.title}” points to a form that doesn’t exist.`);
              o.formId = it.formId; if (it.quick) o.quick = true;
            } else if (it.kind === 'page') {
              if (!deptIds.has(it.target)) throw new Invalid(`“${o.title}” points to a folder that doesn’t exist.`);
              o.target = it.target;
            } else {
              const u = str(it.url, 2000, 'A web address').trim();
              if (!urlOk(u)) throw new Invalid(`“${o.title}” needs a web address starting with https://`);
              o.url = u;
              if (it.kind === 'doc' && it.fileName) o.fileName = str(it.fileName, 200, 'A file name');
            }
            return o;
          })
        };
      })
    };
  });
  return { departments };
}

const FIELD_TYPES = new Set(['head', 'divider', 'text', 'textbox', 'textarea', 'email', 'number', 'phone', 'fullname', 'address', 'date', 'datetime', 'time',
  'dropdown', 'radio', 'checkbox', 'rating', 'scale', 'file', 'signature', 'calculation', 'products']);
const OPS = new Set(['equals', 'notEquals', 'isEmpty', 'isFilled', 'contains', 'lessThan', 'greaterThan']);

function cleanForm(def) {
  if (!def || typeof def !== 'object') throw new Invalid('The form could not be read.');
  if (!ID_RE.test(def.id || '')) throw new Invalid('The form has no ID.');
  const name = str(def.name, 120, 'The form name').trim();
  if (!name) throw new Invalid('Give the form a name.');
  if (!Array.isArray(def.fields) || def.fields.length > 400) throw new Invalid('A form can have up to 400 questions.');
  const ids = new Set();
  const fields = def.fields.map((f, i) => {
    if (!f || !/^[A-Za-z0-9_]{1,40}$/.test(f.id) || ids.has(f.id)) throw new Invalid(`Question ${i + 1} has a missing or duplicate ID.`);
    if (!FIELD_TYPES.has(f.type)) throw new Invalid(`Question ${i + 1} has an unknown type.`);
    ids.add(f.id);
    const o = { id: f.id, type: f.type, label: str(f.label, 500, `Question ${i + 1}’s wording`) };
    if (f.required) o.required = true;
    if (f.sub) o.sub = str(f.sub, 5000, `Question ${i + 1}’s description`);
    if (f.html) o.html = str(f.html, 5000, `Question ${i + 1}’s text`);
    if (f.placeholder) o.placeholder = str(f.placeholder, 200, 'A placeholder');
    if (Array.isArray(f.parts)) o.parts = f.parts.slice(0, 8).map(p => str(p, 60, 'A name part'));
    if (['dropdown', 'radio', 'checkbox'].includes(f.type)) {
      if (!Array.isArray(f.options) || !f.options.filter(x => String(x).trim()).length) throw new Invalid(`“${o.label || 'Question ' + (i + 1)}” needs at least one option.`);
      o.options = f.options.map(x => str(String(x), 300, 'An option').trim()).filter(Boolean).slice(0, 200);
      if (f.other && f.type !== 'dropdown') o.other = true;
    }
    if (['rating', 'scale'].includes(f.type)) o.max = Math.min(10, Math.max(2, Number(f.max) || 5));
    if (f.type === 'time' && f.range) o.range = true;
    if (f.type === 'calculation' && Array.isArray(f.sum)) o.sum = f.sum.map(String).slice(0, 50);
    if (f.type === 'products') {
      if (!Array.isArray(f.products) || !f.products.length) throw new Invalid(`“${o.label || 'Product list'}” needs at least one item.`);
      o.products = f.products.slice(0, 200).map(p => ({
        name: str(p.name, 200, 'A product name').trim() || 'Item', max: Math.min(100, Math.max(1, Number(p.max) || 1)),
        opts: (p.opts || []).slice(0, 5).map(x => ({ name: str(x.name, 60, 'An option name').trim() || 'Option', values: (x.values || []).map(v => str(String(v), 60, 'An option value').trim()).filter(Boolean).slice(0, 50) })).filter(x => x.values.length)
      }));
    }
    if (f.needsTrigger) o.needsTrigger = true;
    return o;
  });
  if (fields.filter(f => Engine.INPUT_TYPES.has(f.type)).length === 0) throw new Invalid('Add at least one question people can answer.');
  for (const f of fields) if (f.sum) f.sum = f.sum.filter(id => ids.has(id));
  const rules = (Array.isArray(def.rules) ? def.rules : []).slice(0, 1000).map(r => ({
    link: r.link === 'all' ? 'all' : 'any', action: r.action === 'hide' ? 'hide' : 'show',
    terms: (r.terms || []).filter(t => ids.has(t.field) && OPS.has(t.op)).slice(0, 20).map(t => ({ field: t.field, op: t.op, value: str(String(t.value ?? ''), 300, 'A rule value') })),
    targets: (r.targets || []).filter(id => ids.has(id)).slice(0, 400)
  })).filter(r => r.terms.length && r.targets.length);
  const title = (fields.find(f => f.type === 'head' && f.label) || {}).label || name;
  return { id: def.id, name, title, fields, rules };
}
const Engine = require('../public/engine.js');

// IDs of uploaded files the hub links to (so unused uploads can be tidied away)
function referencedDocIds(hub) {
  const ids = new Set();
  for (const d of hub.departments) { const m = d.image && d.image.match(/^\/files\/([0-9a-f-]{36})\//); if (m) ids.add(m[1]); }
  for (const d of hub.departments) for (const s of d.sections) for (const it of s.items) {
    const m = it.url && it.url.match(/^\/files\/([0-9a-f-]{36})\//);
    if (m) ids.add(m[1]);
  }
  return ids;
}

module.exports = { seedHub, seedForms, cleanHub, cleanForm, sanitizeHtml, referencedDocIds, newId, Invalid };
