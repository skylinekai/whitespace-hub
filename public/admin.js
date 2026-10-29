/* Submissions dashboard (Outlook-style inbox). */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');
  const P = {
    inbox: 'M5.4 3h9.2c.9 0 1.6.6 1.9 1.4l1.4 5.3v4.8c0 1.4-1.1 2.5-2.5 2.5h-11A2.5 2.5 0 0 1 2 14.5V9.7l1.4-5.3C3.7 3.6 4.5 3 5.4 3Zm0 1a1 1 0 0 0-1 .7L3.2 9H7c.3 0 .5.2.5.5a2.5 2.5 0 0 0 5 0c0-.3.2-.5.5-.5h3.8l-1.2-4.3a1 1 0 0 0-1-.7H5.4ZM3 10v4.5c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5V10h-3.5a3.5 3.5 0 0 1-7 0H3Z',
    form: 'M6 2a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7.4c0-.4-.2-.8-.4-1.1l-3.9-3.9c-.3-.2-.7-.4-1.1-.4H6ZM5 4c0-.6.4-1 1-1h4v3.5c0 .8.7 1.5 1.5 1.5H15v8c0 .6-.4 1-1 1H6a1 1 0 0 1-1-1V4Zm9.8 3h-3.3a.5.5 0 0 1-.5-.5V3.2L14.8 7Z',
    chev: 'M7.6 4.1a.5.5 0 0 1 .7 0l5.5 5.5c.2.2.2.6 0 .8l-5.5 5.5a.5.5 0 0 1-.7-.7l5.1-5.2-5.1-5.2a.5.5 0 0 1 0-.7Z',
    check: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm3.4 4.1a.5.5 0 0 1 .1.7l-4.4 4.9a.5.5 0 0 1-.8 0l-2.2-2.1a.5.5 0 0 1 .8-.7l1.8 1.8 4-4.5a.5.5 0 0 1 .7-.1Z',
    mailUnread: 'M16 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM4.5 4H13a3 3 0 0 0 .1 1H4.5C3.7 5 3 5.7 3 6.5v.3l7 4.1 4.7-2.8.9.4.2.1V14.5c0 1.4-1.1 2.5-2.5 2.5h-9A2.5 2.5 0 0 1 2 14.5v-8C2 5.1 3.1 4 4.5 4ZM16 8.9V14.5c0 .8-.7 1.5-1.5 1.5h-9c-.8 0-1.5-.7-1.5-1.5V7.9l6.7 4c.2.1.4.1.6 0L16 8.9Z',
    del: 'M8.5 4h3a1.5 1.5 0 0 0-3 0Zm-1 0a2.5 2.5 0 0 1 5 0h4a.5.5 0 0 1 0 1h-.6l-1.2 10.4A2.5 2.5 0 0 1 12.2 18H7.8a2.5 2.5 0 0 1-2.5-2.2L4.1 5h-.6a.5.5 0 0 1 0-1h4Zm-2.2 11.7c.1.8.7 1.3 1.5 1.3h4.4c.8 0 1.4-.5 1.5-1.3L14.9 5H5.1l1.2 10.7ZM8.5 7.5c.3 0 .5.2.5.5v6a.5.5 0 0 1-1 0V8c0-.3.2-.5.5-.5ZM12 8a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V8Z',
    csv: 'M6 2a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7.4c0-.4-.2-.8-.4-1.1l-3.9-3.9c-.3-.2-.7-.4-1.1-.4H6ZM5 4c0-.6.4-1 1-1h4v3.5c0 .8.7 1.5 1.5 1.5H15v8c0 .6-.4 1-1 1H6a1 1 0 0 1-1-1V4Zm5.5 6a.5.5 0 0 0-1 0v3.8l-1.1-1.2a.5.5 0 1 0-.8.7l2 2c.2.2.6.2.8 0l2-2a.5.5 0 0 0-.8-.7l-1.1 1.2V10Z',
    print: 'M5 4.5C5 3.1 6.1 2 7.5 2h5C13.9 2 15 3.1 15 4.5V5h.5C16.9 5 18 6.1 18 7.5v6c0 .8-.7 1.5-1.5 1.5H15v1.5c0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5V15H3.5c-.8 0-1.5-.7-1.5-1.5v-6C2 6.1 3.1 5 4.5 5H5v-.5ZM6 5h8v-.5c0-.8-.7-1.5-1.5-1.5h-5C6.7 3 6 3.7 6 4.5V5Zm-1 9v-1.5c0-.8.7-1.5 1.5-1.5h7c.8 0 1.5.7 1.5 1.5V14h1.5c.3 0 .5-.2.5-.5v-6c0-.8-.7-1.5-1.5-1.5h-11C3.7 6 3 6.7 3 7.5v6c0 .3.2.5.5.5H5Zm1.5-2a.5.5 0 0 0-.5.5v4c0 .3.2.5.5.5h7c.3 0 .5-.2.5-.5v-4a.5.5 0 0 0-.5-.5h-7Z',
    back: 'M9.2 16.4a.5.5 0 0 0 .7-.7L4.7 10.5H16.5a.5.5 0 0 0 0-1H4.7l5.2-5.2a.5.5 0 0 0-.7-.7L3.1 9.6a.5.5 0 0 0 0 .8l6.1 6Z',
    err: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 10.5a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6ZM10 6a.5.5 0 0 0-.5.4v4.6a.5.5 0 0 0 1 0V6.5A.5.5 0 0 0 10 6Z',
    attach: 'M4.8 10.9 10.6 5a3 3 0 0 1 4.2 4.3l-6.4 6.3a1.7 1.7 0 0 1-2.4-2.4l5.3-5.3a.5.5 0 0 0-.7-.7l-5.3 5.3a2.7 2.7 0 0 0 3.8 3.8l6.4-6.3A4 4 0 1 0 9.9 4.3l-5.8 5.9a.5.5 0 0 0 .7.7Z',
    people: 'M7.5 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-2 3a2 2 0 1 1 4 0 2 2 0 0 1-4 0ZM14 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-1 2a1 1 0 1 1 2 0 1 1 0 0 1-2 0ZM3.5 10C2.7 10 2 10.7 2 11.5v.3c0 1.6 1.9 3.2 5.5 3.2s5.5-1.6 5.5-3.2v-.3c0-.8-.7-1.5-1.5-1.5h-8ZM3 11.5c0-.3.2-.5.5-.5h8c.3 0 .5.2.5.5v.3c0 .9-1.3 2.2-4.5 2.2S3 12.7 3 11.8v-.3Zm11 2.5c-.6 0-1.2-.1-1.7-.2.2-.3.4-.6.5-1h1.2c2.2 0 3-1 3-1.6v-.2c0-.3-.2-.5-.5-.5h-2.6c-.1-.4-.3-.7-.6-1H16.5c.8 0 1.5.7 1.5 1.5v.2C18 12.6 16.6 14 14 14Z',
    add: 'M10 3a.5.5 0 0 1 .5.5v6h6a.5.5 0 0 1 0 1h-6v6a.5.5 0 0 1-1 0v-6h-6a.5.5 0 0 1 0-1h6v-6c0-.3.2-.5.5-.5Z',
    key: 'M12.5 2a5.5 5.5 0 0 1 0 11c-.5 0-.9 0-1.4-.2L9.9 14H8.5v1.5c0 .3-.2.5-.5.5H6.5v1.5c0 .3-.2.5-.5.5H2.5a.5.5 0 0 1-.5-.5v-2.3c0-.4.2-.8.4-1.1l4.8-4.8A5.5 5.5 0 0 1 12.5 2Zm0 1a4.5 4.5 0 0 0-4.3 5.9l.1.3-.2.2-5 5-.1.4V17h3v-1.5c0-.3.2-.5.5-.5h1.5v-1.5c0-.3.2-.5.5-.5h1.8l1.3-1.3.3.1A4.5 4.5 0 1 0 12.5 3ZM14 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z',
    copy: 'M8 2a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8ZM7 4c0-.6.4-1 1-1h6c.6 0 1 .4 1 1v10c0 .6-.4 1-1 1H8a1 1 0 0 1-1-1V4ZM4 6a2 2 0 0 1 1-1.7V14.5C5 16 6.3 17 7.5 17h6.2c-.4.6-1 1-1.7 1H7.5A3.5 3.5 0 0 1 4 14.5V6Z',
    warn: 'M8.7 2.8a1.5 1.5 0 0 1 2.6 0l6.5 11.9a1.5 1.5 0 0 1-1.3 2.3H3.5a1.5 1.5 0 0 1-1.3-2.3L8.7 2.8ZM10 13a.8.8 0 1 0 0 1.5.8.8 0 0 0 0-1.5Zm0-6.5a.5.5 0 0 0-.5.4v4.6a.5.5 0 0 0 1 0V7a.5.5 0 0 0-.5-.5Z'
  };
  const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 20 20" aria-hidden="true"><path d="${P[n]}"/></svg>`;
  async function api(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts));
    if (r.status === 401) { showLogin(); throw new Error('signed out'); }
    if (r.status === 403) { location.replace('/?notice=admin-only'); throw new Error('not admin'); }
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || 'Something went wrong.');
    return out;
  }

  // form names and departments, from the hub content
  const FORM_NAMES = {}, GROUPS = [];
  window.HUB.forEach(d => {
    const list = [];
    d.g.forEach(([, items]) => items.forEach(it => { if (it[0] === 'f' && !FORM_NAMES[it[2]]) { FORM_NAMES[it[2]] = it[1]; list.push(it[2]); } }));
    if (list.length) GROUPS.push({ id: d.id, name: d.name, color: d.c, forms: list });
  });

  let me = null, summary = {}, state = { form: '', status: 'all', q: '', rows: [], total: 0, sel: null };

  // ---------- login ----------
  function showLogin() { location.replace('/login?next=' + encodeURIComponent('/admin') + location.hash); }
  $('#logout').addEventListener('click', () => { location.href = '/logout'; });

  // ---------- layout ----------
  function shell() {
    $('#searchWrap').hidden = false; $('#logout').hidden = false;
    app.innerHTML = `
      ${me.storage !== 'postgres' ? `<div class="bar-msg warn banner">${icon('warn')}<div>Submissions are being saved to the server's own disk. On Render this is wiped whenever the app redeploys. Connect a Render Postgres database (DATABASE_URL) to keep them safely.</div></div>` : ''}
      ${!me.email ? `<div class="bar-msg warn banner" style="margin-top:6px">${icon('warn')}<div>Email alerts are off. Add the SMTP settings in Render to get an email for each new submission.</div></div>` : ''}
      <div class="mail" id="mail">
        <nav class="folders" id="folders" aria-label="Forms"></nav>
        <section class="listpane" aria-label="Submissions list"><div class="lhead" id="lhead"></div><div class="lbody" id="lbody"></div></section>
        <section class="readpane" aria-label="Reading pane"><div class="rbody" id="rbody"></div></section>
        <section class="userspane" id="userspane" aria-label="Users" hidden></section>
      </div>`;
    const top = $('.mail');
    const extra = [...app.querySelectorAll('.banner')].reduce((n, b) => n + b.offsetHeight + 8, 0);
    if (extra) top.style.height = `calc(100% - 48px - ${extra}px)`;
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.hidden = true; document.body.append(scrim);
    const toggle = open => { $('#folders').classList.toggle('open', open); scrim.hidden = !open; };
    scrim.onclick = () => toggle(false);
    $('#menuBtn').onclick = () => toggle(!$('#folders').classList.contains('open'));
    $('#folders').addEventListener('click', e => { if (e.target.closest('.folder')) toggle(false); });
  }

  function renderFolders() {
    const tot = Object.values(summary).reduce((a, s) => ({ total: a.total + s.total, unread: a.unread + s.unread }), { total: 0, unread: 0 });
    const f = (id, label, n, unread, colorOrIcon) => `<a class="folder${n ? '' : ' empty-f'}" href="#f-${id || 'all'}"${state.view !== 'users' && state.form === id ? ' aria-current="page"' : ''}>${colorOrIcon}<span class="lbl">${esc(label)}</span>${unread ? `<span class="n unread">${unread}</span>` : n ? `<span class="n">${n}</span>` : ''}</a>`;
    $('#folders').innerHTML = f('', 'All submissions', tot.total, tot.unread, icon('inbox', 'i ic')) +
      `<a class="folder" href="#users"${state.view === 'users' ? ' aria-current="page"' : ''}>${icon('people', 'i ic')}<span class="lbl">Users</span></a>` +
      GROUPS.map(g => {
        const has = g.forms.some(id => summary[id]);
        const unread = g.forms.reduce((n, id) => n + (summary[id] ? summary[id].unread : 0), 0);
        return `<details class="fgroup"${has || g.forms.includes(state.form) ? ' open' : ''}><summary>${icon('chev', 'i16')}<span style="flex:1">${esc(g.name)}</span>${unread ? `<span class="n unread" style="color:var(--brand-fg)">${unread}</span>` : ''}</summary>
          ${g.forms.map(id => f(id, FORM_NAMES[id], summary[id] ? summary[id].total : 0, summary[id] ? summary[id].unread : 0, `<span class="cat" style="background:${g.color}"></span>`)).join('')}</details>`;
      }).join('');
  }

  const fmtWhen = iso => {
    const d = new Date(iso), now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const diff = (now - d) / 864e5;
    if (diff < 6) return d.toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };

  function renderListHead() {
    const name = state.form ? FORM_NAMES[state.form] || 'Form' : 'All submissions';
    const tab = (k, l) => `<button class="tab" role="tab" type="button" data-status="${k}" aria-selected="${state.status === k}">${l}</button>`;
    $('#lhead').innerHTML = `<h1>${esc(name)}</h1><div class="meta">${state.total} ${state.total === 1 ? 'submission' : 'submissions'}${state.q ? ` matching “${esc(state.q)}”` : ''}</div>
      <div class="tabs" role="tablist">${tab('all', 'All')}${tab('new', 'Unread')}${tab('done', 'Done')}
      ${state.form ? `<a class="cmd" style="margin-left:auto" href="/api/admin/export/${state.form}" title="Download every submission for this form as a spreadsheet">${icon('csv')}CSV</a>` : ''}</div>`;
  }
  function renderList() {
    renderListHead();
    const lb = $('#lbody');
    if (!state.rows.length) { lb.innerHTML = `<div class="blank-state"><div>${icon('inbox')}${state.q ? 'No submissions match your search.' : state.status === 'new' ? 'Nothing unread. You’re up to date.' : 'No submissions here yet.'}</div></div>`; return; }
    lb.innerHTML = state.rows.map(r => `<button class="msg${r.status === 'new' ? ' unread' : ''}" type="button" data-id="${r.id}"${state.sel === r.id ? ' aria-current="true"' : ''}>
      <span class="from">${esc(state.form ? (r.summary.split(' · ')[0] || r.ref) : r.formName)}</span><span class="when">${fmtWhen(r.createdAt)}</span>
      <span class="subj">${esc(state.form ? r.ref : (r.summary.split(' · ')[0] || r.ref))}</span>
      <span class="prev">${r.status === 'done' ? '<span class="pill done">Done</span>' : ''}${r.files ? `<span class="pill att" title="${r.files} attachment${r.files > 1 ? 's' : ''}">${icon('attach', 'i16')}<span>${r.files}</span></span>` : ''}<span style="overflow:hidden;text-overflow:ellipsis">${esc(r.summary.split(' · ').slice(1).join(' · ') || r.ref)}</span></span>
    </button>`).join('') + (state.rows.length < state.total ? `<button class="btn more" type="button" id="more">Load more</button>` : '');
  }

  async function loadSummary() { summary = Object.fromEntries((await api('/api/admin/summary')).map(s => [s.formId, s])); renderFolders(); }
  async function loadList(append) {
    const p = new URLSearchParams({ form: state.form, status: state.status, q: state.q, offset: append ? state.rows.length : 0, limit: 50 });
    const out = await api('/api/admin/submissions?' + p);
    state.rows = append ? state.rows.concat(out.rows) : out.rows; state.total = out.total;
    renderList();
  }

  // ---------- reading pane ----------
  function blankReader() { $('#rbody').innerHTML = `<div class="blank-state"><div>${icon('form')}Select a submission to read it.</div></div>`; $('#mail').classList.remove('reading'); }
  async function openSub(id) {
    state.sel = id;
    document.querySelectorAll('.msg').forEach(m => m.setAttribute('aria-current', String(Number(m.dataset.id) === id)));
    $('#mail').classList.add('reading');
    const rb = $('#rbody');
    rb.innerHTML = `<div class="blank-state"><div><span class="spinner" style="display:inline-block"></span></div></div>`;
    let s;
    try { s = await api('/api/admin/submissions/' + id); } catch (e) { rb.innerHTML = `<div class="blank-state"><div>${esc(e.message)}</div></div>`; return; }
    const row = state.rows.find(r => r.id === id);
    if (row && row.status === 'new') { row.status = 'read'; const el = $(`.msg[data-id="${id}"]`); if (el) el.classList.remove('unread'); if (summary[s.formId]) { summary[s.formId].unread = Math.max(0, summary[s.formId].unread - 1); renderFolders(); } }
    const imgs = s.files.filter(f => /^image\//.test(f.mime));
    rb.innerHTML = `
      <div class="rcmd cmdbar">
        <button class="cmd backlink" type="button" id="backBtn">${icon('back')}Back</button>
        <button class="cmd" type="button" id="doneBtn">${icon('check')}${s.status === 'done' ? 'Mark as not done' : 'Mark as done'}</button>
        <button class="cmd" type="button" id="unreadBtn">${icon('mailUnread')}Mark as unread</button>
        <a class="cmd" href="/api/admin/export/${s.formId}">${icon('csv')}Download CSV</a>
        <button class="cmd" type="button" onclick="window.print()">${icon('print')}Print</button>
        <button class="cmd" type="button" id="delBtn" style="color:var(--danger)">${icon('del')}Delete</button>
      </div>
      <div id="confirmSlot"></div>
      <div class="rhead"><h2>${esc(s.formName)}</h2><div class="meta"><span class="ref">${esc(s.ref)}</span><span>${new Date(s.createdAt).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</span>${s.status === 'done' ? '<span class="pill done">Done</span>' : ''}</div></div>
      <dl class="answers">${s.answers.map(a => `<div class="ans${a.value ? '' : ' blank'}"><dt>${esc(a.label)}</dt><dd>${a.value ? esc(a.value) : 'No answer'}</dd></div>`).join('')}</dl>
      ${s.files.length ? `<div class="atts"><h3>Attachments (${s.files.length})</h3><div class="attgrid">${s.files.map(f => {
        const isImg = /^image\//.test(f.mime), sig = f.filename.startsWith('signature-');
        return `<a class="att${sig ? ' sig' : ''}" href="/api/admin/files/${f.id}" target="_blank" rel="noopener"><span class="th">${isImg ? `<img src="/api/admin/files/${f.id}" alt="${esc(f.filename)}" loading="lazy">` : icon('form')}</span><span class="nm">${esc(sig ? f.fieldLabel : f.filename)}<small>${sig ? 'Signature' : (f.size / 1048576).toFixed(1) + ' MB · ' + esc(f.fieldLabel)}</small></span></a>`;
      }).join('')}</div></div>` : ''}`;
    rb.scrollTop = 0;
    $('#backBtn').onclick = () => { state.sel = null; blankReader(); history.replaceState(null, '', '#f-' + (state.form || 'all')); };
    $('#doneBtn').onclick = async () => { const st = s.status === 'done' ? 'read' : 'done'; await api('/api/admin/submissions/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: st }) }); if (row) row.status = st; renderList(); openSub(id); };
    $('#unreadBtn').onclick = async () => { await api('/api/admin/submissions/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'new' }) }); if (row) row.status = 'new'; await loadSummary(); renderList(); state.sel = null; blankReader(); };
    $('#delBtn').onclick = () => {
      $('#confirmSlot').innerHTML = `<div class="confirm"><span style="flex:1">Delete ${esc(s.ref)} and its attachments for good? This can’t be undone.</span><button class="btn" type="button" id="cNo">Keep it</button><button class="btn primary" style="background:var(--danger)" type="button" id="cYes">Delete</button></div>`;
      $('#cNo').onclick = () => { $('#confirmSlot').innerHTML = ''; };
      $('#cYes').onclick = async () => { await api('/api/admin/submissions/' + id, { method: 'DELETE' }); state.rows = state.rows.filter(r => r.id !== id); state.total--; state.sel = null; await loadSummary(); renderList(); blankReader(); };
    };
  }


  // ---------- users ----------
  const initials = n => String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const tempPw = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const b = new Uint32Array(10); crypto.getRandomValues(b); return 'Ws-' + [...b].map(x => a[x % a.length]).join(''); };
  const when = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); btn.innerHTML = icon('check') + 'Copied'; setTimeout(() => { btn.innerHTML = icon('copy') + 'Copy'; }, 1800); }
    catch { const r = document.createRange(); r.selectNodeContents(btn.previousElementSibling); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  }
  function credsNote(user, pw, verb) {
    return `<div class="bar-msg ok creds">${icon('check')}<div style="flex:1">${verb} for <b>${esc(user.name)}</b>. Send them these details, then they can change the password from their account menu.
      <div class="credline"><span>Email</span><code>${esc(user.email)}</code></div>
      <div class="credline"><span>Password</span><code class="pwv">${esc(pw)}</code><button class="btn subtle cp" type="button">${icon('copy')}Copy</button></div>
      <div class="credline"><span>Sign in at</span><code>${esc(location.origin)}/login</code></div></div></div>`;
  }
  async function renderUsers(note) {
    const pane = $('#userspane');
    let list;
    try { list = await api('/api/admin/users'); } catch (e) { pane.innerHTML = `<div class="blank-state"><div>${esc(e.message)}</div></div>`; return; }
    const meId = me.user.id;
    const admins = list.filter(u => u.role === 'admin').length;
    pane.innerHTML = `
      <div class="uhead"><div><h1>Users</h1><div class="meta">${list.length} ${list.length === 1 ? 'person' : 'people'} · Admins can see submissions, manage users and rename folders. Viewers can use the hub, forms and documents, and see the carbon platform read-only.</div></div>
        <button class="btn primary" type="button" id="addBtn">${icon('add')}Add user</button></div>
      <div id="unote">${note || ''}</div>
      <form class="addform" id="addForm" hidden novalidate>
        <h2>Add a user</h2>
        <div class="agrid">
          <div class="q"><label for="nuName">Name</label><input class="ctl" id="nuName" autocomplete="off" placeholder="e.g. Jo Bloggs"></div>
          <div class="q"><label for="nuEmail">Email</label><input class="ctl" id="nuEmail" type="email" autocomplete="off" placeholder="name@skylinewhitespace.com"></div>
          <fieldset class="q"><legend>Permission</legend><div class="seg"><label><input type="radio" name="nuRole" value="viewer" checked><span>Viewer</span></label><label><input type="radio" name="nuRole" value="admin"><span>Admin</span></label></div></fieldset>
          <div class="q"><label for="nuPw">Temporary password</label><div class="pwrow"><input class="ctl" id="nuPw" autocomplete="off" spellcheck="false"><button class="btn subtle" type="button" id="nuGen" title="Make a new password">New</button></div></div>
        </div>
        <div id="aerr" role="alert"></div>
        <div class="cmdbar" style="gap:8px;margin-top:14px"><button class="btn primary" type="submit">Create account</button><button class="btn" type="button" id="addCancel">Cancel</button></div>
      </form>
      <div class="utable" role="table" aria-label="Users">
        <div class="urow uhd" role="row"><span role="columnheader">Name</span><span role="columnheader">Permission</span><span role="columnheader">Last signed in</span><span role="columnheader"><span class="sr">Actions</span></span></div>
        ${list.map(u => `<div class="urow" role="row" data-id="${u.id}">
          <span class="uname" role="cell"><span class="ava">${esc(initials(u.name))}</span><span><b>${esc(u.name)}${u.id === meId ? ' <em>(you)</em>' : ''}</b><small>${esc(u.email)}</small></span></span>
          <span role="cell"><select class="ctl role" aria-label="Permission for ${esc(u.name)}"${u.role === 'admin' && admins === 1 ? ' title="There must be at least one admin"' : ''}><option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option><option value="viewer"${u.role === 'viewer' ? ' selected' : ''}>Viewer</option></select></span>
          <span role="cell" class="last">${when(u.lastLogin)}</span>
          <span role="cell" class="uact"><button class="cmd reset" type="button">${icon('key')}Reset password</button>${u.id === meId ? '' : `<button class="cmd remove" type="button" style="color:var(--danger)">${icon('del')}Remove</button>`}</span>
          <div class="uslot"></div>
        </div>`).join('')}
      </div>`;
    const form = $('#addForm');
    $('#addBtn').onclick = () => { form.hidden = false; $('#nuPw').value = tempPw(); $('#nuName').focus(); };
    $('#addCancel').onclick = () => { form.hidden = true; $('#aerr').innerHTML = ''; };
    $('#nuGen').onclick = () => { $('#nuPw').value = tempPw(); };
    form.onsubmit = async e => {
      e.preventDefault();
      const body = { name: $('#nuName').value, email: $('#nuEmail').value, role: form.querySelector('[name=nuRole]:checked').value, password: $('#nuPw').value };
      try {
        const u = await api('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        renderUsers(credsNote(u, body.password, 'Account created'));
      } catch (x) { $('#aerr').innerHTML = `<div class="bar-msg error">${icon('err')}<div>${esc(x.message)}</div></div>`; }
    };
    pane.querySelectorAll('.urow[data-id]').forEach(row => {
      const id = Number(row.dataset.id), u = list.find(x => x.id === id), slot = row.querySelector('.uslot');
      const fail = m => { slot.innerHTML = `<div class="bar-msg error">${icon('err')}<div>${esc(m)}</div></div>`; };
      row.querySelector('.role').onchange = async e => {
        try { await api('/api/admin/users/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: e.target.value }) });
          if (id === meId && e.target.value !== 'admin') { location.replace('/?notice=admin-only'); return; }
          renderUsers(`<div class="bar-msg ok">${icon('check')}<div>${esc(u.name)} is now ${e.target.value === 'admin' ? 'an Admin' : 'a Viewer'}.</div></div>`);
        } catch (x) { e.target.value = u.role; fail(x.message); }
      };
      row.querySelector('.reset').onclick = () => {
        const pw = tempPw();
        slot.innerHTML = `<div class="confirm" style="background:var(--pane-2)"><span style="flex:1">Give ${esc(u.name)} a new temporary password? They’ll be signed out everywhere.</span><button class="btn" type="button" data-no>Cancel</button><button class="btn primary" type="button" data-yes>Reset password</button></div>`;
        slot.querySelector('[data-no]').onclick = () => { slot.innerHTML = ''; };
        slot.querySelector('[data-yes]').onclick = async () => {
          try { await api('/api/admin/users/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
            if (id === meId) { location.replace('/login'); return; }
            renderUsers(credsNote(u, pw, 'Password reset'));
          } catch (x) { fail(x.message); }
        };
      };
      const rm = row.querySelector('.remove');
      if (rm) rm.onclick = () => {
        slot.innerHTML = `<div class="confirm"><span style="flex:1">Remove ${esc(u.name)}? They won’t be able to sign in any more. Their form submissions are kept.</span><button class="btn" type="button" data-no>Keep</button><button class="btn primary" style="background:var(--danger)" type="button" data-yes>Remove</button></div>`;
        slot.querySelector('[data-no]').onclick = () => { slot.innerHTML = ''; };
        slot.querySelector('[data-yes]').onclick = async () => {
          try { await api('/api/admin/users/' + id, { method: 'DELETE' }); renderUsers(`<div class="bar-msg ok">${icon('check')}<div>${esc(u.name)} has been removed.</div></div>`); }
          catch (x) { fail(x.message); }
        };
      };
    });
    pane.querySelectorAll('.creds .cp').forEach(b => { b.onclick = () => copy(b.previousElementSibling.textContent, b); });
  }
  // ---------- events & routing ----------
  function onHash() {
    const h = location.hash.slice(1);
    const usersMode = h === 'users';
    $('#mail').classList.toggle('users-mode', usersMode); $('#userspane').hidden = !usersMode;
    $('#searchWrap').hidden = usersMode;
    if (usersMode) { state.view = 'users'; renderFolders(); return renderUsers(); }
    if (state.view === 'users') { state.view = ''; state.rows = []; }
    if (h.startsWith('s-')) { const id = Number(h.slice(2)); return openSub(id); }
    const form = h.startsWith('f-') && h !== 'f-all' ? h.slice(2) : '';
    if (form !== state.form || !state.rows.length) { state.form = form; state.sel = null; renderFolders(); loadList(); blankReader(); }
  }
  async function start() {
    me = await fetch('/api/admin/me').then(r => r.json());
    try { const names = await fetch('/api/dept-names').then(r => r.json()); GROUPS.forEach(g => { if (names[g.id]) g.name = names[g.id]; }); } catch { }
    if (!me.user) return showLogin();
    if (!me.signedIn) return location.replace('/?notice=admin-only');
    shell();
    $('#lbody').addEventListener('click', e => {
      const m = e.target.closest('.msg'); if (m) { const id = Number(m.dataset.id); history.replaceState(null, '', '#s-' + id); openSub(id); }
      if (e.target.id === 'more') loadList(true);
    });
    $('#lhead').addEventListener('click', e => { const t = e.target.closest('[data-status]'); if (t) { state.status = t.dataset.status; loadList(); } });
    let timer; $('#q').addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = $('#q').value.trim(); loadList(); }, 250); });
    window.addEventListener('hashchange', onHash);
    await loadSummary();
    const h = location.hash.slice(1);
    if (h.startsWith('s-')) { await loadList(); openSub(Number(h.slice(2))); }
    else onHash();
    if (!state.rows.length && !h.startsWith('s-') && h !== 'users') await loadList();
  }
  start();
})();
