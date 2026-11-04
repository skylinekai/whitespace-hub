/* Whitespace Hub editor (admins only): folders, sections, items, file uploads and the form builder. */
window.initHubEditor = function (ctx) {
  'use strict';
  const { h, icon, esc, toast } = ctx;
  const $ = (s, el = document) => el.querySelector(s);
  const clone = o => JSON.parse(JSON.stringify(o));
  const nid = p => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const ok = t => toast(`${icon('check')}<span>${esc(t)}</span>`, 'ok');
  const bad = t => toast(`${icon('err')}<span>${esc(t)}</span>`, 'error');
  const COLORS = ['#0F6CBD', '#1F5FB8', '#3B3A63', '#9013FE', '#B86BE0', '#E86FB0', '#E3008C', '#BD0019', '#FE3945', '#FB7041', '#D4C21A', '#5FA812', '#02AE8F', '#038387', '#0099FF', '#3FA7EE', '#972D54', '#616161'];

  async function api(url, { method = 'GET', json, form } = {}) {
    const r = await fetch(url, { method, headers: json ? { 'Content-Type': 'application/json' } : undefined, body: json ? JSON.stringify(json) : form });
    if (r.status === 401) { ctx.toLogin(); throw Object.assign(new Error('You’ve been signed out.'), { status: 401 }); }
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(out.error || 'That didn’t save. Try again.'), { status: r.status, body: out });
    return out;
  }
  // Every hub change: copy the content, change the copy, save it; the server checks it and bumps the version.
  async function save(mutate, msg) {
    const doc = clone(ctx.hub);
    if (mutate(doc) === false) return false;
    try {
      const out = await api('/api/admin/content', { method: 'PUT', json: doc });
      ctx.setHub(out); ctx.route(); if (msg) ok(msg); return true;
    } catch (e) {
      if (e.status === 409 && e.body && e.body.hub) { ctx.setHub(e.body.hub); ctx.route(); }
      bad(e.message); return false;
    }
  }
  const findDept = (doc, id) => doc.departments.find(d => d.id === id);
  function findSec(doc, sid) { for (const d of doc.departments) { const i = d.sections.findIndex(s => s.id === sid); if (i >= 0) return { d, i, s: d.sections[i] }; } return null; }
  function findItem(doc, iid) { for (const d of doc.departments) for (const s of d.sections) { const i = s.items.findIndex(x => x.id === iid); if (i >= 0) return { d, s, i, it: s.items[i] }; } return null; }
  const move = (arr, i, by) => { const j = i + by; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };

  // ---------- dialogs ----------
  function dialog(title, body, { submit = 'Save', danger = false, wide = false } = {}) {
    return new Promise(resolve => {
      const ov = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
      const err = h('div', { role: 'alert' });
      const btn = h('button', { class: 'btn primary' + (danger ? ' dangerbtn' : ''), type: 'submit' }, submit);
      const box = h('form', { class: 'dialog' + (wide ? ' wide' : ''), novalidate: true },
        h('h2', { class: 'dtitle' }, title), err, body,
        h('div', { class: 'cmdbar dfoot' }, h('button', { class: 'btn', type: 'button', onclick: () => done(null) }, 'Cancel'), btn));
      const done = v => { ov.remove(); document.removeEventListener('keydown', esc_); resolve(v); };
      const esc_ = e => { if (e.key === 'Escape') done(null); };
      document.addEventListener('keydown', esc_);
      ov.addEventListener('mousedown', e => { if (e.target === ov) done(null); });
      box.showError = t => { err.className = 'bar-msg error'; err.innerHTML = icon('err') + `<div>${esc(t)}</div>`; };
      box.addEventListener('submit', async e => {
        e.preventDefault();
        if (box.onsave) { btn.disabled = true; try { const v = await box.onsave(); if (v !== undefined && v !== false) done(v); } catch (x) { box.showError(x.message); } btn.disabled = false; }
        else done(true);
      });
      ov.append(box); document.body.append(ov);
      const first = box.querySelector('input:not([type=hidden]):not([type=radio]):not([type=file]),select,textarea'); (first || btn).focus();
      box._resolveWith = done;
      body._box = box;
    });
  }
  const field = (label, ctl, hint) => h('div', { class: 'q dq' }, h('label', { for: ctl.id }, label), ctl, hint ? h('div', { class: 'hint', style: 'margin-top:4px' }, hint) : null);
  const input = (id, value = '', attrs = {}) => { const i = h('input', Object.assign({ id, class: 'ctl' }, attrs)); i.value = value; return i; };
  const confirmBox = (title, text, button = 'Delete') => dialog(title, h('p', { class: 'subtitle', style: 'margin:8px 0 0' }, text), { submit: button, danger: true });

  // ---------- folders ----------
  function colorPicker(current) {
    const wrap = h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Colour' });
    let val = current || COLORS[0];
    const custom = h('input', { type: 'color', class: 'swc', 'aria-label': 'Choose any colour', value: val });
    const paint = () => wrap.querySelectorAll('.sw').forEach(b => b.setAttribute('aria-checked', b.dataset.c.toLowerCase() === val.toLowerCase()));
    COLORS.forEach(c => wrap.append(h('button', { type: 'button', class: 'sw', role: 'radio', 'data-c': c, style: `background:${c}`, 'aria-label': c, onclick: () => { val = c; custom.value = c; paint(); } })));
    custom.addEventListener('input', () => { val = custom.value; paint(); });
    wrap.append(custom); paint();
    wrap.value = () => val;
    return wrap;
  }
  async function folderDialog(id, group) {
    const d = id ? findDept(ctx.hub, id) : null;
    const name = input('fdName', d ? d.name : '', { maxlength: '60', placeholder: 'e.g. Marketing' });
    const colors = colorPicker(d ? d.color : COLORS[Math.floor(Math.random() * COLORS.length)]);
    const where = h('div', { class: 'seg' },
      ...[['main', 'Departments'], ['more', 'More']].map(([v, l]) => h('label', {}, h('input', { type: 'radio', name: 'fdGroup', value: v, checked: (d ? d.group : group || 'main') === v }), h('span', {}, l))));
    const body = h('div', {}, field('Folder name', name), h('div', { class: 'q dq' }, h('div', { class: 'qlabel' }, 'Colour'), colors), h('fieldset', { class: 'q dq' }, h('legend', {}, 'Show under'), where));
    const p = dialog(d ? 'Edit folder' : 'New folder', body, { submit: d ? 'Save' : 'Create folder' });
    body._box.onsave = async () => {
      const n = name.value.trim(); if (!n) throw new Error('Give the folder a name.');
      const g = body.querySelector('[name=fdGroup]:checked').value, newId = nid('d');
      const done = await save(doc => {
        if (d) { const x = findDept(doc, d.id); x.name = n; x.color = colors.value(); x.group = g; }
        else doc.departments.push({ id: newId, name: n, color: colors.value(), group: g, sections: [{ id: nid('s'), title: '', items: [] }] });
      }, d ? 'Folder saved.' : `Created “${n}”.`);
      if (done && !d) location.hash = '#d/' + newId;
      return done || undefined;
    };
    return p;
  }
  async function deleteFolder(id) {
    const d = findDept(ctx.hub, id);
    const n = d.sections.reduce((a, s) => a + s.items.length, 0);
    const yes = await confirmBox(`Delete “${d.name}”?`, n ? `This removes the folder and the ${n} item${n > 1 ? 's' : ''} in it from the hub. Forms stay in Submissions with their past answers, and you can add them to another folder later.` : 'This folder is empty.', 'Delete folder');
    if (!yes) return;
    const links = ctx.items.filter(x => x.type === 'page' && x.it.target === id);
    await save(doc => {
      doc.departments = doc.departments.filter(x => x.id !== id);
      for (const dd of doc.departments) for (const s of dd.sections) s.items = s.items.filter(it => !(it.kind === 'page' && it.target === id));
    }, `Deleted “${d.name}”${links.length ? ' and the links to it' : ''}.`);
    if (location.hash === '#d/' + id) location.hash = '#home';
  }
  function deptMenu(id, x, y, anchor) {
    ctx.closeMenu();
    const d = findDept(ctx.hub, id); if (!d) return;
    const sameGroup = ctx.hub.departments.filter(z => z.group === d.group), gi = sameGroup.indexOf(d);
    const item = (ic, label, fn, dis) => h('button', { class: 'mi', type: 'button', role: 'menuitem', disabled: dis || null, html: icon(ic) + `<span>${esc(label)}</span>`, onclick: () => { ctx.closeMenu(); fn(); } });
    const shift = by => save(doc => {
      const list = doc.departments, me = list.findIndex(z => z.id === id), grp = list[me].group;
      let j = me + by; while (j >= 0 && j < list.length && list[j].group !== grp) j += by;
      if (j < 0 || j >= list.length) return false;
      [list[me], list[j]] = [list[j], list[me]];
    });
    const m = h('div', { class: 'ctxmenu', role: 'menu', 'aria-label': d.name + ' options' },
      item('folder', 'Open', () => { location.hash = '#d/' + id; }),
      item('rename', 'Rename or change colour…', () => folderDialog(id)),
      item('up', 'Move up', () => shift(-1), gi === 0),
      item('down', 'Move down', () => shift(1), gi === sameGroup.length - 1),
      item('folder', d.group === 'more' ? 'Move to Departments' : 'Move to More', () => save(doc => { findDept(doc, id).group = d.group === 'more' ? 'main' : 'more'; })),
      h('div', { class: 'sep', role: 'separator' }),
      item('add', 'New folder…', () => folderDialog(null, d.group)),
      item('del', 'Delete folder…', () => deleteFolder(id)));
    ctx.openAt(m, x, y, anchor);
  }

  // ---------- sections ----------
  async function sectionDialog(deptId, sid) {
    const s = sid ? findSec(ctx.hub, sid).s : null;
    const t = input('sdTitle', s ? s.title : '', { maxlength: '120', placeholder: 'e.g. Expenses' });
    const body = h('div', {}, field('Section heading', t, 'Leave blank for a section without a heading.'));
    const p = dialog(s ? 'Rename section' : 'Add a section', body, { submit: s ? 'Save' : 'Add section' });
    body._box.onsave = async () => (await save(doc => {
      if (s) findSec(doc, sid).s.title = t.value.trim();
      else findDept(doc, deptId).sections.push({ id: nid('s'), title: t.value.trim(), items: [] });
    }, s ? 'Section renamed.' : 'Section added.')) || undefined;
    return p;
  }

  // ---------- items ----------
  const htmlToText = html => { const d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n'); return d.textContent.replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim(); };
  const textToHtml = t => String(t || '').trim().split(/\n\s*\n/).map(block => {
    const lines = block.split('\n');
    if (lines.every(l => /^\s*[-•*]\s+/.test(l))) return '<ul>' + lines.map(l => `<li>${esc(l.replace(/^\s*[-•*]\s+/, ''))}</li>`).join('') + '</ul>';
    return `<p>${lines.map(esc).join('<br>')}</p>`;
  }).join('');
  const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

  async function itemDialog(sid, iid) {
    await ctx.loadFormList();
    const found = iid ? findItem(ctx.hub, iid) : null, it = found ? clone(found.it) : null;
    const loc = found ? { d: found.d.id, s: found.s.id } : (() => { const f = findSec(ctx.hub, sid); return { d: f.d.id, s: sid }; })();
    let kind = it ? it.kind : 'form';
    const KINDS = [['form', 'Form'], ['doc', 'Document'], ['link', 'Link'], ['note', 'Note'], ['page', 'Folder link']];
    if (kind === 'app') KINDS.push(['app', 'App']);
    const typeSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Type' }, ...KINDS.map(([v, l]) => h('label', {}, h('input', { type: 'radio', name: 'itKind', value: v, checked: kind === v }), h('span', {}, l))));
    const title = input('itTitle', it ? it.title || '' : '', { maxlength: '200' });
    const sub = input('itSub', it ? it.sub || '' : '', { maxlength: '300', placeholder: 'Optional, e.g. Issue 1 Rev 4' });
    // form
    const formSel = h('select', { id: 'itForm', class: 'ctl' }, h('option', { value: '' }, 'Choose a form'), h('option', { value: '__new' }, '+ Create a new form'),
      ...ctx.formList.map(f => h('option', { value: f.id }, f.name)));
    formSel.value = it && it.formId ? it.formId : '';
    const newName = input('itNewForm', '', { placeholder: 'e.g. Van Check Form', maxlength: '120' });
    const newBox = field('Name of the new form', newName, 'You’ll add the questions next.'); newBox.hidden = true;
    const quick = h('input', { type: 'checkbox', id: 'itQuick', checked: !!(it && it.quick) });
    const formBox = h('div', {}, field('Form', formSel), newBox, h('label', { class: 'opt', for: 'itQuick' }, quick, h('span', {}, 'Show as a quick action on the Home page')));
    // document
    const fileIn = h('input', { type: 'file', id: 'itFile' });
    const fileInfo = h('div', { class: 'fileinfo' });
    const docUrl = input('itDocUrl', it && it.kind === 'doc' && !String(it.url).startsWith('/files/') ? it.url : '', { placeholder: 'https://…', inputmode: 'url' });
    let uploaded = it && it.kind === 'doc' && String(it.url).startsWith('/files/') ? { url: it.url, filename: it.fileName || decodeURIComponent(it.url.split('/').pop()) } : null;
    const paintFile = () => { fileInfo.innerHTML = uploaded ? `${icon('check')}<span><b>${esc(uploaded.filename)}</b>${uploaded.size ? ' · ' + fmtSize(uploaded.size) : ''}</span>` : ''; };
    paintFile();
    const drop = h('label', { class: 'filebox', for: 'itFile' }, h('span', { class: 'btn', html: icon('upload') + (uploaded ? 'Replace file' : 'Choose file') }), h('span', { class: 'hint2' }, 'PDF, Word, Excel, PowerPoint, images or video, up to 50 MB. Or drag a file here.'), fileIn);
    const docBox = h('div', {}, h('div', { class: 'q dq' }, h('div', { class: 'qlabel' }, 'File'), drop, fileInfo), field('Or link to a file somewhere else', docUrl, 'For example SharePoint or OneDrive. Leave blank if you uploaded a file.'));
    async function doUpload(f) {
      if (!f) return;
      if (f.size > 50 * 1048576) return body._box.showError(`${f.name} is over 50 MB. Upload a smaller version, or link to it instead.`);
      fileInfo.innerHTML = `<span class="spinner"></span><span>Uploading ${esc(f.name)}…</span>`;
      const fd = new FormData(); fd.append('file', f, f.name);
      try {
        const out = await api('/api/admin/files', { method: 'POST', form: fd });
        uploaded = out; docUrl.value = '';
        if (!title.value.trim()) title.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        paintFile(); drop.querySelector('.btn').innerHTML = icon('upload') + 'Replace file';
      } catch (e) { uploaded = null; paintFile(); body._box.showError(e.message); }
    }
    fileIn.addEventListener('change', () => doUpload(fileIn.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('drag'); doUpload(e.dataTransfer.files[0]); });
    // link / app
    const linkUrl = input('itUrl', it && (it.kind === 'link' || it.kind === 'app') ? it.url : '', { placeholder: 'https://…', inputmode: 'url' });
    const linkBox = h('div', {}, field('Web address', linkUrl));
    // note
    const noteText = h('textarea', { id: 'itNote', class: 'ctl', rows: 7 }); noteText.value = it && it.kind === 'note' ? htmlToText(it.html) : '';
    const noteBox = h('div', {}, field('Note', noteText, 'Leave a blank line between paragraphs. Start lines with “- ” for a bullet list.'));
    // folder link
    const pageSel = h('select', { id: 'itPage', class: 'ctl' }, ...ctx.hub.departments.map(d => h('option', { value: d.id }, d.name)));
    if (it && it.target) pageSel.value = it.target;
    const pageBox = h('div', {}, field('Opens folder', pageSel));
    // location
    const deptSel = h('select', { id: 'itDept', class: 'ctl' }, ...ctx.hub.departments.map(d => h('option', { value: d.id }, d.name)));
    const secSel = h('select', { id: 'itSec', class: 'ctl' });
    const fillSecs = keep => { const d = findDept(ctx.hub, deptSel.value); secSel.innerHTML = ''; d.sections.forEach(s => secSel.append(h('option', { value: s.id }, s.title || 'Untitled section'))); if (keep) secSel.value = keep; };
    deptSel.value = loc.d; fillSecs(loc.s);
    deptSel.addEventListener('change', () => fillSecs());
    const locBox = h('div', { class: 'grid2 locbox' }, field('Folder', deptSel), field('Section', secSel));
    const common = h('div', {}, field('Title', title), field('Description', sub));
    const boxes = { form: formBox, doc: docBox, link: linkBox, app: linkBox, note: noteBox, page: pageBox };
    const body = h('div', {}, h('fieldset', { class: 'q dq' }, h('legend', {}, 'Type'), typeSeg), common, formBox, docBox, linkBox, noteBox, pageBox, locBox);
    const show = () => {
      kind = typeSeg.querySelector('input:checked').value;
      Object.values(boxes).forEach(b => { b.hidden = true; }); boxes[kind].hidden = false;
      common.hidden = kind === 'note'; newBox.hidden = !(kind === 'form' && formSel.value === '__new');
    };
    typeSeg.addEventListener('change', show);
    formSel.addEventListener('change', () => {
      newBox.hidden = formSel.value !== '__new';
      const f = ctx.formList.find(x => x.id === formSel.value);
      if (f && (!title.value.trim() || ctx.formList.some(x => x.name === title.value))) title.value = f.name;
      if (formSel.value === '__new') newName.focus();
    });
    newName.addEventListener('input', () => { if (!title.value.trim() || title.dataset.auto) { title.value = newName.value; title.dataset.auto = '1'; } });
    show();
    const p = dialog(it ? 'Edit item' : 'Add to the hub', body, { submit: it ? 'Save' : 'Add', wide: true });
    body._box.onsave = async () => {
      const o = { id: it ? it.id : nid('i'), kind };
      let openBuilder = null;
      if (kind === 'note') { if (!noteText.value.trim()) throw new Error('Write the note.'); o.html = textToHtml(noteText.value); }
      else {
        o.title = title.value.trim(); o.sub = sub.value.trim();
        if (kind === 'form') {
          if (!formSel.value) throw new Error('Choose a form, or create a new one.');
          if (formSel.value === '__new') {
            const nm = newName.value.trim() || o.title; if (!nm) throw new Error('Give the new form a name.');
            const created = await api('/api/admin/forms', { method: 'POST', json: { name: nm } });
            ctx.FORMS[created.id] = created; o.formId = created.id; openBuilder = created.id; if (!o.title) o.title = nm;
          } else o.formId = formSel.value;
          if (quick.checked) o.quick = true;
        } else if (kind === 'doc') {
          if (docUrl.value.trim()) o.url = docUrl.value.trim();
          else if (uploaded) { o.url = uploaded.url; o.fileName = uploaded.filename; }
          else throw new Error('Upload a file, or paste a link to one.');
        } else if (kind === 'link' || kind === 'app') {
          o.url = linkUrl.value.trim();
          if (!/^(https?:\/\/\S+|\/\S*)$/i.test(o.url)) throw new Error('Enter a web address starting with https://');
        } else if (kind === 'page') o.target = pageSel.value;
        if (!o.title) throw new Error('Give it a title.');
      }
      const saved = await save(doc => {
        if (it) { const f = findItem(doc, it.id); f.s.items.splice(f.i, 1); if (f.s.id === secSel.value) { f.s.items.splice(f.i, 0, o); return; } }
        findSec(doc, secSel.value).s.items.push(o);
      }, it ? 'Saved.' : 'Added.');
      if (saved && openBuilder) location.hash = '#edit-form/' + openBuilder;
      else if (saved && secSel.value !== loc.s && deptSel.value !== loc.d) location.hash = '#d/' + deptSel.value;
      return saved || undefined;
    };
    return p;
  }
  async function deleteItem(iid) {
    const f = findItem(ctx.hub, iid);
    const what = f.it.kind === 'note' ? 'this note' : `“${f.it.title}”`;
    const extra = f.it.kind === 'form' ? ' The form itself and its submissions are kept; you can add it back or delete the form from its Edit form page.' : f.it.kind === 'doc' && String(f.it.url).startsWith('/files/') ? ' The uploaded file is deleted too.' : '';
    if (!(await confirmBox(`Remove ${what}?`, `This removes it from “${f.s.title || f.d.name}”.${extra}`, 'Remove'))) return;
    await save(doc => { const x = findItem(doc, iid); x.s.items.splice(x.i, 1); }, 'Removed.');
  }

  // ---------- copy documents still hosted on Jotform into the hub ----------
  async function importDocs(btn) {
    const n = ctx.items.filter(x => x.type === 'doc' && /jotform\.com/i.test(x.url)).length;
    const yes = await dialog('Copy documents from Jotform?', h('p', { class: 'subtitle', style: 'margin:8px 0 0' },
      `This downloads the ${n} documents that are still stored on Jotform and keeps them in the hub, so they keep working if you close your Jotform account. It can take a few minutes; you can carry on working.`), { submit: 'Copy documents' });
    if (!yes) return;
    btn.disabled = true;
    try {
      let job = await api('/api/admin/import-docs', { method: 'POST', json: {} });
      while (job.running) { btn.textContent = `Copying… ${job.done} of ${job.total || n}`; await new Promise(r => setTimeout(r, 1500)); job = await api('/api/admin/import-docs'); }
      const hub = await api('/api/hub'); ctx.setHub(hub); ctx.route();
      if (job.failed.length) bad(`Copied ${job.copied} of ${job.total}. ${job.failed.length} couldn’t be copied, for example “${job.failed[0].title}”: ${job.failed[0].reason}.`);
      else ok(`Copied ${job.copied} documents into the hub.`);
    } catch (e) { bad(e.message); btn.disabled = false; }
  }

  // ---------- dashboard: tasks and announcements ----------
  const findTask = id => [...((ctx.dash && ctx.dash.tasks) || []), ...(ctx.allTasks || [])].find(t => t.id === id);
  async function taskDialog(id) {
    const t = id ? findTask(id) : null;
    let people;
    try { people = (await api('/api/admin/tasks')).people; } catch (e) { return bad(e.message); }
    const title = input('tkTitle', t ? t.title : '', { maxlength: '200', placeholder: 'e.g. Send the Q4 stand budget to Finance' });
    const who = h('select', { id: 'tkWho', class: 'ctl' }, ...people.map(p => h('option', { value: p.id }, p.name + (p.id === ctx.me.id ? ' (you)' : ''))));
    who.value = String(t ? t.assignee : ctx.me.id);
    const due = input('tkDue', t ? t.due : '', { type: 'date' });
    const notes = h('textarea', { id: 'tkNotes', class: 'ctl', rows: 4, maxlength: '3000' }); notes.value = t ? t.notes || '' : '';
    const link = input('tkLink', t ? t.link : '', { placeholder: 'Optional, e.g. https://… or a form in the hub', inputmode: 'url' });
    const formPick = h('select', { class: 'ctl', 'aria-label': 'Link to a form in the hub' }, h('option', { value: '' }, 'Or pick a form…'), ...ctx.formList.map(f => h('option', { value: '#form/' + f.id }, f.name)));
    formPick.addEventListener('change', () => { if (formPick.value) link.value = formPick.value; });
    await ctx.loadFormList(); if (formPick.options.length < 2) ctx.formList.forEach(f => formPick.append(h('option', { value: '#form/' + f.id }, f.name)));
    const body = h('div', {}, field('Task', title), h('div', { class: 'grid2' }, field('Assign to', who), field('Due date', due, 'Optional')),
      field('Notes', notes), h('div', { class: 'q dq' }, h('label', { for: 'tkLink' }, 'Link'), link, h('div', { style: 'margin-top:6px' }, formPick)));
    const p = dialog(t ? 'Edit task' : 'Assign a task', body, { submit: t ? 'Save' : 'Assign task' });
    body._box.onsave = async () => {
      if (!title.value.trim()) throw new Error('Write what needs doing.');
      const data = { title: title.value, assignee: Number(who.value), due: due.value, notes: notes.value, link: link.value.trim() };
      await api(t ? '/api/admin/tasks/' + t.id : '/api/admin/tasks', { method: t ? 'PUT' : 'POST', json: data });
      const pn = people.find(x => x.id === data.assignee);
      ok(t ? 'Task saved.' : data.assignee === ctx.me.id ? 'Task added to your list.' : `Task assigned to ${pn ? pn.name : 'them'}.`);
      ctx.loadDash(); return true;
    };
    return p;
  }
  async function delTask(id) {
    const t = findTask(id); if (!t) return;
    if (!(await confirmBox(`Delete “${t.title}”?`, 'It will disappear from everyone’s task list.', 'Delete task'))) return;
    try { await api('/api/admin/tasks/' + id, { method: 'DELETE' }); ok('Task deleted.'); } catch (e) { bad(e.message); }
    ctx.loadDash();
  }
  async function newsDialog(id) {
    const n = id ? ctx.dash.news.find(x => x.id === id) : null;
    const title = input('nwTitle', n ? n.title : '', { maxlength: '200', placeholder: 'e.g. Office closed on Friday' });
    const msg = h('textarea', { id: 'nwBody', class: 'ctl', rows: 6, maxlength: '5000' }); msg.value = n ? n.body || '' : '';
    const link = input('nwLink', n ? n.link : '', { placeholder: 'Optional, https://…', inputmode: 'url' });
    const pin = h('input', { type: 'checkbox', id: 'nwPin', checked: !!(n && n.pinned) });
    const body = h('div', {}, field('Headline', title), field('Message', msg), field('Link', link),
      h('label', { class: 'opt', for: 'nwPin', style: 'margin-top:10px' }, pin, h('span', {}, 'Pin to the top')));
    const p = dialog(n ? 'Edit announcement' : 'New announcement', body, { submit: n ? 'Save' : 'Post', wide: true });
    body._box.onsave = async () => {
      if (!title.value.trim()) throw new Error('Write a headline.');
      await api(n ? '/api/admin/news/' + n.id : '/api/admin/news', { method: n ? 'PUT' : 'POST', json: { title: title.value, body: msg.value, link: link.value.trim(), pinned: pin.checked } });
      ok(n ? 'Announcement saved.' : 'Posted. Everyone sees it on their dashboard.'); ctx.loadDash(); return true;
    };
    return p;
  }
  async function delNews(id) {
    const n = ctx.dash.news.find(x => x.id === id); if (!n) return;
    if (!(await confirmBox(`Delete “${n.title}”?`, 'It will be removed from everyone’s dashboard.', 'Delete'))) return;
    try { await api('/api/admin/news/' + id, { method: 'DELETE' }); ok('Announcement deleted.'); } catch (e) { bad(e.message); }
    ctx.loadDash();
  }

  // ---------- action dispatcher (buttons with data-act in the hub) ----------
  function act(name, data, btn) {
    switch (name) {
      case 'dept-menu': return deptMenu(data.dept, 0, 0, btn.closest('.folder') || btn);
      case 'dept-add': return folderDialog(null, data.group);
      case 'dept-rename': case 'dept-color': return folderDialog(data.dept);
      case 'dept-del': return deleteFolder(data.dept);
      case 'sec-add': return sectionDialog(data.dept);
      case 'sec-rename': return sectionDialog(null, data.sec);
      case 'sec-up': case 'sec-down': return save(doc => { const f = findSec(doc, data.sec); return move(f.d.sections, f.i, name === 'sec-up' ? -1 : 1); });
      case 'sec-del': {
        const f = findSec(ctx.hub, data.sec), n = f.s.items.length;
        return confirmBox(`Delete ${f.s.title ? '“' + f.s.title + '”' : 'this section'}?`, n ? `The ${n} item${n > 1 ? 's' : ''} in it will be removed from the hub too.` : 'The section is empty.', 'Delete section')
          .then(y => y && save(doc => { const x = findSec(doc, data.sec); x.d.sections.splice(x.i, 1); }, 'Section deleted.'));
      }
      case 'item-add': return itemDialog(data.sec);
      case 'item-edit': return itemDialog(null, data.item);
      case 'item-up': case 'item-down': return save(doc => { const f = findItem(doc, data.item); return move(f.s.items, f.i, name === 'item-up' ? -1 : 1); });
      case 'item-del': return deleteItem(data.item);
      case 'import-docs': return importDocs(btn);
      case 'task-add': return taskDialog();
      case 'task-edit': return taskDialog(data.task);
      case 'task-del': return delTask(data.task);
      case 'news-add': return newsDialog();
      case 'news-edit': return newsDialog(data.news);
      case 'news-del': return delNews(data.news);
    }
  }

  // =====================================================================
  // Form builder
  // =====================================================================
  const TYPES = [
    ['textbox', 'Short answer'], ['textarea', 'Long answer'], ['radio', 'Choose one'], ['checkbox', 'Tick boxes'], ['dropdown', 'Dropdown'],
    ['fullname', 'Name'], ['email', 'Email'], ['phone', 'Phone number'], ['number', 'Number'], ['address', 'Address'],
    ['date', 'Date'], ['datetime', 'Date and time'], ['time', 'Time'], ['rating', 'Star rating'], ['scale', 'Scale'],
    ['file', 'File or photo upload'], ['signature', 'Signature'], ['products', 'Item picker'], ['calculation', 'Total score'],
    ['head', 'Section heading'], ['text', 'Information text'], ['divider', 'Divider line']];
  const TYPE_NAME = Object.fromEntries(TYPES);
  const INPUT = new Set(['textbox', 'textarea', 'email', 'number', 'phone', 'fullname', 'address', 'date', 'datetime', 'time', 'dropdown', 'radio', 'checkbox', 'rating', 'scale', 'file', 'signature', 'calculation', 'products']);
  const CHOICE = new Set(['dropdown', 'radio', 'checkbox']);
  const OPS = [['equals', 'is'], ['notEquals', 'is not'], ['isFilled', 'is answered'], ['isEmpty', 'is not answered'], ['contains', 'contains'], ['lessThan', 'is less than'], ['greaterThan', 'is more than']];
  let B = null;   // the open builder

  const productsToText = ps => (ps || []).map(p => [p.name, p.max, ...(p.opts || []).map(o => `${o.name}: ${o.values.join(', ')}`)].join(' | ')).join('\n');
  const textToProducts = t => t.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [name, max, ...opts] = l.split('|').map(x => x.trim());
    return { name, max: Number(max) || 1, opts: opts.filter(o => o.includes(':')).map(o => { const [n, v] = o.split(':'); return { name: n.trim(), values: v.split(',').map(x => x.trim()).filter(Boolean) }; }) };
  });

  async function builder(id) {
    let def;
    try { def = await ctx.getForm(id, true); } catch { return; }
    if (!def) { ctx.pane.innerHTML = `<div class="pane-inner"><div class="empty">This form could not be found.<br><br><a class="btn" href="#home">Go to Home</a></div></div>`; return; }
    const state = { name: def.name, fields: clone(def.fields), conds: {} };
    // Rules are shown on each question they affect: "show/hide this question when …"
    for (const r of def.rules || []) for (const t of r.targets) (state.conds[t] = state.conds[t] || []).push({ action: r.action, link: r.link, terms: clone(r.terms) });
    B = { id, dirty: false, state };
    const markDirty = () => { B.dirty = true; status.textContent = 'Unsaved changes'; status.className = 'bstatus dirty'; };
    const nameIn = input('bName', state.name, { maxlength: '120' });
    nameIn.addEventListener('input', () => { state.name = nameIn.value; markDirty(); });
    const status = h('span', { class: 'bstatus' }, 'All changes saved');
    const saveBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => doSave() }, 'Save');
    const list = h('div', { class: 'blist' });
    const info = ctx.formDept[id];
    const root = h('div', { class: 'pane-inner builder' },
      h('div', { class: 'crumbs', html: `<a href="#home">Home</a>${icon('chev', 'i16')}${info ? `<a href="#d/${info.dept.id}">${esc(info.dept.name)}</a>${icon('chev', 'i16')}` : ''}<a href="#form/${esc(id)}">${esc(def.name)}</a>${icon('chev', 'i16')}<span>Edit</span>` }),
      h('div', { class: 'bhead' }, h('div', { class: 'q', style: 'margin:0;flex:1;min-width:220px' }, h('label', { for: 'bName' }, 'Form name'), nameIn, h('div', { class: 'hint', style: 'margin-top:4px' }, 'Shown in Submissions and email alerts. The heading people see is the first “Section heading” below.')),
        h('div', { class: 'cmdbar bactions' }, status, saveBtn,
          h('button', { class: 'btn', type: 'button', onclick: () => { if (canLeave()) { B = null; location.hash = '#form/' + id; } } }, 'View form'),
          h('button', { class: 'btn subtle', type: 'button', onclick: () => copyForm() }, 'Make a copy'),
          h('button', { class: 'btn subtle dangertext', type: 'button', onclick: () => delForm() }, 'Delete form'))),
      list,
      h('div', { class: 'addq' }, h('button', { class: 'btn', type: 'button', html: icon('add') + 'Add a question', onclick: e => addMenu(e.currentTarget, state.fields.length) })),
      h('div', { class: 'submitbar' }, saveBtn.cloneNode(true), status.cloneNode(true)));
    const bottomSave = root.querySelector('.submitbar .btn'); bottomSave.onclick = () => doSave();
    const bottomStatus = root.querySelector('.submitbar .bstatus');
    const syncStatus = () => { bottomStatus.textContent = status.textContent; bottomStatus.className = status.className; };
    new MutationObserver(syncStatus).observe(status, { childList: true, attributes: true });
    ctx.pane.innerHTML = ''; ctx.pane.append(root); ctx.pane.scrollTop = 0;
    renderList();

    function nextId() { const nums = state.fields.map(f => Number(f.id)).filter(n => !isNaN(n)); return String((nums.length ? Math.max(...nums) : 0) + 1); }
    function blank(type) {
      const f = { id: nextId(), type, label: type === 'head' ? 'New section' : type === 'divider' ? '' : type === 'text' ? '' : 'New question' };
      if (CHOICE.has(type)) f.options = ['Option 1', 'Option 2'];
      if (type === 'rating') f.max = 5; if (type === 'scale') f.max = 10;
      if (type === 'text') f.html = 'Information for the person filling in the form.';
      if (type === 'products') f.products = [{ name: 'Item 1', max: 1, opts: [] }];
      if (type === 'calculation') f.label = 'Total score';
      return f;
    }
    function addMenu(anchor, at) {
      ctx.closeMenu();
      const m = h('div', { class: 'ctxmenu typemenu', role: 'menu', 'aria-label': 'Question type' },
        ...TYPES.map(([t, l]) => h('button', { class: 'mi', type: 'button', role: 'menuitem', html: `<span>${esc(l)}</span>`, onclick: () => {
          ctx.closeMenu(); const f = blank(t); state.fields.splice(at, 0, f); markDirty(); renderList();
          const card = list.querySelector(`[data-fid="${f.id}"]`); if (card) { card.scrollIntoView({ block: 'center' }); const i = card.querySelector('.blabel'); if (i) { i.focus(); i.select(); } }
        } })));
      const r = anchor.getBoundingClientRect();
      ctx.openAt(m, r.left, r.bottom + 4, anchor);
    }
    const labelOf = f => (f.label || TYPE_NAME[f.type] || f.type).slice(0, 70);
    function renderList() {
      list.innerHTML = '';
      let qn = 0;
      state.fields.forEach((f, i) => list.append(card(f, i, INPUT.has(f.type) ? ++qn : null)));
      if (!state.fields.length) list.append(h('div', { class: 'empty' }, 'No questions yet. Add the first one below.'));
    }
    function card(f, i, qn) {
      const c = h('div', { class: 'bcard' + (INPUT.has(f.type) ? '' : ' layout'), 'data-fid': f.id });
      const typeSel = h('select', { class: 'ctl btype', 'aria-label': 'Question type' }, ...TYPES.map(([t, l]) => h('option', { value: t, selected: t === f.type }, l)));
      typeSel.addEventListener('change', () => {
        const nf = Object.assign(blank(typeSel.value), { id: f.id, label: f.label || '' });
        if (CHOICE.has(nf.type) && CHOICE.has(f.type)) { nf.options = f.options; nf.other = f.other; }
        if (f.required && INPUT.has(nf.type)) nf.required = true;
        state.fields[i] = nf; markDirty(); renderList();
      });
      const tool = (ic, label, fn, dis) => h('button', { class: 'eb icon' + (ic === 'del' ? ' danger' : ''), type: 'button', title: label, 'aria-label': label, disabled: dis || null, html: icon(ic), onclick: fn });
      c.append(h('div', { class: 'bctop' },
        h('span', { class: 'bnum' }, qn ? 'Q' + qn : ''), typeSel,
        h('span', { class: 'etools' },
          tool('up', 'Move up', () => { move(state.fields, i, -1); markDirty(); renderList(); }, i === 0),
          tool('down', 'Move down', () => { move(state.fields, i, 1); markDirty(); renderList(); }, i === state.fields.length - 1),
          tool('copy', 'Duplicate', () => { const nf = Object.assign(clone(f), { id: nextId() }); state.fields.splice(i + 1, 0, nf); if (state.conds[f.id]) state.conds[nf.id] = clone(state.conds[f.id]); markDirty(); renderList(); }),
          tool('add', 'Add a question below', e => addMenu(e.currentTarget, i + 1)),
          tool('del', 'Delete', () => delField(f, i)))));
      const bind = (el, key, tr = v => v) => { el.addEventListener('input', () => { f[key] = tr(el.value); markDirty(); }); return el; };
      if (f.type === 'divider') { c.append(h('hr', { class: 'fdiv', style: 'margin:6px 0 0' })); return c; }
      if (f.type === 'text') {
        const t = h('textarea', { class: 'ctl', rows: 3, 'aria-label': 'Information text' }); t.value = f.html || '';
        c.append(bind(t, 'html')); return c;
      }
      const lab = h('input', { class: 'ctl blabel', 'aria-label': f.type === 'head' ? 'Heading' : 'Question', placeholder: f.type === 'head' ? 'Heading' : 'Question' }); lab.value = f.label || '';
      bind(lab, 'label');
      c.append(lab);
      if (f.type === 'head') {
        const d = h('textarea', { class: 'ctl', rows: 2, placeholder: 'Description (optional)', 'aria-label': 'Description' }); d.value = f.sub || '';
        c.append(bind(d, 'sub')); return c;
      }
      const opts = h('div', { class: 'bopts' });
      if (CHOICE.has(f.type)) {
        const ta = h('textarea', { class: 'ctl', rows: Math.min(8, Math.max(3, (f.options || []).length)), 'aria-label': 'Options, one per line' }); ta.value = (f.options || []).join('\n');
        ta.addEventListener('input', () => { f.options = ta.value.split('\n').map(x => x.trim()).filter(Boolean); markDirty(); });
        opts.append(h('div', { class: 'q dq', style: 'margin-top:8px' }, h('div', { class: 'qlabel' }, 'Options, one per line'), ta));
        if (f.type !== 'dropdown') opts.append(check('Add an “Other” option with a text box', !!f.other, v => { f.other = v; }));
      }
      if (f.type === 'rating' || f.type === 'scale') {
        const s = h('select', { class: 'ctl', style: 'width:auto' }, ...[3, 4, 5, 6, 7, 8, 9, 10].map(n => h('option', { value: n, selected: Number(f.max) === n }, `1 to ${n}`)));
        s.addEventListener('change', () => { f.max = Number(s.value); markDirty(); });
        opts.append(h('div', { class: 'q dq inline' }, h('span', { class: 'qlabel' }, f.type === 'rating' ? 'Stars' : 'Scale'), s));
      }
      if (f.type === 'time') opts.append(check('Ask for a start and end time', !!f.range, v => { f.range = v; }));
      if (f.type === 'products') {
        const ta = h('textarea', { class: 'ctl', rows: Math.min(10, Math.max(3, (f.products || []).length)), spellcheck: 'false' }); ta.value = productsToText(f.products);
        ta.addEventListener('input', () => { f.products = textToProducts(ta.value); markDirty(); });
        opts.append(h('div', { class: 'q dq', style: 'margin-top:8px' }, h('div', { class: 'qlabel' }, 'Items, one per line'), ta,
          h('div', { class: 'hint', style: 'margin-top:4px' }, 'Write: name | most anyone can order | Option: choice, choice. For example: T-Shirt | 5 | Size: S, M, L, XL')));
      }
      if (f.type === 'calculation') {
        const nums = state.fields.filter(x => x.type === 'scale' || x.type === 'rating');
        const box = h('div', { class: 'opts' }, ...(nums.length ? nums.map(x => check(labelOf(x), !f.sum || f.sum.includes(x.id), v => { const cur = new Set(f.sum || nums.map(n => n.id)); v ? cur.add(x.id) : cur.delete(x.id); f.sum = [...cur]; })) : [h('div', { class: 'hint' }, 'Add star rating or scale questions to total them up.')]));
        opts.append(h('div', { class: 'q dq', style: 'margin-top:8px' }, h('div', { class: 'qlabel' }, 'Adds up'), box));
      }
      if (INPUT.has(f.type) && f.type !== 'calculation') opts.append(check('Required', !!f.required, v => { f.required = v; }));
      c.append(opts);
      if (INPUT.has(f.type) || f.type === 'head' || f.type === 'text') c.append(logic(f));
      return c;
    }
    function check(label, on, fn) {
      const i = h('input', { type: 'checkbox', checked: on }); i.addEventListener('change', () => { fn(i.checked); markDirty(); });
      return h('label', { class: 'opt bcheck' }, i, h('span', {}, label));
    }
    function logic(f) {
      const conds = state.conds[f.id] || [];
      const det = h('details', { class: 'blogic' + (conds.length ? ' has' : ''), open: conds.length ? true : null });
      det.append(h('summary', {}, conds.length ? `Show or hide rules (${conds.length})` : 'Show or hide this question based on other answers'));
      const others = state.fields.filter(x => x.id !== f.id && INPUT.has(x.type) && !['file', 'signature', 'calculation', 'products'].includes(x.type));
      const draw = () => {
        det.querySelectorAll('.cond, .addcond, .lhint').forEach(e => e.remove());
        (state.conds[f.id] || []).forEach((cd, ci) => det.append(condRow(f, cd, ci, others, draw)));
        det.append(h('p', { class: 'hint lhint' }, 'With a “Show” rule the question stays hidden until the rule matches. With a “Hide” rule it shows until the rule matches.'));
        det.append(h('button', { class: 'btn subtle addcond', type: 'button', html: icon('add') + 'Add a rule', disabled: others.length ? null : true, onclick: () => {
          (state.conds[f.id] = state.conds[f.id] || []).push({ action: 'show', link: 'any', terms: [{ field: others[0].id, op: 'equals', value: (others[0].options || [''])[0] || '' }] });
          markDirty(); draw(); det.open = true; det.classList.add('has');
        } }));
      };
      draw();
      return det;
    }
    function condRow(f, cd, ci, others, redraw) {
      const row = h('div', { class: 'cond' });
      const act = h('select', { class: 'ctl', 'aria-label': 'Show or hide' }, h('option', { value: 'show', selected: cd.action === 'show' }, 'Show'), h('option', { value: 'hide', selected: cd.action === 'hide' }, 'Hide'));
      act.onchange = () => { cd.action = act.value; markDirty(); };
      const link = h('select', { class: 'ctl', 'aria-label': 'Any or all' }, h('option', { value: 'any', selected: cd.link !== 'all' }, 'any'), h('option', { value: 'all', selected: cd.link === 'all' }, 'all'));
      link.onchange = () => { cd.link = link.value; markDirty(); };
      row.append(h('div', { class: 'condhead' }, act, h('span', {}, 'this question when'), cd.terms.length > 1 ? link : null, cd.terms.length > 1 ? h('span', {}, 'of these match:') : null,
        h('button', { class: 'eb icon danger', type: 'button', title: 'Remove rule', 'aria-label': 'Remove rule', html: icon('del'), onclick: () => { state.conds[f.id].splice(ci, 1); if (!state.conds[f.id].length) delete state.conds[f.id]; markDirty(); redraw(); } })));
      cd.terms.forEach((t, ti) => {
        const src = () => state.fields.find(x => x.id === t.field);
        const fsel = h('select', { class: 'ctl', 'aria-label': 'Question' }, ...others.map(x => h('option', { value: x.id, selected: x.id === t.field }, labelOf(x))));
        if (!others.some(x => x.id === t.field)) fsel.prepend(h('option', { value: t.field, selected: true }, '(deleted question)'));
        const osel = h('select', { class: 'ctl', 'aria-label': 'Condition' }, ...OPS.map(([v, l]) => h('option', { value: v, selected: v === t.op }, l)));
        const valWrap = h('span', { class: 'valwrap' });
        const drawVal = () => {
          valWrap.innerHTML = '';
          if (t.op === 'isEmpty' || t.op === 'isFilled') return;
          const s = src();
          const choices = s && (s.options || (s.type === 'rating' || s.type === 'scale' ? Array.from({ length: s.max || 5 }, (_, k) => String(k + 1)) : null));
          if (choices && (t.op === 'equals' || t.op === 'notEquals')) {
            const vs = h('select', { class: 'ctl', 'aria-label': 'Answer' }, ...choices.map(o => h('option', { value: o, selected: o === t.value }, o)));
            if (!choices.includes(t.value)) { if (t.value) vs.prepend(h('option', { value: t.value, selected: true }, t.value)); else t.value = choices[0]; }
            vs.onchange = () => { t.value = vs.value; markDirty(); }; valWrap.append(vs);
          } else { const vi = h('input', { class: 'ctl', 'aria-label': 'Answer', value: t.value || '' }); vi.oninput = () => { t.value = vi.value; markDirty(); }; valWrap.append(vi); }
        };
        fsel.onchange = () => { t.field = fsel.value; const s = src(); t.value = s && s.options ? s.options[0] : ''; markDirty(); drawVal(); };
        osel.onchange = () => { t.op = osel.value; markDirty(); drawVal(); };
        drawVal();
        row.append(h('div', { class: 'term' }, fsel, osel, valWrap,
          cd.terms.length > 1 ? h('button', { class: 'eb icon', type: 'button', title: 'Remove', 'aria-label': 'Remove condition', html: icon('x'), onclick: () => { cd.terms.splice(ti, 1); markDirty(); redraw(); } }) : null));
      });
      row.append(h('button', { class: 'btn subtle small', type: 'button', html: icon('add') + 'And another answer', onclick: () => { cd.terms.push({ field: others[0].id, op: 'equals', value: (others[0].options || [''])[0] || '' }); markDirty(); redraw(); } }));
      return row;
    }
    async function delField(f, i) {
      const usedBy = Object.entries(state.conds).filter(([tid, cs]) => tid !== f.id && cs.some(c => c.terms.some(t => t.field === f.id))).map(([tid]) => state.fields.find(x => x.id === tid)).filter(Boolean);
      const yes = await confirmBox(`Delete “${labelOf(f)}”?`, usedBy.length ? `Rules on ${usedBy.length} other question${usedBy.length > 1 ? 's' : ''} use this answer; those conditions will be removed too. Past submissions keep their answers.` : 'Past submissions keep their answers.', 'Delete question');
      if (!yes) return;
      state.fields.splice(i, 1); delete state.conds[f.id];
      for (const [tid, cs] of Object.entries(state.conds)) {
        cs.forEach(c => { c.terms = c.terms.filter(t => t.field !== f.id); });
        state.conds[tid] = cs.filter(c => c.terms.length); if (!state.conds[tid].length) delete state.conds[tid];
      }
      state.fields.forEach(x => { if (x.sum) x.sum = x.sum.filter(id => id !== f.id); });
      markDirty(); renderList();
    }
    async function doSave() {
      const problems = [];
      state.fields.forEach((f, i) => {
        if (INPUT.has(f.type) && !String(f.label || '').trim()) problems.push(`Question ${i + 1} has no wording.`);
        if (CHOICE.has(f.type) && !(f.options || []).length) problems.push(`“${labelOf(f)}” needs at least one option.`);
      });
      if (!state.name.trim()) problems.push('Give the form a name.');
      if (problems.length) return bad(problems[0]);
      const rules = [];
      for (const [tid, cs] of Object.entries(state.conds)) for (const c of cs) if (c.terms.length) rules.push({ link: c.link, action: c.action, terms: c.terms, targets: [tid] });
      saveBtn.disabled = bottomSave.disabled = true; status.textContent = 'Saving…';
      try {
        const out = await api('/api/admin/forms/' + encodeURIComponent(id), { method: 'PUT', json: { name: state.name.trim(), fields: state.fields, rules } });
        ctx.FORMS[id] = out; B.dirty = false; status.textContent = 'All changes saved'; status.className = 'bstatus';
        ctx.loadFormList(); ok('Form saved. People see the new version straight away.');
      } catch (e) { status.textContent = 'Not saved'; status.className = 'bstatus dirty'; bad(e.message); }
      saveBtn.disabled = bottomSave.disabled = false;
    }
    async function copyForm() {
      if (!canLeave()) return;
      try {
        const out = await api('/api/admin/forms', { method: 'POST', json: { copyOf: id, name: state.name + ' (copy)' } });
        ctx.FORMS[out.id] = out; await ctx.loadFormList();
        B = null; ok(`Made “${out.name}”. Add it to a folder with Edit → Add.`); location.hash = '#edit-form/' + out.id;
      } catch (e) { bad(e.message); }
    }
    async function delForm() {
      const uses = ctx.items.filter(x => x.formId === id).length;
      const yes = await confirmBox(`Delete the form “${state.name}”?`, `People won’t be able to fill it in any more${uses ? `, and it’s removed from ${uses} place${uses > 1 ? 's' : ''} in the hub` : ''}. Past submissions stay in Submissions.`, 'Delete form');
      if (!yes) return;
      try {
        const out = await api('/api/admin/forms/' + encodeURIComponent(id), { method: 'DELETE' });
        delete ctx.FORMS[id]; B = null; ctx.setHub(out.hub); ctx.loadFormList(); ok('Form deleted.');
        location.hash = info ? '#d/' + info.dept.id : '#home';
      } catch (e) { bad(e.message); }
    }
  }
  function canLeave() {
    if (!B || !B.dirty) { B = null; return true; }
    if (window.confirm('You have unsaved changes to this form. Leave without saving?')) { B = null; return true; }
    return false;
  }
  window.addEventListener('beforeunload', e => { if (B && B.dirty) { e.preventDefault(); e.returnValue = ''; } });

  return { act, deptMenu, builder, canLeave };
};
