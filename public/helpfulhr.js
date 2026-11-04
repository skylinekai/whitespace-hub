/* Helpful HR: the hub's question-answering assistant (answers only from what's in the hub). */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k, d) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { } } };
  const AV = '/helpful-hr.jpg';
  const SUGGEST = ['What does the expense policy say about subsistence in London?', 'How do I book annual leave?', 'How do I report an accident at work?', 'What is the mileage rate for using my own car?'];
  const ICON = {
    send: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.7 2.1a.5.5 0 0 1 .6-.1l15 7.5a.5.5 0 0 1 0 .9l-15 7.5a.5.5 0 0 1-.7-.6L4.8 10 2.6 2.7a.5.5 0 0 1 .1-.6ZM5.7 10.5l-1.8 5.9L16.4 10 3.9 3.7l1.8 5.8h6.8a.5.5 0 0 1 0 1H5.7Z"/></svg>',
    x: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.1 4.2.1-.1a.5.5 0 0 1 .6 0l.1.1L10 9.3l5.1-5.2a.5.5 0 0 1 .8.7L10.7 10l5.2 5.1c.2.2.2.5 0 .7l-.1.1a.5.5 0 0 1-.6 0l-.1-.1L10 10.7l-5.1 5.2a.5.5 0 0 1-.8-.7L9.3 10 4.1 4.9a.5.5 0 0 1 0-.7Z"/></svg>',
    doc: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 2a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7.4c0-.4-.2-.8-.4-1l-3.9-4c-.3-.3-.7-.4-1.1-.4H6Zm-1 2a1 1 0 0 1 1-1h4v3.5c0 .8.7 1.5 1.5 1.5H15v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4Zm9.8 3h-3.3a.5.5 0 0 1-.5-.5V3.2L14.8 7Z"/></svg>',
    form: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 6a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7Zm0 3a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7Zm0 3a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4ZM4 4.5C4 3.1 5.1 2 6.5 2h7C14.9 2 16 3.1 16 4.5v11c0 1.4-1.1 2.5-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5v-11ZM6.5 3C5.7 3 5 3.7 5 4.5v11c0 .8.7 1.5 1.5 1.5h7c.8 0 1.5-.7 1.5-1.5v-11c0-.8-.7-1.5-1.5-1.5h-7Z"/></svg>',
    folder: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2 6c0-1.1.9-2 2-2h3.6c.4 0 .8.1 1.1.4L10.4 6H16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-5.8c-.1 0-.3 0-.4-.1L8 5.1H4Z"/></svg>',
    news: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M15.5 3.1c.3.1.5.4.5.7v12.4a.8.8 0 0 1-1.1.7L10.7 15H9.5l.8 2.4a.5.5 0 0 1-.5.6H7.6a.5.5 0 0 1-.5-.3L6 15H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h5.7l4.2-1.9a.8.8 0 0 1 .6 0ZM15 4.2 11 6v8l4 1.8V4.2ZM10 6H5a2 2 0 0 0-2 2v4c0 1.1.9 2 2 2h5V6Z"/></svg>',
    more: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.25 10a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM15 11.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/></svg>',
    restart: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 3a.5.5 0 0 1 .5.5v3.3A7 7 0 1 1 3 10.5a.5.5 0 0 1 1 0A6 6 0 1 0 5.7 6H8.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5v-3c0-.3.2-.5.5-.5Z"/></svg>'
  };
  let me = null, open = false, busy = false;
  let chat = store.get('hhr-chat', []);   // [{role, content, sources?, passages?, mode?, error?}]

  // ---------- markup ----------
  const fab = document.createElement('button');
  fab.className = 'hhr-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Ask Helpful HR'); fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'hhrPanel');
  fab.innerHTML = `<img src="${AV}" alt=""><span class="hhr-dot" aria-hidden="true"></span><span class="hhr-fablabel">Ask Helpful HR</span>`;
  const panel = document.createElement('section');
  panel.className = 'hhr-panel'; panel.id = 'hhrPanel'; panel.hidden = true; panel.setAttribute('aria-label', 'Helpful HR');
  panel.innerHTML = `
    <header class="hhr-head"><img src="${AV}" alt=""><div class="hhr-id"><b>Helpful HR</b><small>Answers from the hub only</small></div>
      <button class="hhr-ib" type="button" id="hhrMenu" aria-label="More options" aria-haspopup="menu">${ICON.more}</button>
      <button class="hhr-ib" type="button" id="hhrClose" aria-label="Close Helpful HR">${ICON.x}</button></header>
    <div class="hhr-log" id="hhrLog" role="log" aria-live="polite"></div>
    <form class="hhr-ask" id="hhrForm"><textarea id="hhrQ" rows="1" maxlength="1000" placeholder="Ask about a policy, form or document…" aria-label="Your question"></textarea>
      <button type="submit" class="hhr-send" aria-label="Send">${ICON.send}</button></form>
    <p class="hhr-note">Helpful HR only uses what’s in the hub and can make mistakes. Check the source before relying on it.</p>`;
  document.body.append(fab, panel);
  const log = $('#hhrLog', panel), q = $('#hhrQ', panel), form = $('#hhrForm', panel);

  // ---------- rendering ----------
  // small, safe formatting: **bold**, bullet lines, numbered lines, [n] citations
  function fmt(text, sources) {
    const byN = new Map((sources || []).map(s => [s.n, s]));
    const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\[(\d{1,2})\]/g, (m, n) => byN.has(Number(n)) ? `<a class="hhr-cite" href="${esc(href(byN.get(Number(n))))}"${ext(byN.get(Number(n)))} title="${esc(byN.get(Number(n)).title)}">${n}</a>` : '');
    const out = []; let list = null;
    for (const raw of String(text || '').split('\n')) {
      const line = raw.trim();
      const b = line.match(/^[-•*]\s+(.*)/), o = line.match(/^\d+[.)]\s+(.*)/);
      if (b || o) { const tag = b ? 'ul' : 'ol'; if (!list || list.tag !== tag) { if (list) out.push(`</${list.tag}>`); list = { tag }; out.push(`<${tag}>`); } out.push(`<li>${inline((b || o)[1])}</li>`); continue; }
      if (list) { out.push(`</${list.tag}>`); list = null; }
      if (line) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`</${list.tag}>`);
    return out.join('');
  }
  const href = s => s.page && /\.pdf($|\?)/i.test(s.url) ? s.url + '#page=' + s.page : s.url;
  const ext = s => /^(https?:|\/files\/)/.test(s.url) ? ' target="_blank" rel="noopener"' : '';
  const srcIcon = k => k === 'form' ? ICON.form : k === 'news' ? ICON.news : k === 'folder' || k === 'note' ? ICON.folder : ICON.doc;
  function sourcesHtml(sources) {
    if (!sources || !sources.length) return '';
    return `<div class="hhr-srcs"><span class="hhr-srcl">Sources</span>${sources.map(s => `<a class="hhr-src" href="${esc(href(s))}"${ext(s)}>${srcIcon(s.kind)}<span><b>${s.n ? `<i>${s.n}</i>` : ''}${esc(s.title)}</b><small>${esc([s.where, s.page ? 'page ' + s.page : ''].filter(Boolean).join(' · '))}</small></span></a>`).join('')}</div>`;
  }
  function render() {
    const first = me ? String(me.name || '').split(/\s+/)[0] : '';
    let h = `<div class="hhr-msg bot"><img class="hhr-av" src="${AV}" alt=""><div class="hhr-bub"><p>Hi${first ? ' ' + esc(first) : ''}, I’m <b>Helpful HR</b>. Ask me anything about our policies, forms and documents. I only answer from what’s in the hub, and I’ll show you where I found it.</p></div></div>`;
    if (!chat.length) h += `<div class="hhr-sugg" aria-label="Suggested questions">${SUGGEST.map(s => `<button type="button" class="hhr-chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
    for (const m of chat) {
      if (m.role === 'user') h += `<div class="hhr-msg me"><div class="hhr-bub">${esc(m.content)}</div></div>`;
      else h += `<div class="hhr-msg bot${m.error ? ' err' : ''}"><img class="hhr-av" src="${AV}" alt=""><div class="hhr-bub">${fmt(m.content, m.sources)}
        ${m.passages ? m.passages.map(p => `<blockquote class="hhr-quote"><a href="${esc(href(p))}"${ext(p)}><b>${esc(p.title)}</b>${p.page ? ` · page ${p.page}` : ''}</a><p>${esc(p.text)}</p></blockquote>`).join('') : ''}
        ${m.passages ? '' : sourcesHtml(m.sources)}</div></div>`;
    }
    if (busy) h += `<div class="hhr-msg bot"><img class="hhr-av" src="${AV}" alt=""><div class="hhr-bub hhr-typing" aria-label="Helpful HR is looking through the hub"><span></span><span></span><span></span></div></div>`;
    log.innerHTML = h;
    log.scrollTop = log.scrollHeight;
  }

  // ---------- asking ----------
  async function ask(text) {
    text = String(text || '').trim(); if (!text || busy) return;
    const history = chat.filter(m => !m.error).map(m => ({ role: m.role, content: m.content })).slice(-6);
    chat.push({ role: 'user', content: text }); busy = true; render(); store.set('hhr-chat', chat);
    q.value = ''; grow();
    try {
      const r = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, history }) });
      if (r.status === 401) { location.href = '/login?next=' + encodeURIComponent(location.pathname + location.hash); return; }
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'Something went wrong. Try again.');
      chat.push({ role: 'assistant', content: out.answer, sources: out.sources, passages: out.passages, mode: out.mode });
    } catch (e) { chat.push({ role: 'assistant', content: e.message, error: true }); }
    busy = false; chat = chat.slice(-30); store.set('hhr-chat', chat); render();
    q.focus();
  }
  const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(140, q.scrollHeight) + 'px'; };
  q.addEventListener('input', grow);
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q.value); } });
  form.addEventListener('submit', e => { e.preventDefault(); ask(q.value); });
  log.addEventListener('click', e => {
    const c = e.target.closest('[data-q]'); if (c) return ask(c.dataset.q);
    const a = e.target.closest('a[href^="#"]'); if (a && innerWidth < 700) setOpen(false);   // on phones, get out of the way when opening a hub page
  });

  // ---------- open / close ----------
  function setOpen(v) {
    open = v; panel.hidden = !v; fab.setAttribute('aria-expanded', v); fab.classList.toggle('on', v); document.body.classList.toggle('hhr-open', v);
    if (v) { render(); setTimeout(() => q.focus(), 30); } else fab.focus();
  }
  fab.addEventListener('click', () => setOpen(!open));
  $('#hhrClose', panel).addEventListener('click', () => setOpen(false));
  panel.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('.hhr-menu')) setOpen(false); });

  // ---------- menu: new chat, and (admins) what Helpful HR has read ----------
  $('#hhrMenu', panel).addEventListener('click', e => {
    const old = $('.hhr-menu'); if (old) { old.remove(); return; }
    const m = document.createElement('div'); m.className = 'hhr-menu'; m.setAttribute('role', 'menu');
    m.innerHTML = `<button type="button" role="menuitem" data-m="new">${ICON.restart}<span>Start a new conversation</span></button>${me && me.role === 'admin' ? `<button type="button" role="menuitem" data-m="status">${ICON.doc}<span>What Helpful HR has read</span></button>` : ''}`;
    panel.append(m); m.querySelector('button').focus();
    const close = ev => { if (!m.contains(ev.target) && ev.target !== e.currentTarget) { m.remove(); document.removeEventListener('pointerdown', close, true); } };
    setTimeout(() => document.addEventListener('pointerdown', close, true));
    m.addEventListener('keydown', ev => { if (ev.key === 'Escape') { m.remove(); $('#hhrMenu', panel).focus(); } });
    m.addEventListener('click', ev => {
      const b = ev.target.closest('[data-m]'); if (!b) return; m.remove();
      if (b.dataset.m === 'new') { chat = []; store.set('hhr-chat', chat); render(); q.focus(); }
      if (b.dataset.m === 'status') showStatus();
    });
  });
  async function showStatus() {
    const box = document.createElement('div'); box.className = 'hhr-status';
    box.innerHTML = '<div class="hhr-statushead"><b>What Helpful HR has read</b><button class="hhr-ib" type="button" aria-label="Close">' + ICON.x + '</button></div><div class="hhr-statusbody"><p>Loading…</p></div>';
    panel.append(box);
    box.querySelector('.hhr-ib').onclick = () => box.remove();
    const body = box.querySelector('.hhr-statusbody');
    const load = async () => {
      try {
        const s = await (await fetch('/api/assistant/status')).json();
        body.innerHTML = `<p><b>${s.read}</b> of <b>${s.documents}</b> documents read, plus all forms, folder notes and announcements (${s.passages.toLocaleString()} passages in total).${s.running ? ` <span class="hhr-busy">Reading now: ${s.progress.done} of ${s.progress.total}…</span>` : ''}</p>
          <p class="${s.ai ? '' : 'hhr-warn'}">${s.ai ? `Answers are written by AI (${esc(s.model)}) from the hub passages it finds.` : 'AI answers are off because ANTHROPIC_API_KEY isn’t set in Render, so Helpful HR shows the matching passages instead.'}</p>
          ${s.failed.length ? `<p><b>${s.failed.length} couldn’t be read</b>, so Helpful HR can’t answer from them:</p><ul>${s.failed.slice(0, 60).map(f => `<li><b>${esc(f.title)}</b> <small>(${esc(f.where)})</small><br><small>${esc(f.err)}</small></li>`).join('')}</ul>` : ''}
          <button class="btn" type="button" id="hhrReread">Read everything again</button>`;
        body.querySelector('#hhrReread').onclick = async () => { await fetch('/api/admin/assistant/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"all":true}' }); body.innerHTML = '<p>Reading the documents again. This can take a few minutes…</p>'; setTimeout(load, 3000); };
        if (s.running) setTimeout(load, 3000);
      } catch { body.innerHTML = '<p>Couldn’t load the status.</p>'; }
    };
    load();
  }

  // keep the button clear of the Submit bar on form pages
  const raise = () => document.body.classList.toggle('hhr-raise', /^#(edit-)?form\//.test(location.hash));
  addEventListener('hashchange', raise); raise();

  // ---------- start ----------
  fetch('/api/me').then(r => r.ok ? r.json() : null).then(u => { me = u; if (!u) { fab.remove(); panel.remove(); } else if (open) render(); }).catch(() => { });
  if (!store.get('hhr-seen', false)) { fab.classList.add('hello'); setTimeout(() => fab.classList.remove('hello'), 6000); store.set('hhr-seen', true); }
})();
