// Helpful HR's knowledge: everything in the hub, split into passages and searchable.
// Sources: documents (PDF, Word, Excel, PowerPoint: uploaded or linked), forms, notes, the folder
// directory and announcements. Document text is extracted once and kept in the settings store.
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const EXTRACT = path.join(__dirname, '..', 'scripts', 'extract_text.py');
const PY = process.env.PYTHON || 'python3';
const MAX_DOWNLOAD = 30 * 1048576;
const STOP = new Set('a an and are as at be been but by can could do does for from had has have how i if in into is it its may me might my no not of on or our please should so than that the their them then there these they this to us was we were what when where which who why will with would you your yours about any also all just only out up over per via'.split(' '));
// a few everyday words people use for what policies call something else
const SYN = {
  subsistence: ['meal', 'food', 'allowance', 'lunch', 'dinner', 'breakfast'], meal: ['subsistence', 'food'], food: ['subsistence', 'meal'], lunch: ['subsistence', 'meal'], dinner: ['subsistence', 'meal'],
  expense: ['claim', 'reimburse', 'receipt'], claim: ['expense'], receipt: ['expense'],
  holiday: ['annual', 'leave', 'vacation'], vacation: ['holiday', 'leave'], leave: ['holiday', 'absence'],
  sick: ['sickness', 'illness', 'absence'], sickness: ['sick', 'illness'], ill: ['sick', 'sickness'],
  mileage: ['mile', 'car', 'vehicle', 'fuel'], mile: ['mileage'],
  accident: ['incident', 'injury', 'injured', 'first aid'], incident: ['accident', 'injury'], injury: ['accident', 'incident', 'injured'], hurt: ['injury', 'accident', 'incident'],
  report: ['form'], book: ['request'], booking: ['request'], car: ['vehicle', 'mileage'], petrol: ['fuel', 'mileage'], fuel: ['mileage', 'petrol'],
  hotel: ['accommodation', 'overnight'], accommodation: ['hotel', 'overnight'], travel: ['trip', 'journey', 'mileage'],
  pay: ['salary', 'payroll', 'wage'], salary: ['pay', 'payroll'], payslip: ['payroll', 'pay'],
  maternity: ['parental', 'paternity', 'family'], paternity: ['parental', 'maternity', 'family'],
  wfh: ['home', 'remote', 'hybrid'], remote: ['home', 'hybrid'], uniform: ['clothing', 'ppe', 'workwear'], ppe: ['safety', 'equipment', 'uniform'],
  phone: ['mobile', 'telephone'], laptop: ['computer', 'equipment', 'it'], bonus: ['commission', 'incentive'], pension: ['retirement'],
  overtime: ['hours', 'toil'], toil: ['overtime', 'lieu'], grievance: ['complaint', 'disciplinary'], complaint: ['grievance']
};
const stem = w => w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('ed') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const words = t => String(t || '').toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9£]+/).filter(w => w && !STOP.has(w) && (w.length > 1 || /\d/.test(w)));
const tokens = t => words(t).map(stem);
const strip = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h3|div)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').trim();
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 20);

