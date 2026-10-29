// Sign-in page
(function () {
  const f = document.getElementById('f'), msg = document.getElementById('msg'), go = document.getElementById('go');
  const email = document.getElementById('email'), pw = document.getElementById('password'), show = document.getElementById('show');
  const next = new URLSearchParams(location.search).get('next');
  const safe = n => (n && /^\/(?!\/)/.test(n) && !n.startsWith('/login')) ? n : '/';
  const err = t => { msg.textContent = t; msg.hidden = false; };
  show.addEventListener('click', () => {
    const on = pw.type === 'password';
    pw.type = on ? 'text' : 'password'; show.textContent = on ? 'Hide' : 'Show';
    show.setAttribute('aria-pressed', on); show.setAttribute('aria-label', on ? 'Hide password' : 'Show password');
  });
  f.addEventListener('submit', async e => {
    e.preventDefault(); msg.hidden = true;
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
