/* Whitespace Hub front end: navigation, search, favourites and the form renderer. */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  };

  // ---------- icons (Fluent-style, 20px) ----------
  const P = {
    home: 'M8.5 2.6a2.2 2.2 0 0 1 3 0l5.3 4.6c.4.4.7.9.7 1.5v7.1c0 1-.8 1.7-1.7 1.7h-2.6c-1 0-1.7-.8-1.7-1.7v-3.3a.5.5 0 0 0-.5-.5H9a.5.5 0 0 0-.5.5v3.3c0 1-.8 1.7-1.7 1.7H4.2c-1 0-1.7-.8-1.7-1.7V8.7c0-.6.3-1.1.7-1.5l5.3-4.6Zm2.3.8a1.2 1.2 0 0 0-1.6 0L3.9 8a1 1 0 0 0-.4.7v7.1c0 .4.3.7.7.7h2.6c.4 0 .7-.3.7-.7v-3.3c0-.8.7-1.5 1.5-1.5h2c.8 0 1.5.7 1.5 1.5v3.3c0 .4.3.7.7.7h2.6c.4 0 .7-.3.7-.7V8.7a1 1 0 0 0-.4-.7l-5.3-4.6Z',
    folder: 'M2 6c0-1.1.9-2 2-2h3.6c.4 0 .8.1 1.1.4L10.2 6H16c1.1 0 2 .9 2 2v6.5c0 1.1-.9 2-2 2H4a2 2 0 0 1-2-2V6Zm2-1a1 1 0 0 0-1 1v1h5.6l1.2-1.2-1.5-1.1a.8.8 0 0 0-.5-.2H4Zm-1 3v6.5c0 .6.4 1 1 1h12c.6 0 1-.4 1-1V8c0-.6-.4-1-1-1h-5.8L9.4 8.8a1 1 0 0 1-.7.2H3Z',
    star: 'M9.1 2.9a1 1 0 0 1 1.8 0l1.9 3.8 4.2.6a1 1 0 0 1 .5 1.7l-3 3 .7 4.2a1 1 0 0 1-1.4 1L10 15.2l-3.8 2a1 1 0 0 1-1.4-1l.7-4.2-3-3a1 1 0 0 1 .5-1.7l4.2-.6 1.9-3.8Zm.9.4L8.1 7.2a1 1 0 0 1-.8.5l-4.3.7 3.1 3a1 1 0 0 1 .3.9l-.7 4.3 3.8-2a1 1 0 0 1 1 0l3.8 2-.7-4.3a1 1 0 0 1 .3-.9l3.1-3-4.3-.7a1 1 0 0 1-.8-.5L10 3.3Z',
    starOn: 'M9.1 2.9a1 1 0 0 1 1.8 0l1.9 3.8 4.2.6a1 1 0 0 1 .5 1.7l-3 3 .7 4.2a1 1 0 0 1-1.4 1L10 15.2l-3.8 2a1 1 0 0 1-1.4-1l.7-4.2-3-3a1 1 0 0 1 .5-1.7l4.2-.6 1.9-3.8Z',
    search: 'M8.5 3a5.5 5.5 0 0 1 4.4 8.8l4 4a.5.5 0 0 1-.7.7l-4-4A5.5 5.5 0 1 1 8.5 3Zm0 1a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z',
    x: 'm4.1 4.2.1-.1a.5.5 0 0 1 .6 0l.1.1L10 9.3l5.1-5.2a.5.5 0 0 1 .8.7L10.7 10l5.2 5.1c.2.2.2.5 0 .7l-.1.1a.5.5 0 0 1-.6 0l-.1-.1L10 10.7l-5.1 5.2a.5.5 0 0 1-.8-.7L9.3 10 4.1 4.9a.5.5 0 0 1 0-.7Z',
    back: 'M9.2 16.4a.5.5 0 0 0 .7-.7L4.7 10.5H16.5a.5.5 0 0 0 0-1H4.7l5.2-5.2a.5.5 0 0 0-.7-.7L3.1 9.6a.5.5 0 0 0 0 .8l6.1 6Z',
    chev: 'M7.6 4.1a.5.5 0 0 1 .7 0l5.5 5.5c.2.2.2.6 0 .8l-5.5 5.5a.5.5 0 0 1-.7-.7l5.1-5.2-5.1-5.2a.5.5 0 0 1 0-.7Z',
    form: 'M6 2a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7.4c0-.4-.2-.8-.4-1.1l-3.9-3.9c-.3-.2-.7-.4-1.1-.4H6ZM5 4c0-.6.4-1 1-1h4v3.5c0 .8.7 1.5 1.5 1.5H15v8c0 .6-.4 1-1 1H6a1 1 0 0 1-1-1V4Zm9.8 3h-3.3a.5.5 0 0 1-.5-.5V3.2L14.8 7ZM7 10.5c0-.3.2-.5.5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Zm0 2c0-.3.2-.5.5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Zm0 2c0-.3.2-.5.5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Z',
    info: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 1a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 5.5c.3 0 .5.2.5.5v4.5a.5.5 0 0 1-1 0V9c0-.3.2-.5.5-.5Zm0-2.3a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z',
    err: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 10.5a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6ZM10 6a.5.5 0 0 0-.5.4v4.6a.5.5 0 0 0 1 0V6.5A.5.5 0 0 0 10 6Z',
    check: 'M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm3.4 5.1-.1.1-4.1 4.5-1.8-1.8a.5.5 0 0 0-.8.7l2.2 2.1c.2.2.6.2.8 0l4.4-4.9a.5.5 0 0 0-.6-.7Z',
    upload: 'M15.5 17a.5.5 0 0 0 0-1h-11a.5.5 0 0 0 0 1h11ZM10.1 3h-.2l-.2.1-4 4a.5.5 0 0 0 .6.8L9.5 4.7v9.8a.5.5 0 0 0 1 0V4.7l3.1 3.1a.5.5 0 0 0 .8-.7l-4-4-.3-.1Z',
    menu: 'M2.5 4h15a.5.5 0 0 1 .1 1h-15a.5.5 0 0 1-.1-1h15-15Zm0 5.5h15a.5.5 0 0 1 .1 1h-15a.5.5 0 0 1-.1-1h15-15Zm0 5.5h15a.5.5 0 0 1 .1 1h-15a.5.5 0 0 1-.1-1h15-15Z',
    open: 'M6 4a2 2 0 0 0-2 2v8c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-2.5a.5.5 0 0 0-1 0V14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6c0-.6.4-1 1-1h2.5a.5.5 0 0 0 0-1H6Zm5.5 0a.5.5 0 0 0 0 1h2.8l-4.6 4.6a.5.5 0 0 0 .7.7L15 5.7v2.8a.5.5 0 0 0 1 0v-4a.5.5 0 0 0-.5-.5h-4Z',
    inbox: 'M5.4 3h9.2c.9 0 1.6.6 1.9 1.4l1.4 5.3v4.8c0 1.4-1.1 2.5-2.5 2.5h-11A2.5 2.5 0 0 1 2 14.5V9.7l1.4-5.3C3.7 3.6 4.5 3 5.4 3Zm0 1a1 1 0 0 0-1 .7L3.2 9H7c.3 0 .5.2.5.5a2.5 2.5 0 0 0 5 0c0-.3.2-.5.5-.5h3.8l-1.2-4.3a1 1 0 0 0-1-.7H5.4ZM3 10v4.5c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5V10h-3.5a3.5 3.5 0 0 1-7 0H3Z',
    bolt: 'M7.4 2.3c.1-.2.3-.3.5-.3h5.6c.4 0 .6.4.5.7L12.4 7H15c.4 0 .7.5.4.8l-7.5 9.6c-.3.4-1 .1-.9-.4l1.2-5.5H5.5a.5.5 0 0 1-.5-.6l2.4-8.6ZM8.3 3 6.1 10.5h2.7c.3 0 .5.3.5.6l-.9 4.1L14 8H11.6a.5.5 0 0 1-.4-.7L12.7 3H8.3Z',
    leaf: 'M16.5 3.1c.3 0 .5.3.5.5 0 5.4-1.6 9-4 11.1A7.4 7.4 0 0 1 4.5 16l-.9 1.7a.5.5 0 0 1-.9-.4l.9-1.8C2.4 12.7 3 9.5 5.2 7.2 7.6 4.8 11.5 3.3 16.5 3.1Zm-.5 1c-4.5.3-8 1.7-10 3.8-1.9 2-2.4 4.7-1 7.1l.6-1.1C7 11 9.4 9 12.6 7.6a.5.5 0 0 1 .4.9C9.9 9.9 7.6 11.8 6 14.7l-.6 1.1c2.3 1 5 .6 7-1.1 2.1-1.8 3.5-5 3.6-10.6Z',
    eraser: 'M11.2 3.4a2 2 0 0 1 2.8 0l2.6 2.6a2 2 0 0 1 0 2.8L10.4 15H16.5a.5.5 0 0 1 0 1H8.1a2 2 0 0 1-1.5-.6L3.4 12.2a2 2 0 0 1 0-2.8l7.8-6Zm-2.5 4L4.1 10a1 1 0 0 0 0 1.4l3.2 3.2c.4.4 1 .4 1.4 0l3.6-3.6-3.6-3.6Z'
  };
  const icon = (n, cls = 'i') => `<svg class="${cls}" viewBox="0 0 20 20" aria-hidden="true"><path d="${P[n]}"/></svg>`;
  const iconEl = (n, cls) => { const s = h('span'); s.innerHTML = icon(n, cls); return s.firstChild; };

  // ---------- data ----------
  const DEPTS = window.HUB, HOME = window.HUB_HOME, QUICK = window.HUB_QUICK;
  const byDept = Object.fromEntries(DEPTS.map(d => [d.id, d]));
  let FORMS = {};
  const ITEMS = [];
  DEPTS.forEach(d => d.g.forEach(([sec, items]) => items.forEach(it => {
    const [k, t, u, m] = it;
    if (k === 'n') return;
    let url = u, type;
    if (k === 'f') { url = '#form/' + u; type = 'form'; }
    else if (k === 'l') type = 'link';
    else if (k === 'p') { url = '#d/' + u; type = 'page'; }
    else if (k === 'a') { type = 'app'; }
    else { if (u.startsWith('~')) url = window.HUB_U + u.slice(1); type = 'doc'; }
    const ext = type === 'doc' ? (url.split('?')[0].split('.').pop() || '').toLowerCase() : type;
    ITEMS.push({ key: (k === 'f' ? 'form:' + u : type + ':' + url), type, t, url, m: m || '', ext, dept: d, sec, formId: k === 'f' ? u : null });
  })));
  const formDept = {};
  ITEMS.filter(i => i.formId).forEach(i => { formDept[i.formId] = formDept[i.formId] || i; });

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
    del(k) { try { localStorage.removeItem(k); } catch { } }
  };
  let favs = store.get('wsh-favs', []);

  // ---------- shell ----------
  const pane = $('#pane'), q = $('#q'), folders = $('#folders');
  const fitSearch = () => { q.placeholder = innerWidth < 600 ? 'Search' : 'Search forms, policies and documents'; };
  fitSearch(); addEventListener('resize', fitSearch);
  const counts = d => ITEMS.filter(x => x.dept === d && x.type !== 'page').length;

  let activeFolder = 'home';
  function renderFolders(active) {
    activeFolder = active;
    const f = (href, label, ic, n, cur, color) => `<a class="folder" href="${href}"${cur ? ' aria-current="page"' : ''}>${color ? `<span class="cat" style="background:${color}"></span>` : icon(ic, 'i ic')}<span class="lbl">${esc(label)}</span>${n ? `<span class="n">${n}</span>` : ''}</a>`;
    folders.innerHTML =
      f('#home', 'Home', 'home', '', active === 'home') +
      f('#fav', 'Favourites', 'star', favs.length || '', active === 'fav') +
      `<div class="grp">Departments</div>` +
      HOME.map(id => f('#d/' + id, byDept[id].name, null, counts(byDept[id]), active === id, byDept[id].c)).join('') +
      `<div class="grp">More</div>` +
      ['how-to-guides', 'essa-discount-card'].map(id => f('#d/' + id, byDept[id].name, null, counts(byDept[id]) || '', active === id, byDept[id].c)).join('') +
      `<div class="grp">Apps</div>` + `<a class="folder" href="/carbon/">${icon('leaf', 'i ic')}<span class="lbl">Carbon platform</span></a>` +
      `<div class="grp">Admin</div>` + `<a class="folder" href="/admin">${icon('inbox', 'i ic')}<span class="lbl">Submissions</span></a>`;
  }
  const scrim = h('div', { class: 'scrim', hidden: true, onclick: () => toggleMenu(false) });
  document.body.append(scrim);
  function toggleMenu(open) { folders.classList.toggle('open', open); scrim.hidden = !open; $('#menuBtn').setAttribute('aria-expanded', open); }
  $('#menuBtn').addEventListener('click', () => toggleMenu(!folders.classList.contains('open')));

  // ---------- rows ----------
  const hl = (s, term) => { s = esc(s); if (!term) return s; const i = s.toLowerCase().indexOf(term.toLowerCase()); return i < 0 ? s : s.slice(0, i) + '<mark>' + s.slice(i, i + term.length) + '</mark>' + s.slice(i + term.length); };
  const KIND = { form: 'Form', app: 'App', link: 'Link', page: 'Page', pdf: 'PDF', docx: 'Word', doc: 'Word', xlsx: 'Excel', pptx: 'PowerPoint', png: 'Image', jpg: 'Image', jpeg: 'Image', mp4: 'Video' };
  const BADGE = { form: icon('form'), app: icon('leaf'), link: icon('open'), page: icon('chev') };
  function row(x, { where = false, term = '' } = {}) {
    const fav = favs.includes(x.key);
    const ext = x.type === 'doc' ? x.ext : x.type;
    const badge = BADGE[ext] || esc((x.ext || 'file').toUpperCase().slice(0, 4));
    const external = x.type === 'doc' || x.type === 'link';
    return `<div class="row">
      <span class="ft ${esc(ext)}" aria-hidden="true">${badge}</span>
      <span class="tt"><b>${hl(x.t, term)}</b>${x.m ? `<small>${hl(x.m, term)}</small>` : ''}</span>
      ${where ? `<span class="where"><span class="cat" style="background:${x.dept.c}"></span>${esc(x.dept.name)}</span>` : ''}
      <span class="kind">${KIND[ext] || esc(ext.toUpperCase())}</span>
      <a class="go" href="${esc(x.url)}"${external ? ' target="_blank" rel="noopener"' : ''} aria-label="${esc(x.t)}${external ? ' (opens in a new tab)' : ''}"></a>
      ${x.type === 'page' ? '' : `<button class="star" type="button" data-fav="${esc(x.key)}" aria-pressed="${fav}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites">${icon(fav ? 'starOn' : 'star')}</button>`}
    </div>`;
  }

  // ---------- views ----------
  function greeting() { const hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; }
  function viewHome() {
    const fv = favs.map(k => ITEMS.find(x => x.key === k)).filter(Boolean);
    const nf = ITEMS.filter(x => x.type === 'form').length, nd = ITEMS.filter(x => x.type === 'doc').length;
    return `<div class="pane-inner">
      <div class="hello"><div><h1 class="title">${greeting()}</h1><p class="subtitle">Forms and documents for your day-to-day work: ${nf} forms and ${nd} documents across ${HOME.length} departments.</p></div></div>
      <div class="quick">${QUICK.map(([t, id]) => `<a class="qa" href="#form/${id}"><span class="tile">${icon('bolt')}</span><span><b>${esc(t)}</b><small>${esc((formDept[id] || {}).dept ? formDept[id].dept.name : 'Form')}</small></span></a>`).join('')}</div>
      <h2 class="section">Apps</h2>
      <div class="quick" style="margin-top:0"><a class="qa" href="/carbon/"><span class="tile">${icon('leaf')}</span><span><b>Carbon platform</b><small>Company and stand footprints, targets and reports</small></span></a></div>
      ${fv.length ? `<h2 class="section">Favourites <span class="n">${fv.length}</span></h2><div class="list">${fv.map(x => row(x, { where: true })).join('')}</div>` : ''}
      <h2 class="section">Departments</h2>
      <div class="depts">${HOME.map(id => { const d = byDept[id], c = { form: 0, doc: 0, link: 0 }; ITEMS.filter(x => x.dept === d && c[x.type] != null).forEach(x => c[x.type]++);
        const parts = [c.form && `${c.form} form${c.form > 1 ? 's' : ''}`, c.doc && `${c.doc} document${c.doc > 1 ? 's' : ''}`, c.link && `${c.link} link${c.link > 1 ? 's' : ''}`].filter(Boolean);
        return `<a class="dept" href="#d/${d.id}"><span class="cat" style="background:${d.c}">${icon('folder')}</span><span><b>${esc(d.name)}</b><small>${parts.join(' · ')}</small></span></a>`; }).join('')}</div>
    </div>`;
  }
  function viewFav() {
    const fv = favs.map(k => ITEMS.find(x => x.key === k)).filter(Boolean);
    return `<div class="pane-inner"><h1 class="title">Favourites</h1><p class="subtitle">Star any form or document to keep it here. Favourites are saved in this browser.</p>
      <div style="margin-top:16px" class="list">${fv.length ? fv.map(x => row(x, { where: true })).join('') : `<div class="empty">No favourites yet. Select the star next to a form or document to add it.</div>`}</div></div>`;
  }
  function viewDept(d) {
    return `<div class="pane-inner">
      <div class="crumbs"><a href="#home">Home</a>${icon('chev', 'i16')}<span>${esc(d.name)}</span></div>
      <h1 class="title" style="display:flex;align-items:center;gap:10px"><span class="cat" style="background:${d.c};width:14px;height:14px"></span>${esc(d.name)}</h1>
      ${d.g.map(([sec, items]) => {
        const rows = ITEMS.filter(x => x.dept === d && x.sec === sec);
        const notes = items.filter(i => i[0] === 'n').map(i => `<div class="note">${i[1]}</div>`).join('');
        return `<h2 class="section">${esc(sec)}${rows.length ? ` <span class="n">${rows.length}</span>` : ''}</h2>${notes}${rows.length ? `<div class="list">${rows.map(x => row(x)).join('')}</div>` : ''}`;
      }).join('')}
    </div>`;
  }
  let filter = 'all';
  function viewSearch(term) {
    const t = term.toLowerCase();
    let hits = ITEMS.filter(x => x.type !== 'page' && (x.t + ' ' + x.m + ' ' + x.sec + ' ' + x.dept.name + ' ' + (KIND[x.ext] || '')).toLowerCase().includes(t));
    const n = { all: hits.length, form: hits.filter(x => x.type === 'form').length, doc: hits.filter(x => x.type === 'doc').length, link: hits.filter(x => x.type === 'link').length };
    if (filter !== 'all') hits = hits.filter(x => x.type === filter);
    hits.sort((a, b) => b.t.toLowerCase().includes(t) - a.t.toLowerCase().includes(t));
    const chip = (k, l) => `<button class="chip" type="button" data-filter="${k}" aria-pressed="${filter === k}">${l} (${n[k]})</button>`;
    return `<div class="pane-inner"><h1 class="title">Results for “${esc(term)}”</h1>
      <div class="chips" style="margin-top:12px">${chip('all', 'All')}${chip('form', 'Forms')}${chip('doc', 'Documents')}${chip('link', 'Links')}</div>
      <div class="list">${hits.length ? hits.map(x => row(x, { where: true, term })).join('') : `<div class="empty">Nothing matches “${esc(term)}”. Try a shorter word, such as “toil” or “policy”.</div>`}</div></div>`;
  }

  // ---------- router ----------
  let formCtl = null;
  async function route() {
    const term = q.value.trim();
    const hash = decodeURIComponent((location.hash || '#home').slice(1));
    $('#qClear').hidden = !term;
    if (formCtl && !hash.startsWith('form/')) { formCtl.destroy(); formCtl = null; }
    if (term) { renderFolders(''); pane.innerHTML = viewSearch(term); return; }
    if (hash.startsWith('form/')) {
      const id = hash.slice(5);
      renderFolders(formDept[id] ? formDept[id].dept.id : '');
      if (formCtl && formCtl.id === id) return;
      if (!Object.keys(FORMS).length) await loadForms();
      const def = FORMS[id];
      if (!def) { pane.innerHTML = `<div class="pane-inner"><div class="empty">This form could not be found. It may have been removed.<br><br><a class="btn" href="#home">Go to Home</a></div></div>`; return; }
      formCtl = renderForm(def); pane.scrollTop = 0; return;
    }
    if (hash.startsWith('d/') && byDept[hash.slice(2)]) { const d = byDept[hash.slice(2)]; renderFolders(d.id); pane.innerHTML = viewDept(d); }
    else if (hash === 'fav') { renderFolders('fav'); pane.innerHTML = viewFav(); }
    else { renderFolders('home'); pane.innerHTML = viewHome(); }
    pane.scrollTop = 0;
  }
  async function loadForms() {
    try { const r = await fetch('/forms.json'); FORMS = Object.fromEntries((await r.json()).map(f => [f.id, f])); }
    catch { pane.innerHTML = `<div class="pane-inner"><div class="bar-msg error">${icon('err')}<div>The forms could not be loaded. Check your connection and refresh the page.</div></div></div>`; throw new Error('forms'); }
  }
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#form/')) q.value = ''; filter = 'all'; toggleMenu(false); route(); });
  q.addEventListener('input', () => { filter = 'all'; route(); });
  $('#qClear').addEventListener('click', () => { q.value = ''; route(); q.focus(); });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
    if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; route(); }
  });
  pane.addEventListener('click', e => {
    const s = e.target.closest('[data-fav]');
    if (s) {
      const k = s.dataset.fav; favs = favs.includes(k) ? favs.filter(x => x !== k) : [...favs, k]; store.set('wsh-favs', favs);
      const on = favs.includes(k); s.setAttribute('aria-pressed', on); s.innerHTML = icon(on ? 'starOn' : 'star'); s.setAttribute('aria-label', (on ? 'Remove from' : 'Add to') + ' favourites');
      renderFolders(activeFolder);
      if (location.hash === '#fav' || (!location.hash || location.hash === '#home')) route();
      return;
    }
    const f = e.target.closest('[data-filter]');
    if (f) { filter = f.dataset.filter; route(); }
  });

  // =====================================================================
  // Form renderer
  // =====================================================================
  const E = window.FormEngine;
  const SEG_MAX = 4;
  function renderForm(def) {
    const draftKey = 'wsh-draft-' + def.id;
    const values = store.get(draftKey, {}) || {};
    const files = {}; // id -> File[]
    const wraps = {};
    const info = formDept[def.id];
    let sending = false;

    const root = h('div', { class: 'pane-inner' });
    const wrap = h('div', { class: 'formwrap' });
    const heads = def.fields.filter(f => f.type === 'head');
    const titleField = heads[0] && def.fields.indexOf(heads[0]) < 2 ? heads[0] : null;
    root.append(
      h('div', { class: 'crumbs', html: `<a href="#home">Home</a>${icon('chev', 'i16')}${info ? `<a href="#d/${info.dept.id}">${esc(info.dept.name)}</a>${icon('chev', 'i16')}` : ''}<span>${esc(def.name)}</span>` }),
      h('div', { class: 'form-head' },
        h('h1', { class: 'title' }, titleField ? (titleField.label || def.name) : def.name),
        titleField && titleField.sub ? h('p', { class: 'subtitle' }, titleField.sub) : null)
    );
    const restored = Object.keys(values).length > 0;
    const draftNote = restored ? h('div', { class: 'bar-msg warn', html: `${icon('info')}<div style="flex:1">You have unsent answers from earlier. They are filled in below.</div>` }) : null;
    if (draftNote) { const b = h('button', { class: 'btn subtle', type: 'button', onclick: () => { clearAll(); } }, 'Start again'); draftNote.append(b); wrap.append(draftNote); }

    const form = h('form', { novalidate: true, autocomplete: 'on' });
    form.append(h('input', { class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }));
    const errBox = h('div', { hidden: true, role: 'alert' });
    form.append(errBox);

    let n = 0;
    for (const f of def.fields) {
      if (f === titleField) continue;
      const el = renderField(f, ++n);
      if (el) { wraps[f.id] = el; form.append(el); }
    }
    const status = h('span', { class: 'status', 'aria-live': 'polite' });
    const submitBtn = h('button', { class: 'btn primary large', type: 'submit' }, 'Submit');
    form.append(h('div', { class: 'submitbar' }, submitBtn, h('button', { class: 'btn subtle', type: 'button', onclick: () => clearAll() }, 'Clear form'), status));
    form.addEventListener('submit', onSubmit);
    wrap.append(form); root.append(wrap);
    pane.innerHTML = ''; pane.append(root);
    refresh();

    function save() {
      const keep = {}; for (const [k, v] of Object.entries(values)) if (!E.isEmpty(v)) keep[k] = v;
      if (Object.keys(keep).length) { store.set(draftKey, keep); status.textContent = 'Draft saved on this device'; } else store.del(draftKey);
    }
    function set(id, v) { values[id] = v; refresh(); save(); clearErr(id); }
    function refresh() {
      const vis = E.visibleFields(def, values);
      for (const [id, el] of Object.entries(wraps)) el.hidden = !vis.has(id);
      for (const f of def.fields.filter(f => f.type === 'calculation')) { const o = wraps[f.id] && wraps[f.id].querySelector('.calc'); if (o) o.textContent = E.calc(def, f, values); }
    }
    function clearErr(id) { const w = wraps[id]; if (w && w.classList.contains('err')) { w.classList.remove('err'); const m = w.querySelector('.msg'); if (m) m.remove(); } }
    function clearAll() {
      store.del(draftKey); for (const k of Object.keys(values)) delete values[k];
      for (const k of Object.keys(files)) delete files[k];
      formCtl = null; formCtl = renderForm(def); pane.scrollTop = 0;
    }

    // ----- individual fields -----
    function labelFor(f, forId, asLegend) {
      const text = f.label || '';
      if (!text) return null;
      const L = h(asLegend ? 'legend' : 'label', asLegend ? {} : { for: forId }, text);
      if (f.required) L.append(h('span', { class: 'req', 'aria-hidden': 'true' }, '*'));
      return L;
    }
    function renderField(f, i) {
      const id = 'f' + def.id.slice(-4) + '_' + f.id;
      const v = values[f.id];
      const req = f.required ? true : null;
      switch (f.type) {
        case 'head': {
          if (!f.label && !f.sub) return null;
          return h('div', { class: 'fsec' }, f.label ? h('h3', {}, f.label) : null, f.sub ? h('p', {}, f.sub) : null);
        }
        case 'divider': return h('hr', { class: 'fdiv' });
        case 'text': return h('div', { class: 'info', html: icon('info') + `<div>${esc(f.html)}</div>` });
        case 'textbox': case 'email': case 'number': case 'phone': {
          const input = h('input', { id, class: 'ctl', type: { email: 'email', number: 'number', phone: 'tel' }[f.type] || 'text', placeholder: f.placeholder, required: req, autocomplete: f.type === 'email' ? 'email' : f.type === 'phone' ? 'tel' : 'off', inputmode: f.type === 'number' ? 'decimal' : null });
          input.value = v || ''; input.addEventListener('input', () => set(f.id, input.value));
          return h('div', { class: 'q' }, labelFor(f, id), input);
        }
        case 'textarea': {
          const t = h('textarea', { id, class: 'ctl', required: req, rows: 3 }); t.value = v || '';
          t.addEventListener('input', () => set(f.id, t.value));
          return h('div', { class: 'q' }, labelFor(f, id), t);
        }
        case 'fullname': {
          const parts = f.parts || ['First name', 'Last name'];
          const cur = v || {};
          const a = h('input', { id, class: 'ctl', autocomplete: f.parts ? 'off' : 'given-name' }), b = h('input', { id: id + 'b', class: 'ctl', autocomplete: f.parts ? 'off' : 'family-name' });
          a.value = cur.first || ''; b.value = cur.last || '';
          const upd = () => set(f.id, { first: a.value, last: b.value });
          a.addEventListener('input', upd); b.addEventListener('input', upd);
          return h('fieldset', { class: 'q' }, labelFor(f, id, true),
            h('div', { class: 'grid2' }, h('div', {}, a, h('div', { class: 'sub' }, parts[0])), h('div', {}, b, h('div', { class: 'sub' }, parts[1] || 'Last name'))));
        }
        case 'address': {
          const cur = v || {};
          const keys = [['street', 'Street address', 'address-line1'], ['line2', 'Address line 2', 'address-line2'], ['city', 'Town or city', 'address-level2'], ['region', 'County / state', 'address-level1'], ['postcode', 'Postcode', 'postal-code']];
          if ((f.parts || []).includes('Country')) keys.push(['country', 'Country', 'country-name']);
          const inputs = keys.map(([k, lab, ac], j) => { const x = h('input', { id: j ? id + k : id, class: 'ctl', autocomplete: ac }); x.value = cur[k] || ''; x.addEventListener('input', () => set(f.id, Object.fromEntries(keys.map(([kk], jj) => [kk, inputs[jj].value])))); return [x, lab]; });
          const cell = ([x, lab]) => h('div', {}, x, h('div', { class: 'sub' }, lab));
          return h('fieldset', { class: 'q' }, labelFor(f, id, true), h('div', { class: 'grid2' },
            h('div', { style: 'grid-column:1/-1' }, ...cell(inputs[0]).childNodes), h('div', { style: 'grid-column:1/-1' }, ...cell(inputs[1]).childNodes), ...inputs.slice(2).map(cell)));
        }
        case 'date': case 'datetime': {
          const x = h('input', { id, class: 'ctl', type: f.type === 'date' ? 'date' : 'datetime-local', required: req }); x.value = v || '';
          x.addEventListener('change', () => set(f.id, x.value)); x.addEventListener('input', () => set(f.id, x.value));
          return h('div', { class: 'q' }, labelFor(f, id), x);
        }
        case 'time': {
          const cur = v || {};
          const a = h('input', { id, class: 'ctl', type: 'time' }); a.value = cur.from || '';
          const parts = [a];
          let b = null;
          if (f.range) { b = h('input', { id: id + 'to', class: 'ctl', type: 'time', 'aria-label': 'Until' }); b.value = cur.to || ''; }
          const upd = () => set(f.id, b ? { from: a.value, to: b.value } : { from: a.value });
          a.addEventListener('input', upd); if (b) b.addEventListener('input', upd);
          return h('div', { class: 'q' }, labelFor(f, id), h('div', { class: 'timepair' }, a, b ? h('span', { style: 'color:var(--fg-3)' }, 'until') : null, b));
        }
        case 'dropdown': {
          const s = h('select', { id, class: 'ctl', required: req }, h('option', { value: '' }, 'Select an option'), ...f.options.map(o => h('option', { value: o }, o)));
          s.value = v || ''; s.addEventListener('change', () => set(f.id, s.value));
          return h('div', { class: 'q' }, labelFor(f, id), s);
        }
        case 'radio': case 'checkbox': {
          const multi = f.type === 'checkbox';
          const opts = f.options || [];
          const short = !multi && opts.length <= SEG_MAX && opts.every(o => o.length <= 14);
          const cur = multi ? (Array.isArray(v) ? v : []) : (v || '');
          const curPlain = multi ? cur.map(x => x.startsWith('Other:') ? 'Other' : x) : (String(cur).startsWith('Other:') ? 'Other' : cur);
          const otherVal = (multi ? cur.find(x => x.startsWith('Other:')) : (String(cur).startsWith('Other:') ? cur : '')) || '';
          const box = h('div', { class: short ? 'seg' : 'opts', role: multi ? 'group' : 'radiogroup' });
          const other = f.other ? h('input', { class: 'ctl other', placeholder: 'Type your answer', 'aria-label': 'Other answer', hidden: true }) : null;
          if (other) other.value = otherVal.replace(/^Other:\s*/, '');
          const read = () => {
            const checked = [...box.querySelectorAll('input:checked')].map(x => x.value);
            if (other) other.hidden = !checked.includes('Other');
            const map = x => x === 'Other' && other && other.value.trim() ? 'Other: ' + other.value.trim() : x;
            set(f.id, multi ? checked.map(map) : (checked[0] ? map(checked[0]) : ''));
          };
          opts.forEach((o, j) => {
            const inp = h('input', { type: multi ? 'checkbox' : 'radio', name: id, value: o, id: id + '_' + j });
            inp.checked = multi ? curPlain.includes(o) : curPlain === o;
            inp.addEventListener('change', read);
            box.append(short ? h('label', { for: id + '_' + j }, inp, h('span', {}, o)) : h('label', { class: 'opt', for: id + '_' + j }, inp, h('span', {}, o)));
          });
          if (other) { other.hidden = !(multi ? curPlain.includes('Other') : curPlain === 'Other'); other.addEventListener('input', read); }
          const fs = h('fieldset', { class: 'q' }, labelFor(f, id, true), box, other);
          if (!f.label && opts.length === 1) fs.querySelector('legend')?.remove();
          return fs;
        }
        case 'rating': {
          const max = f.max || 5, box = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': f.label });
          const paint = () => [...box.children].forEach((b, j) => { b.classList.toggle('on', j < Number(values[f.id] || 0)); b.setAttribute('aria-checked', String(j + 1) === String(values[f.id])); });
          for (let j = 1; j <= max; j++) box.append(h('button', { type: 'button', role: 'radio', 'aria-label': `${j} of ${max}`, html: `<svg viewBox="0 0 20 20"><path d="${P.starOn}"/></svg>`, onclick: () => { set(f.id, String(j) === String(values[f.id]) ? '' : String(j)); paint(); } }));
          paint();
          return h('fieldset', { class: 'q' }, labelFor(f, id, true), box);
        }
        case 'scale': {
          const max = f.max || 10, box = h('div', { class: 'seg scale', role: 'radiogroup' });
          for (let j = 1; j <= max; j++) {
            const inp = h('input', { type: 'radio', name: id, value: String(j), id: id + '_' + j }); inp.checked = String(v) === String(j);
            inp.addEventListener('change', () => set(f.id, String(j)));
            box.append(h('label', { for: id + '_' + j }, inp, h('span', {}, String(j))));
          }
          return h('fieldset', { class: 'q' }, labelFor(f, id, true), box, h('div', { class: 'hint', style: 'margin-top:4px' }, `1 = lowest, ${max} = highest`));
        }
        case 'calculation':
          return h('div', { class: 'q' }, h('label', {}, f.label || 'Total'), h('output', { class: 'calc' }, '0'));
        case 'file': return fileField(f, id);
        case 'signature': return sigField(f, id);
        case 'products': return productsField(f, id);
        default: return null;
      }
    }

    function fileField(f, id) {
      const list = h('ul', { class: 'files' });
      const input = h('input', { id, type: 'file', multiple: true });
      const box = h('label', { class: 'filebox', for: id },
        h('span', { class: 'btn', html: icon('upload') + 'Choose files' }),
        h('span', { class: 'hint2' }, 'Or drag files here. Photos from your phone camera work too. Up to 25 MB each.'), input);
      const paint = () => {
        list.innerHTML = '';
        (files[f.id] || []).forEach((file, j) => {
          const li = h('li', {});
          if (/^image\//.test(file.type)) { const img = h('img', { alt: '' }); img.src = URL.createObjectURL(file); li.append(img); }
          li.append(h('span', { class: 'nm' }, file.name), h('span', { class: 'sz' }, (file.size / 1048576).toFixed(1) + ' MB'),
            h('button', { class: 'btn subtle', type: 'button', 'aria-label': 'Remove ' + file.name, html: icon('x', 'i16'), onclick: () => { files[f.id].splice(j, 1); paint(); } }));
          list.append(li);
        });
      };
      const add = fl => {
        const arr = files[f.id] = files[f.id] || [];
        for (const file of fl) { if (file.size > 25 * 1048576) { showFieldErr(f.id, `${file.name} is over 25 MB. Choose a smaller file.`); continue; } arr.push(file); }
        paint(); clearErr(f.id);
      };
      input.addEventListener('change', () => { add(input.files); input.value = ''; });
      box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
      box.addEventListener('dragleave', () => box.classList.remove('drag'));
      box.addEventListener('drop', e => { e.preventDefault(); box.classList.remove('drag'); add(e.dataTransfer.files); });
      return h('div', { class: 'q' }, labelFor(f, id) || h('label', { for: id }, 'Upload files'), box, list);
    }

    function sigField(f, id) {
      const canvas = h('canvas', { id, 'aria-label': 'Signature pad. Draw your signature with a mouse, finger or pen.' });
      const pad = h('div', { class: 'sig' }, canvas, h('div', { class: 'line' }), h('div', { class: 'ph' }, 'Sign above the line'));
      let ctx, drawing = false, dirty = !!values[f.id];
      const setup = () => {
        const r = canvas.getBoundingClientRect(); if (!r.width) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = r.width * dpr; canvas.height = 160 * dpr;
        ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1B1B1B';
        if (values[f.id]) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, 160); img.src = values[f.id]; }
      };
      requestAnimationFrame(setup);
      const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      canvas.addEventListener('pointerdown', e => { if (!ctx) setup(); drawing = true; canvas.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + .1, y + .1); ctx.stroke(); });
      canvas.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); });
      const end = () => { if (!drawing) return; drawing = false; dirty = true; set(f.id, canvas.toDataURL('image/png')); };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
      const clear = h('button', { class: 'btn subtle', type: 'button', html: icon('eraser') + 'Clear signature', onclick: () => { if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; set(f.id, ''); } });
      return h('div', { class: 'q' }, labelFor(f, id) || h('label', { for: id }, 'Signature'), pad, h('div', { class: 'sigtools' }, clear));
    }

    function productsField(f, id) {
      const cur = (values[f.id] && values[f.id].items) || {};
      const box = h('div', { class: 'products', role: 'group', 'aria-label': f.label });
      const write = () => set(f.id, { items: JSON.parse(JSON.stringify(cur)) });
      f.products.forEach((p, j) => {
        const it = cur[p.name];
        const out = h('output', {}, String(it ? it.qty : 0));
        const optsBox = h('div', { class: 'po', hidden: !it || !p.opts.length });
        const rowEl = h('div', { class: 'prod' + (it ? ' on' : '') });
        const setQty = qn => {
          qn = Math.max(0, Math.min(p.max, qn));
          if (qn === 0) delete cur[p.name]; else cur[p.name] = { qty: qn, opts: (cur[p.name] && cur[p.name].opts) || {} };
          out.textContent = qn; rowEl.classList.toggle('on', qn > 0); optsBox.hidden = !(qn > 0 && p.opts.length); write();
        };
        p.opts.forEach(o => {
          const s = h('select', { class: 'ctl' }, h('option', { value: '' }, 'Choose'), ...o.values.map(x => h('option', { value: x }, x)));
          s.value = (it && it.opts[o.name]) || '';
          s.addEventListener('change', () => { if (cur[p.name]) { cur[p.name].opts[o.name] = s.value; write(); } });
          optsBox.append(h('label', {}, o.name, s));
        });
        rowEl.append(h('div', { class: 'pn' }, p.name, p.max > 1 ? h('div', { class: 'hint', style: 'margin:2px 0 0;font-weight:400' }, `Up to ${p.max}`) : null),
          h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': 'Fewer ' + p.name, onclick: () => setQty(Number(out.textContent) - 1) }, '−'), out,
            h('button', { type: 'button', 'aria-label': 'More ' + p.name, onclick: () => setQty(Number(out.textContent) + 1) }, '+')), optsBox);
        box.append(rowEl);
      });
      return h('fieldset', { class: 'q' }, labelFor(f, id, true), box);
    }

    function showFieldErr(fid, msg) {
      const w = wraps[fid]; if (!w) return;
      w.classList.add('err'); const old = w.querySelector('.msg'); if (old) old.remove();
      w.append(h('div', { class: 'msg', html: icon('err', 'i16') + esc(msg) }));
    }

    async function onSubmit(e) {
      e.preventDefault();
      if (sending) return;
      Object.keys(wraps).forEach(clearErr); errBox.hidden = true;
      // products must have a size picked where one is offered
      const fileCounts = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.length]));
      const { errors } = E.validate(def, values, fileCounts);
      for (const f of def.fields.filter(f => f.type === 'products')) {
        const items = (values[f.id] && values[f.id].items) || {};
        const p = f.products.find(p => items[p.name] && p.opts.some(o => !items[p.name].opts[o.name]));
        if (p) errors[f.id] = `Choose the ${p.opts.map(o => o.name.toLowerCase()).join(' and ')} for ${p.name}.`;
      }
      const ids = Object.keys(errors);
      if (ids.length) {
        ids.forEach(id => showFieldErr(id, errors[id]));
        errBox.className = 'bar-msg error'; errBox.innerHTML = icon('err') + `<div>${ids.length === 1 ? 'One answer needs' : ids.length + ' answers need'} attention before you can submit.</div>`; errBox.hidden = false;
        const first = wraps[ids[0]]; if (first) { first.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); const c = first.querySelector('input,textarea,select,button,canvas'); if (c) c.focus({ preventScroll: true }); }
        return;
      }
      sending = true; submitBtn.disabled = true; submitBtn.innerHTML = '<span class="spinner"></span> Sending…';
      const fd = new FormData();
      fd.append('data', JSON.stringify(values));
      fd.append('website', form.querySelector('.hp').value);
      const vis = E.visibleFields(def, values);
      for (const [fid, list] of Object.entries(files)) if (vis.has(fid)) list.forEach(file => fd.append('file_' + fid, file, file.name));
      try {
        const r = await fetch(`/api/forms/${def.id}/submit`, { method: 'POST', body: fd });
        const out = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (out.fields) Object.entries(out.fields).forEach(([k, m]) => showFieldErr(k, m));
          throw new Error(out.error || 'The form could not be sent.');
        }
        store.del(draftKey);
        pane.scrollTop = 0;
        root.innerHTML = '';
        root.append(h('div', { class: 'done' },
          h('div', { class: 'tick', html: icon('check') }),
          h('h1', { class: 'title' }, 'Thanks, that’s been sent'),
          h('p', { class: 'subtitle', style: 'margin:8px auto 0' }, `${def.name} was received. Quote this reference if you need to follow it up:`),
          h('div', { class: 'ref' }, out.ref),
          h('div', { class: 'cmdbar', style: 'justify-content:center' },
            h('button', { class: 'btn primary', type: 'button', onclick: () => clearAll() }, 'Fill in another'),
            h('a', { class: 'btn', href: info ? '#d/' + info.dept.id : '#home' }, info ? 'Back to ' + info.dept.name : 'Back to Home'))));
      } catch (err) {
        errBox.className = 'bar-msg error'; errBox.innerHTML = icon('err') + `<div>${esc(err.message)} Your answers are still here, so you can try again.</div>`; errBox.hidden = false;
        errBox.scrollIntoView({ block: 'center' });
      } finally { sending = false; submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
    }

    return { id: def.id, destroy() { } };
  }

  route();
})();