function chunk(text, size = 1100) {
  const paras = String(text || '').split(/\n\s*\n|\n(?=[A-Z0-9•\-•]\S)/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const out = []; let cur = '';
  for (const p of paras) {
    if (p.length > size * 1.5) {   // a long paragraph: split on sentences
      if (cur) { out.push(cur); cur = ''; }
      let piece = '';
      for (const s of p.split(/(?<=[.!?;:])\s+/)) { if ((piece + ' ' + s).length > size && piece) { out.push(piece); piece = s; } else piece = piece ? piece + ' ' + s : s; }
      if (piece) cur = piece;
      continue;
    }
    if ((cur + '\n' + p).length > size && cur) { out.push(cur); cur = (cur.split('\n').pop().length < 300 ? cur.split('\n').pop() + '\n' : '') + p; }
    else cur = cur ? cur + '\n' + p : p;
  }
  if (cur) out.push(cur);
  return out;
}

function makeKnowledge({ store, getHub, getForms, board, allowHosts = [] }) {
  const state = { running: false, total: 0, done: 0, failed: [], lastRun: null };
  let index = null, dirty = true;
  const docKey = url => 'KB:' + sha(url);

  function hubDocs() {
    const out = [];
    for (const d of getHub().departments) for (const s of d.sections) for (const it of s.items)
      if (it.kind === 'doc') out.push({ url: it.url, title: it.title, sub: it.sub, dept: d, sec: s, fileName: it.fileName || decodeURIComponent(String(it.url).split('/').pop().split('?')[0]) });
    return out;
  }
  const run = (file, name) => new Promise(resolve => {
    execFile(PY, [EXTRACT, file, name], { timeout: 90e3, maxBuffer: 64 * 1048576 }, (err, stdout) => {
      if (err && !stdout) return resolve({ pages: [], error: err.killed ? 'It took too long to read.' : 'The reader isn’t available (' + (err.code || err.message) + ').' });
      try { resolve(JSON.parse(stdout)); } catch { resolve({ pages: [], error: 'The text couldn’t be read.' }); }
    });
  });
  async function fetchBytes(url) {
    const m = url.match(/^\/files\/([0-9a-f-]{36})\//);
    if (m) { const f = await store.getDoc(m[1]); if (!f) throw new Error('The uploaded file is missing.'); return f.buffer; }
    const u = new URL(url);
    const okHost = u.protocol === 'https:' || (u.protocol === 'http:' && allowHosts.some(h => u.hostname === h));
    if (!okHost) throw new Error('Only https links can be read.');
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45e3) });
    if (!r.ok) throw new Error(`The link returned ${r.status}.`);
    if (Number(r.headers.get('content-length') || 0) > MAX_DOWNLOAD) throw new Error('The file is over 30 MB.');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD) throw new Error('The file is over 30 MB.');
    if (/text\/html/i.test(r.headers.get('content-type') || '') && !/\.html?$/i.test(u.pathname)) throw new Error('The link opens a web page, not a file (it may need a sign-in).');
    return buf;
  }
  async function readDoc(doc) {
    const tmp = path.join(os.tmpdir(), 'kb-' + crypto.randomBytes(6).toString('hex'));
    try {
      const buf = await fetchBytes(doc.url);
      fs.writeFileSync(tmp, buf);
      const out = await run(tmp, doc.fileName || doc.url);
      const pages = (out.pages || []).map(p => String(p || ''));
      const chars = pages.reduce((a, p) => a + p.trim().length, 0);
      if (out.error) return { ok: false, err: out.error };
      if (chars < 20) return { ok: false, err: 'No text found. It may be a scanned image, so its text can’t be searched.' };
      return { ok: true, pages };
    } catch (e) { return { ok: false, err: e.message }; }
    finally { fs.rm(tmp, { force: true }, () => {}); }
  }
  // Read any documents not read yet (or all of them when forced). Runs in the background.
  async function refresh(force = false) {
    if (state.running) return state;
    state.running = true; state.failed = []; state.done = 0;
    try {
      const docs = [...new Map(hubDocs().map(d => [d.url, d])).values()];
      state.total = docs.length;
      const todo = [];
      for (const d of docs) {
        const c = await store.getSetting(docKey(d.url));
        if (c && !force && (c.ok || Date.now() - new Date(c.at).getTime() < 6 * 3600e3)) { state.done++; if (!c.ok) state.failed.push({ title: d.title, err: c.err }); continue; }
        todo.push(d);
      }
      let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          const d = todo[i++];
          const r = await readDoc(d);
          await store.setSetting(docKey(d.url), Object.assign({ url: d.url, title: d.title, at: new Date().toISOString() }, r));
          if (!r.ok) state.failed.push({ title: d.title, err: r.err });
          state.done++; dirty = true;
        }
      };
      await Promise.all([worker(), worker(), worker()]);
      if (todo.length) console.log(`[helpful-hr] Read ${todo.length - state.failed.filter(f => todo.some(t => t.title === f.title)).length} of ${todo.length} new documents (${state.total} in the hub).`);
    } catch (e) { console.error('[helpful-hr] Reading documents failed:', e); }
    finally { state.running = false; state.lastRun = new Date().toISOString(); dirty = true; }
    return state;
  }

  async function build() {
    const hub = getHub(), forms = getForms(), passages = [];
    const add = (src, text, page) => { for (const t of chunk(text)) if (t.length > 15) passages.push({ src, page, text: t }); };
    // the folder directory: where things are
    for (const d of hub.departments) for (const s of d.sections) {
      const list = s.items.filter(i => i.kind !== 'note').map(i => `${i.title}${i.sub ? ' (' + i.sub + ')' : ''}: ${i.kind === 'form' ? 'form' : i.kind === 'doc' ? 'document' : i.kind === 'page' ? 'folder' : 'link'}`);
      if (list.length) add({ kind: 'folder', title: `${d.name}${s.title ? ' › ' + s.title : ''}`, url: '#d/' + d.id, where: d.name }, `In the hub, the ${d.name} folder${s.title ? ', section “' + s.title + '”,' : ''} contains: ${list.join('; ')}.`);
      for (const n of s.items.filter(i => i.kind === 'note')) add({ kind: 'note', title: `${d.name}${s.title ? ' › ' + s.title : ''}`, url: '#d/' + d.id, where: d.name }, strip(n.html));
    }
    // forms: what they ask, so "how do I report an incident" finds the right one
    const formDept = {};
    for (const d of hub.departments) for (const s of d.sections) for (const i of s.items) if (i.kind === 'form' && !formDept[i.formId]) formDept[i.formId] = d.name;
    for (const f of Object.values(forms)) {
      const qs = f.fields.filter(x => x.label || x.html).map(x => x.type === 'text' ? strip(x.html) : x.type === 'head' ? `${x.label}${x.sub ? ': ' + strip(x.sub) : ''}` : `${x.label}${x.options ? ' (' + x.options.slice(0, 12).join(', ') + ')' : ''}`);
      add({ kind: 'form', title: f.name, url: '#form/' + f.id, where: formDept[f.id] || 'Forms' }, `“${f.name}” is a form in the hub${formDept[f.id] ? ' (' + formDept[f.id] + ')' : ''}. It asks: ${qs.join('; ')}`);
    }
    // documents
    for (const d of hubDocs()) {
      const c = await store.getSetting(docKey(d.url));
      const src = { kind: 'doc', title: d.title, url: d.url, where: `${d.dept.name}${d.sec.title ? ' › ' + d.sec.title : ''}`, sub: d.sub };
      if (c && c.ok) c.pages.forEach((p, i) => add(src, p, c.pages.length > 1 ? i + 1 : null));
    }
    // announcements
    for (const n of (await board.allNews()).filter(n => n.status !== 'draft')) {
      add({ kind: 'news', title: n.title, url: '#news', where: 'Announcements', date: n.at }, `Announcement “${n.title}” posted ${new Date(n.at).toLocaleDateString('en-GB')} by ${n.by}: ${strip(n.html !== undefined ? n.html : n.body)}`);
    }
    // BM25 statistics
    const df = new Map();
    for (const p of passages) {
      p.tf = new Map(); const tk = tokens(p.text + ' ' + p.src.title); p.len = tk.length;
      for (const t of tk) p.tf.set(t, (p.tf.get(t) || 0) + 1);
      p.title = new Set(tokens(p.src.title));
      for (const t of p.tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    }
    const avg = passages.reduce((a, p) => a + p.len, 0) / Math.max(1, passages.length);
    index = { passages, df, avg, n: passages.length, at: Date.now() };
    dirty = false;
    return index;
  }
  async function search(query, { extra = '', k = 8 } = {}) {
    if (!index || dirty) await build();
    const { passages, df, avg, n } = index;
    const q = new Map();
    const addQ = (t, w) => q.set(t, Math.max(q.get(t) || 0, w));
    for (const w of words(query)) { addQ(stem(w), 1); for (const s of SYN[w] || SYN[stem(w)] || []) addQ(stem(s), .45); }
    for (const w of words(extra)) addQ(stem(w), .35);   // the previous question, for follow-ups like "what about Manchester?"
    if (!q.size) return [];
    const idf = t => Math.log(1 + (n - (df.get(t) || 0) + .5) / ((df.get(t) || 0) + .5));
    const scored = [];
    for (const p of passages) {
      let s = 0, hits = 0;
      for (const [t, w] of q) {
        const f = p.tf.get(t); if (!f) continue;
        hits++; s += w * idf(t) * (f * 2.2) / (f + 1.2 * (.25 + .75 * p.len / avg));
        if (p.title.has(t)) s += w * idf(t) * .8;
      }
      if (s > 0) scored.push({ p, s: s * (1 + .15 * (hits - 1)) * (p.src.kind === 'doc' ? 1.1 : p.src.kind === 'folder' ? .8 : 1) });
    }
    scored.sort((a, b) => b.s - a.s);
    const out = [], per = new Map();
    for (const x of scored) {
      const key = x.p.src.url; const c = per.get(key) || 0;
      if (c >= 3) continue;
      per.set(key, c + 1); out.push(Object.assign({ score: x.s }, x.p));
      if (out.length >= k) break;
    }
    return out;
  }
  async function status() {
    const docs = [...new Map(hubDocs().map(d => [d.url, d])).values()];
    let read = 0; const failed = [];
    for (const d of docs) { const c = await store.getSetting(docKey(d.url)); if (c && c.ok) read++; else if (c) failed.push({ title: d.title, where: d.dept.name, err: c.err }); }
    if (!index || dirty) await build();
    return { documents: docs.length, read, failed, waiting: docs.length - read - failed.length, passages: index.n, running: state.running, progress: state.running ? { done: state.done, total: state.total } : null, lastRun: state.lastRun };
  }
  return { refresh, search, status, markDirty: () => { dirty = true; } };
}
module.exports = { makeKnowledge, tokens, chunk, strip };
