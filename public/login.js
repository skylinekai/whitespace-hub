// Sign-in page
(function () {
  const f = document.getElementById('f'), msg = document.getElementById('msg'), go = document.getElementById('go');
  const email = document.getElementById('email'), pw = document.getElementById('password'), show = document.getElementById('show');
  const ms = document.getElementById('ms'), msNote = document.getElementById('msNote'), alt = document.getElementById('alt'), pwBox = document.getElementById('pwBox');
  const qs = new URLSearchParams(location.search);
  const next = qs.get('next');
  const safe = n => (n && /^\/(?!\/)/.test(n) && !n.startsWith('/login')) ? n : '/';
  const err = t => { msg.textContent = t; msg.hidden = false; };
  const ERRORS = {
    'ms-denied': 'Microsoft sign-in was cancelled. Try again when you’re ready.',
    'ms-expired': 'The sign-in took too long. Try again.',
    'ms-tenant': 'That Microsoft account isn’t part of Skyline Whitespace. Use your work account.',
    'ms-not-added': 'Your Microsoft account worked, but you haven’t been given access to the hub yet. Ask an admin to add you.',
    'ms-off': 'Sign in with Microsoft isn’t set up yet. Use your email and password.',
    'ms-failed': 'Microsoft sign-in didn’t work. Try again, or ask an admin to check the server log.'
  };
  if (ERRORS[qs.get('error')]) err(ERRORS[qs.get('error')]);
  ms.href = '/auth/microsoft/start' + (next ? '?next=' + encodeURIComponent(safe(next) + location.hash) : (location.hash ? '?next=' + encodeURIComponent('/' + location.hash) : ''));
  fetch('/api/login-options').then(r => r.json()).then(o => {
    if (o.microsoft) {
      f.classList.add('has-ms'); ms.hidden = false; msNote.hidden = false;
      const help = f.querySelector('.help'); if (help) help.textContent = 'Trouble signing in? Ask an admin.';
      if (o.password) { alt.hidden = false; pwBox.hidden = true; } else { pwBox.hidden = true; }
      ms.focus();
    } else { email.focus(); }
  }).catch(() => email.focus());
  alt.addEventListener('click', () => { pwBox.hidden = !pwBox.hidden; alt.setAttribute('aria-expanded', String(!pwBox.hidden)); if (!pwBox.hidden) email.focus(); });
  show.addEventListener('click', () => {
    const on = pw.type === 'password';
    pw.type = on ? 'text' : 'password'; show.textContent = on ? 'Hide' : 'Show';
    show.setAttribute('aria-pressed', on); show.setAttribute('aria-label', on ? 'Hide password' : 'Show password');
  });
  f.addEventListener('submit', async e => {
    e.preventDefault(); msg.hidden = true;
    if (pwBox.hidden) return;
    if (!email.value.trim()) { err('Enter your email address.'); email.focus(); return; }
    if (!pw.value) { err('Enter your password.'); pw.focus(); return; }
    go.disabled = true; go.innerHTML = '<span class="spin"></span>Signing in…';
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value.trim(), password: pw.value }) });
      const out = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(out.error || 'Sign-in didn’t work. Try again.');
      location.replace(safe(next) + location.hash);
    } catch (e2) {
      err(e2.message); pw.select();
      go.disabled = false; go.textContent = 'Sign in';
    }
  });
})();
