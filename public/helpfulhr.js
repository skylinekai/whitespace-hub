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
    back: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M9.2 16.4a.5.5 0 0 0 .7-.7L4.7 10.5H16.5a.5.5 0 0 0 0-1H4.7l5.2-5.2a.5.5 0 0 0-.7-.7l-6 6a.5.5 0 0 0 0 .7l6 6Z"/></svg>',
    person: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 9h10a2 2 0 0 1 2 2c0 1.7-.8 2.9-2.1 3.7-1.2.8-2.9 1.3-4.9 1.3s-3.7-.5-4.9-1.3A4.2 4.2 0 0 1 3 14c0-1.1.9-2 2-2Zm0 1a1 1 0 0 0-1 1c0 1.3.6 2.2 1.6 2.9 1 .7 2.6 1.1 4.4 1.1s3.4-.4 4.4-1.1c1-.7 1.6-1.6 1.6-2.9a1 1 0 0 0-1-1H5Z"/></svg>',
    restart: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 3a.5.5 0 0 1 .5.5v3.3A7 7 0 1 1 3 10.5a.5.5 0 0 1 1 0A6 6 0 1 0 5.7 6H8.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1-.5-.5v-3c0-.3.2-.5.5-.5Z"/></svg>'
  };
  let me = null, open = false, busy = false;
  let view = 'bot', ticket = null, tickets = null, presence = { staff: [], isStaff: false, myUnread: 0 }, draft = '';
  let chat = store.get('hhr-chat', []);   // [{role, content, sources?, passages?, mode?, error?}]

  // ---------- markup ----------
  const fab = document.createElement('button');
  fab.className = 'hhr-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Ask Helpful HR'); fab.setAttribute('aria-expanded', 'false'); fab.setAttribute('aria-controls', 'hhrPanel');
  fab.innerHTML = `<img src="${AV}" alt=""><span class="hhr-dot" aria-hidden="true"></span><span class="hhr-fablabel">Ask Helpful HR</span><span class="hhr-badge" hidden></span>`;
  const panel = document.createElement('section');
  panel.className = 'hhr-panel'; panel.id = 'hhrPanel'; panel.hidden = true; panel.setAttribute('aria-label', 'Helpful HR');
  panel.innerHTML = `
    <header class="hhr-head"><img src="${AV}" alt=""><div class="hhr-id"><b>Helpful HR</b><small>Answers from the hub only</small></div>
      <button class="hhr-ib" type="button" id="hhrMenu" aria-label="More options" aria-haspopup="menu">${ICON.more}</button>
      <button class="hhr-ib" type="button" id="hhrClose" aria-label="Close Helpful HR">${ICON.x}</button></header>
    <div class="hhr-tabs" role="tablist"><button type="button" role="tab" data-view="bot">Helpful HR</button><button type="button" role="tab" data-view="list">Questions <span class="hhr-n" id="hhrQn" hidden></span></button></div>
    <div class="hhr-bar" id="hhrBar" hidden></div>
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
  function renderBot() {
    const first = me ? String(me.name || '').split(/\s+/)[0] : '';
    let h = `<div class="hhr-msg bot"><img class="hhr-av" src="${AV}" alt=""><div class="hhr-bub"><p>Hi${first ? ' ' + esc(first) : ''}, I’m <b>Helpful HR</b>. Ask me anything about our policies, forms and documents. I only answer from what’s in the hub, and I’ll show you where I found it.</p></div></div>`;
    if (!chat.length) h += `<div class="hhr-sugg" aria-label="Suggested questions">${SUGGEST.map(s => `<button type="button" class="hhr-chip" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
    for (const m of chat) {
      if (m.role === 'user') h += `<div class="hhr-msg me"><div class="hhr-bub">${esc(m.content)}</div></div>`;
      else h += `<div class="hhr-msg bot${m.error ? ' err' : ''}"><img class="hhr-av" src="${AV}" alt=""><div class="hhr-bub">${fmt(m.content, m.sources)}
        ${m.passages ? m.passages.map(p => `<blockquote class="hhr-quote"><a href="${esc(href(p))}"${ext(p)}><b>${esc(p.title)}</b>${p.page ? ` · page ${p.page}` : ''}</a><p>${esc(p.text)}</p></blockquote>`).join('') : ''}
        ${m.passages ? '' : sourcesHtml(m.sources)}</div></div>`;
      if (m === chat[chat.length - 1] && !m.error) h += handoffHtml(m.found === false);
    }
    if (busy) h += `<div class="hhr-msg bot"><img class="hhr-av" src="${AV}" alt=""><div class="hhr-bub hhr-typing" aria-label="Helpful HR is looking through the hub"><span></span><span></span><span></span></div></div>`;
    log.innerHTML = h;
    log.scrollTop = log.scrollHeight;
  }


  // ---------- asking a person ----------
  const staff0 = () => presence.staff[0] || null;
  const firstName = n => String(n || '').split(/\s+/)[0];
  const status = st => st && st.online ? '<span class="hhr-on">Online now</span>' : '<span class="hhr-off">Away</span>';
  function handoffHtml(notFound) {
    const st = staff0(); if (!st || (me && st.id === me.id)) return '';
    if (!notFound) return `<div class="hhr-hand small"><button type="button" class="hhr-link" data-act="ask-person">Still need help? Ask ${esc(firstName(st.name))}</button></div>`;
    return `<div class="hhr-hand"><div class="hhr-handp">${ICON.person}<div><b>${esc(st.name)}</b> ${status(st)}<p>${st.online ? `${esc(firstName(st.name))} is online and can reply here now.` : `${esc(firstName(st.name))} will get a task to reply. You’ll see the answer here, and by email.`}</p></div></div>
      <button type="button" class="btn primary small" data-act="ask-person">${st.online ? `Chat with ${esc(firstName(st.name))}` : `Send my question to ${esc(firstName(st.name))}`}</button></div>`;
  }
  function renderCompose() {
    const st = staff0();
    bar(`<button class="hhr-ib dark" type="button" data-act="back-bot" aria-label="Back">${ICON.back}</button><span>Ask <b>${esc(st ? st.name : 'HR')}</b> ${status(st)}</span>`);
    log.innerHTML = `<div class="hhr-compose"><p>${st && st.online ? `${esc(firstName(st.name))} is online. Send your question and they can reply here straight away.` : `${esc(st ? firstName(st.name) : 'HR')} isn’t online right now. Send your question and they’ll get a task to reply. You’ll see the answer in <b>Questions</b> and get an email.`}</p>
      <p class="hhr-small">What Helpful HR found is included, so you don’t need to repeat it.</p></div>`;
    q.placeholder = 'Your question for ' + (st ? firstName(st.name) : 'HR') + '…';
    if (!q.value) q.value = draft; grow(); q.focus();
  }
  const when = iso => { const d = new Date(iso), t = new Date(); return d.toDateString() === t.toDateString() ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
  const initials = n => esc(String(n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase());
  const ST = { open: 'Waiting for a reply', answered: 'Answered', closed: 'Resolved' };
  function renderList() {
    bar('');
    if (!tickets) { log.innerHTML = '<div class="hhr-empty">Loading…</div>'; loadTickets(); return; }
    const row = (t, staffSide) => `<button type="button" class="hhr-trow${t.unread ? ' unread' : ''}" data-ticket="${t.id}">
      <span class="hhr-tav">${staffSide ? initials(t.from.name) : ICON.person}</span>
      <span class="hhr-tt"><b>${staffSide ? esc(t.from.name) : esc(t.question.slice(0, 80))}</b><small>${staffSide ? esc(t.question.slice(0, 90)) : `${esc(ST[t.status])}${t.assignedTo ? ' · ' + esc(t.assignedTo) : ''}`}</small></span>
      <span class="hhr-tm">${when(t.updatedAt)}${staffSide ? `<i class="st-${t.status}">${esc(t.status === 'open' ? 'Needs reply' : ST[t.status])}</i>` : ''}</span></button>`;
    let h = '';
    if (tickets.isStaff) {
      const inbox = tickets.inbox.slice().sort((x, y) => (x.status === 'open' ? 0 : 1) - (y.status === 'open' ? 0 : 1) || y.updatedAt.localeCompare(x.updatedAt));
      h += `<div class="hhr-sect">Questions for you</div>${inbox.length ? inbox.map(t => row(t, true)).join('') : '<div class="hhr-empty">No questions yet.</div>'}`;
    }
    h += `<div class="hhr-sect">${tickets.isStaff ? 'Questions you’ve asked' : 'Your questions'}</div>${tickets.mine.length ? tickets.mine.map(t => row(t, false)).join('') : `<div class="hhr-empty">You haven’t asked ${staff0() ? esc(firstName(staff0().name)) : 'HR'} anything yet.${staff0() && (!me || staff0().id !== me.id) ? ` <button type="button" class="hhr-link" data-act="ask-person">Ask a question</button>` : ''}</div>`}`;
    log.innerHTML = h;
  }
  function renderTicket() {
    const t = ticket; if (!t) return renderList();
    const staffSide = me && t.from.id !== me.id;
    const st = presence.staff.find(x => x.name === t.assignedTo) || staff0();
    bar(`<button class="hhr-ib dark" type="button" data-act="back-list" aria-label="All questions">${ICON.back}</button>
      <span>${staffSide ? `From <b>${esc(t.from.name)}</b>` : `With <b>${esc(t.assignedTo || (st && st.name) || 'HR')}</b> ${status(st)}`}</span>
      ${t.status !== 'closed' ? `<button type="button" class="btn subtle small" data-act="close-ticket">Mark as resolved</button>` : '<span class="hhr-pill">Resolved</span>'}`);
    let h = '';
    if (staffSide && t.context && t.context.length) h += `<details class="hhr-ctx"><summary>What they asked Helpful HR first</summary>${t.context.map(c => `<p><b>${c.role === 'user' ? esc(t.from.name) : 'Helpful HR'}:</b> ${esc(c.content.slice(0, 600))}</p>`).join('')}</details>`;
    for (const m of t.messages) {
      const mine = m.mine;
      h += `<div class="hhr-msg ${mine ? 'me' : 'bot'}">${mine ? '' : `<span class="hhr-av init">${initials(m.name)}</span>`}<div class="hhr-bub">${mine ? '' : `<div class="hhr-who">${esc(m.name)}</div>`}${esc(m.text)}<div class="hhr-time">${when(m.at)}</div></div></div>`;
    }
    if (!staffSide && t.status === 'open' && t.messages.length === 1) h += `<div class="hhr-wait">${st && st.online ? `${esc(firstName(st.name))} is online and has been told about your question.` : `${esc(firstName(t.assignedTo || 'HR'))} has a task to reply. You’ll see the answer here and get an email.`}</div>`;
    if (t.status === 'closed') h += `<div class="hhr-wait">This question has been marked as resolved. Send a message to open it again.</div>`;
    log.innerHTML = h; log.scrollTop = log.scrollHeight;
    q.placeholder = staffSide ? `Reply to ${firstName(t.from.name)}…` : 'Write a message…';
  }
  function bar(html) { const b = $('#hhrBar', panel); b.innerHTML = html; b.hidden = !html; }
  function render() {
    panel.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', b.dataset.view === (view === 'bot' || view === 'compose' ? 'bot' : 'list')));
    $('.hhr-tabs', panel).hidden = !presence.staff.length;
    if (view === 'bot') { bar(''); q.placeholder = 'Ask about a policy, form or document…'; return renderBot(); }
    if (view === 'compose') return renderCompose();
    if (view === 'list') { q.placeholder = 'Ask Helpful HR…'; return renderList(); }
    return renderTicket();
  }
  async function loadTickets() {
    try { const r = await fetch('/api/hhr/tickets'); if (r.ok) { tickets = await r.json(); presence.staff = tickets.staff || presence.staff; if (view === 'list') render(); } } catch { }
  }
  async function openTicket(id) {
    view = 'ticket'; if (!ticket || ticket.id !== id) { ticket = null; log.innerHTML = '<div class="hhr-empty">Loading…</div>'; }
    try { const r = await fetch('/api/hhr/tickets/' + id); if (!r.ok) throw 0; ticket = await r.json(); presence.staff = ticket.staff || presence.staff; } catch { ticket = null; view = 'list'; }
    render(); lastSeenUnread = 1e9; ping();
  }
  async function createTicket(text) {
    text = text.trim(); if (!text || busy) return;
    busy = true;
    try {
      const r = await fetch('/api/hhr/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, context: chat.filter(m => !m.error).slice(-4).map(m => ({ role: m.role, content: m.content })) }) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'That didn’t send. Try again.');
      q.value = ''; draft = ''; grow(); tickets = null; ticket = out; view = 'ticket'; render();
    } catch (e) { alertIn(e.message); }
    busy = false;
  }
  async function sendMessage(text) {
    text = text.trim(); if (!text || busy || !ticket) return;
    busy = true;
    try {
      const r = await fetch(`/api/hhr/tickets/${ticket.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'That didn’t send. Try again.');
      q.value = ''; grow(); ticket = Object.assign(out, { staff: ticket.staff }); tickets = null; render();
    } catch (e) { alertIn(e.message); }
    busy = false;
  }
  async function closeTicket() {
    if (!ticket) return;
    const r = await fetch(`/api/hhr/tickets/${ticket.id}/close`, { method: 'POST' });
    if (r.ok) { ticket = await r.json(); tickets = null; render(); }
  }
  function alertIn(msg) { const d = document.createElement('div'); d.className = 'hhr-alert'; d.textContent = msg; log.append(d); log.scrollTop = log.scrollHeight; }

  // presence: lets HR show as online, and brings in replies and new questions
  let lastSeenUnread = -1;
  async function ping() {
    if (!me) return;
    try {
      const r = await fetch('/api/hhr/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visible: document.visibilityState === 'visible' }) });
      if (!r.ok) return;
      const p = await r.json(); const prevStaff = JSON.stringify(presence.staff);
      presence = p;
      const unread = (p.myUnread || 0) + (p.inbox ? p.inbox.unread : 0);
      const badge = $('.hhr-badge', fab); badge.hidden = !unread; badge.textContent = unread;
      const qn = $('#hhrQn', panel); qn.hidden = !unread; qn.textContent = unread;
      if (unread > lastSeenUnread && lastSeenUnread >= 0) {
        tickets = null;
        if (p.inbox && p.inbox.latest && !(open && view === 'ticket' && ticket && ticket.id === p.inbox.latest.id)) pop(`<b>New question from ${esc(p.inbox.latest.from)}</b><span>${esc(p.inbox.latest.question)}</span>`, p.inbox.latest.id);
        else if (p.myUnread && !(open && view === 'ticket')) pop(`<b>${esc(staff0() ? staff0().name : 'HR')} replied to your question</b>`, null);
        if (open && view === 'list') render();
      }
      lastSeenUnread = unread;
      if (open && view !== 'ticket' && JSON.stringify(p.staff) !== prevStaff) render();
    } catch { }
  }
  function pop(html, id) {
    let el = $('.hhr-pop'); if (el) el.remove();
    el = document.createElement('div'); el.className = 'hhr-pop'; el.setAttribute('role', 'status');
    el.innerHTML = `<img src="${AV}" alt=""><div>${html}</div><button type="button" class="btn primary small">${id ? 'Reply' : 'Open'}</button><button type="button" class="hhr-ib" aria-label="Dismiss">${ICON.x}</button>`;
    document.body.append(el);
    el.querySelector('.btn').onclick = () => { el.remove(); setOpen(true); id ? openTicket(id) : (view = 'list', tickets = null, render()); };
    el.querySelector('.hhr-ib').onclick = () => el.remove();
    setTimeout(() => el.remove(), 20000);
  }
  setInterval(() => { if (document.visibilityState === 'visible') ping(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ping(); });
  // while a conversation is open, check for new messages every few seconds
  setInterval(async () => {
    if (!open || view !== 'ticket' || !ticket || document.visibilityState !== 'visible') return;
    try { const r = await fetch('/api/hhr/tickets/' + ticket.id); if (!r.ok) return; const t = await r.json();
      if (t.messages.length !== ticket.messages.length || t.status !== ticket.status) { const typed = q.value; ticket = t; renderTicket(); q.value = typed; lastSeenUnread = 1e9; ping(); } } catch { }
  }, 4000);

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
      chat.push({ role: 'assistant', content: out.answer, sources: out.sources, passages: out.passages, mode: out.mode, found: out.found });
    } catch (e) { chat.push({ role: 'assistant', content: e.message, error: true }); }
    busy = false; chat = chat.slice(-30); store.set('hhr-chat', chat); render();
    q.focus();
  }
  const grow = () => { q.style.height = 'auto'; q.style.height = Math.min(140, q.scrollHeight) + 'px'; };
  q.addEventListener('input', grow);
  const submit = () => view === 'ticket' ? sendMessage(q.value) : view === 'compose' ? createTicket(q.value) : (view = 'bot', ask(q.value));
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
  form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  panel.addEventListener('click', e => {
    const v = e.target.closest('[data-view]'); if (v) { view = v.dataset.view; if (view === 'list') tickets = null; render(); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act;
    if (act === 'ask-person') { const lastQ = [...chat].reverse().find(m => m.role === 'user'); draft = lastQ ? lastQ.content : ''; q.value = ''; view = 'compose'; render(); }
    if (act === 'back-bot') { view = 'bot'; q.value = ''; render(); }
    if (act === 'back-list') { view = 'list'; ticket = null; tickets = null; q.value = ''; render(); }
    if (act === 'close-ticket') closeTicket();
  });
  log.addEventListener('click', e => {
    const c = e.target.closest('[data-q]'); if (c) return ask(c.dataset.q);
    const tk = e.target.closest('[data-ticket]'); if (tk) return openTicket(tk.dataset.ticket);
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
          <button class="btn" type="button" id="hhrReread">Read everything again</button>
          <h4 class="hhr-h4">Who answers questions Helpful HR can’t</h4>
          <p>They get a task for each new question and can reply in this window. The first person ticked is given the task.</p>
          <div class="hhr-staffpick">${s.people.map(u => `<label><input type="checkbox" value="${u.id}"${s.staff.some(x => x.id === u.id) ? ' checked' : ''}> ${esc(u.name)}</label>`).join('')}</div>
          <button class="btn" type="button" id="hhrStaffSave">Save</button> <span id="hhrStaffMsg" class="hhr-small"></span>`;
        body.querySelector('#hhrReread').onclick = async () => { await fetch('/api/admin/assistant/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"all":true}' }); body.innerHTML = '<p>Reading the documents again. This can take a few minutes…</p>'; setTimeout(load, 3000); };
        body.querySelector('#hhrStaffSave').onclick = async () => {
          const ids = [...body.querySelectorAll('.hhr-staffpick input:checked')].map(i => Number(i.value));
          const r = await fetch('/api/admin/hhr-staff', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
          const out = await r.json().catch(() => ({}));
          body.querySelector('#hhrStaffMsg').textContent = r.ok ? 'Saved.' : (out.error || 'That didn’t save.');
          if (r.ok) { presence.staff = out.staff; }
        };
        if (s.running) setTimeout(load, 3000);
      } catch { body.innerHTML = '<p>Couldn’t load the status.</p>'; }
    };
    load();
  }

  // keep the button clear of the Submit bar on form pages
  const raise = () => document.body.classList.toggle('hhr-raise', /^#(edit-)?form\//.test(location.hash));
  addEventListener('hashchange', raise); raise();

  // ---------- start ----------
  const fromHash = () => { const m = location.hash.match(/^#hhr\/(q[0-9a-f]{12})$/); if (m) { history.replaceState(null, '', location.pathname + '#home'); setOpen(true); openTicket(m[1]); } };
  addEventListener('hashchange', fromHash);
  fetch('/api/me').then(r => r.ok ? r.json() : null).then(u => { me = u; if (!u) { fab.remove(); panel.remove(); return; } ping(); fromHash(); if (open) render(); }).catch(() => { });
  if (!store.get('hhr-seen', false)) { fab.classList.add('hello'); setTimeout(() => fab.classList.remove('hello'), 6000); store.set('hhr-seen', true); }
})();
