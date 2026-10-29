// Control Center online: logging in (once per device; you stay logged in).
// Runs before the home screen. Only your own login can open Control Center: the online server
// checks it on every request.
(() => {
  'use strict';
  const URL_ = 'https://vzbxtbipabwyuvqvjoxx.supabase.co';
  const KEY = 'sb_publishable_i5hsg3cHLaoecoMKWhdGaQ_JsudO1QF';
  const sb = window.supabase.createClient(URL_, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cc-auth' },
  });
  let token = null;
  let ready;
  window.ccAuthReady = new Promise((r) => { ready = r; });
  window.ccToken = () => token;
  window.ccPoll = () => {};

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- the login screen ----------
  let signup = false;
  function showLogin(message = '') {
    let box = document.getElementById('cc-login');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cc-login';
      box.innerHTML = `
        <form class="login-card" autocomplete="on">
          <div class="login-brand"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="10" height="10" rx="2.5"/><rect x="18" y="4" width="10" height="10" rx="2.5"/><rect x="4" y="18" width="10" height="10" rx="2.5"/><rect x="18" y="18" width="10" height="10" rx="2.5" class="fill"/></svg><b>Control Center</b></div>
          <p class="login-hint"></p>
          <label>Email<input name="email" type="email" autocomplete="username" inputmode="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
          <button class="btn primary" type="submit">Log in</button>
          <p class="login-msg" role="status"></p>
          <button class="login-switch" type="button"></button>
        </form>`;
      document.body.append(box);
      const form = box.querySelector('form');
      box.querySelector('.login-switch').onclick = () => { signup = !signup; paint(); };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = form.querySelector('button[type=submit]');
        const msg = box.querySelector('.login-msg');
        btn.disabled = true;
        msg.className = 'login-msg';
        msg.textContent = '';
        const email = form.email.value.trim();
        const password = form.password.value;
        try {
          if (signup) {
            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            if (!data.session) {
              signup = false; paint();
              msg.className = 'login-msg ok';
              msg.textContent = 'Login created. Tell Claude it’s done (or click the link in the confirmation email), then log in here.';
              return;
            }
          } else {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
          }
          form.password.value = '';
          // Logged in again after being logged out: start fresh so every app uses the new login.
          if (started) location.reload();
        } catch (ex) {
          msg.textContent = /invalid login/i.test(ex.message) ? 'That email or password isn’t right.'
            : /not confirmed/i.test(ex.message) ? 'This login isn’t confirmed yet. Tell Claude, or click the link in the confirmation email.'
            : ex.message;
        } finally {
          btn.disabled = false;
        }
      };
    }
    const paint = () => {
      box.querySelector('.login-hint').textContent = signup
        ? 'First time: choose a password (8+ characters) for Control Center. This is not your email password.'
        : 'Log in once on this computer or phone. You’ll stay logged in.';
      box.querySelector('button[type=submit]').textContent = signup ? 'Create my login' : 'Log in';
      box.querySelector('.login-switch').textContent = signup ? 'I already have a login' : 'First time? Create your login';
      box.querySelector('[name=password]').autocomplete = signup ? 'new-password' : 'current-password';
    };
    paint();
    const msg = box.querySelector('.login-msg');
    msg.textContent = message;
    box.hidden = false;
    document.body.classList.add('cc-locked');
  }
  function hideLogin() {
    const box = document.getElementById('cc-login');
    if (box) box.hidden = true;
    document.body.classList.remove('cc-locked');
  }

  let started = false;
  function go(session) {
    token = session.access_token;
    hideLogin();
    if (!started) { started = true; ready(); }
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (session) go(session);
    else if (event === 'SIGNED_OUT') { token = null; showLogin(); }
  });

  // An app was told "please log in again": check, and ask for the login if it's really gone.
  window.addEventListener('message', async (e) => {
    if (e.origin !== location.origin || e.data?.cc !== 'logged-out') return;
    const { data, error } = await sb.auth.refreshSession();
    if (error || !data.session) showLogin('Please log in again.');
    else token = data.session.access_token;
  });

  // ---------- log out (in the menu) ----------
  function addLogout() {
    const rail = document.querySelector('.rail');
    if (!rail || document.getElementById('cc-logout')) return;
    const b = document.createElement('button');
    b.id = 'cc-logout';
    b.type = 'button';
    b.className = 'collapse-btn logout-btn';
    b.title = 'Log out of Control Center on this device';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></svg><span class="label">Log out</span>';
    b.onclick = async () => {
      if (!confirm('Log out of Control Center on this device?')) return;
      await sb.auth.signOut().catch(() => {});
      location.reload();
    };
    rail.insertBefore(b, document.getElementById('collapseBtn'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    addLogout();
    // (For Claude's own testing only; the online server has to accept this key.)
    let test = null;
    try { test = localStorage.getItem('cc-test-key'); } catch { /* none */ }
    if (test) { started = true; ready(); return; }
    const { data } = await sb.auth.getSession();
    if (data?.session) go(data.session); else showLogin();
  });

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
