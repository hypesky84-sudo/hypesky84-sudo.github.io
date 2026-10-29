// Control Center online: the Alerts screen (iPhone and other devices).
// Turn alerts on for this device and choose what they're for. Choices are saved per device, so
// your iPhone and a computer can be set differently. The once-a-minute check on the online
// server sends them, even when Control Center is closed.
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  async function api(path, body) {
    const res = await fetch(`/hub/api/push/${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `Something went wrong (${res.status}).`);
    return j;
  }
  const keyBytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));
  const label = () => (isIOS ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : /Windows/.test(navigator.userAgent) ? 'Windows computer' : 'This device');

  let reg = null;
  let sub = null;
  let prefs = null;
  let accounts = [];

  async function current() {
    reg = await navigator.serviceWorker.ready;
    sub = await reg.pushManager.getSubscription();
    if (sub) {
      const st = await api('status', { endpoint: sub.endpoint });
      if (!st.subscribed) { // the server forgot this device: sign it up again
        await api('subscribe', { subscription: sub.toJSON(), prefs: st.prefs, label: label() });
      }
      prefs = st.prefs;
    }
  }

  // ---------- the panel ----------
  function panel() {
    let box = $('#cc-alerts');
    if (!box) {
      box = document.createElement('div');
      box.id = 'cc-alerts';
      box.innerHTML = '<div class="alerts-card" role="dialog" aria-modal="true" aria-labelledby="alertsTitle"><div class="alerts-body"></div></div>';
      box.addEventListener('click', (e) => { if (e.target === box) close(); });
      document.body.append(box);
    }
    box.hidden = false;
    return $('.alerts-body', box);
  }
  function close() { const b = $('#cc-alerts'); if (b) b.hidden = true; }

  const head = '<div class="alerts-head"><h2 id="alertsTitle">Alerts on this device</h2><button type="button" class="alerts-x" data-a="close" aria-label="Close">✕</button></div>';

  function render(note = '') {
    const body = panel();
    if (!supported || (isIOS && !standalone)) {
      body.innerHTML = `${head}<p>To get alerts on your iPhone, Control Center has to be opened from your Home Screen:</p>
        <ol class="alerts-steps"><li>In <b>Safari</b>, open this page.</li><li>Tap <b>Share</b> (the square with the arrow), then <b>Add to Home Screen</b>.</li>
        <li>Open <b>Control Center</b> from your Home Screen, log in, and tap <b>Alerts</b> again.</li></ol>
        <p class="muted small">iPhones only allow alerts for apps on the Home Screen.</p>`;
      return;
    }
    if (!sub) {
      body.innerHTML = `${head}<p>Get an alert on this ${esc(label().toLowerCase())} for new email, important senders and compliance problems, even when Control Center is closed.</p>
        ${Notification.permission === 'denied' ? '<p class="alerts-warn">Alerts are blocked for Control Center. On iPhone: Settings → Notifications → Control Center → Allow Notifications. Then come back here.</p>' : ''}
        <button type="button" class="btn primary alerts-on" data-a="on">Turn on alerts</button>
        <p class="alerts-note" role="status">${esc(note)}</p>`;
      return;
    }
    const p = prefs;
    const chosen = new Set(p.accounts || accounts.filter((a) => !a.muted).map((a) => a.id));
    body.innerHTML = `${head}
      <label class="alerts-row"><input type="checkbox" data-p="important" ${p.important ? 'checked' : ''}>
        <span><b>Important senders</b><span class="muted small">Urgent alert, any account. Change the list in Mailroom → Settings.</span></span></label>
      <label class="alerts-row"><input type="checkbox" data-p="compliance" ${p.compliance ? 'checked' : ''}>
        <span><b>Compliance problems</b><span class="muted small">A carrier that was fine now has a problem (DOT, authority, insurance, BOC-3).</span></span></label>
      <label class="alerts-row"><input type="checkbox" data-p="newMail" ${p.newMail ? 'checked' : ''}>
        <span><b>New email</b><span class="muted small">One alert per check (“3 new emails”), for the accounts below.</span></span></label>
      <div class="alerts-accounts${p.newMail ? '' : ' off'}">
        <div class="alerts-acc-head"><span class="small muted">Accounts</span><span><button type="button" class="linkish" data-a="all">All</button> · <button type="button" class="linkish" data-a="none">None</button></span></div>
        ${accounts.map((a) => `<label class="alerts-acc"><input type="checkbox" data-acc="${esc(a.id)}" ${chosen.has(a.id) ? 'checked' : ''} ${p.newMail ? '' : 'disabled'}>
          <span class="dot" style="background:${esc(a.color || '#888')}"></span><span class="acc-name">${esc(a.name || a.email)}<span class="muted small">${esc(a.name ? a.email : '')}</span></span></label>`).join('')}
      </div>
      <div class="alerts-actions"><button type="button" class="btn" data-a="test">Send a test alert</button><button type="button" class="btn ghost" data-a="off">Turn off on this device</button></div>
      <p class="alerts-note" role="status">${esc(note)}</p>`;
  }

  let saveTimer;
  function collect() {
    const body = $('#cc-alerts .alerts-body');
    const next = { ...prefs };
    for (const el of body.querySelectorAll('[data-p]')) next[el.dataset.p] = el.checked;
    next.accounts = [...body.querySelectorAll('[data-acc]')].filter((x) => x.checked).map((x) => x.dataset.acc);
    return next;
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try { prefs = collect(); await api('prefs', { endpoint: sub.endpoint, prefs }); note('Saved'); } catch (e) { note(e.message); }
    }, 400);
  }
  const note = (t) => { const n = $('#cc-alerts .alerts-note'); if (n) n.textContent = t; };

  document.addEventListener('change', (e) => {
    if (!e.target.closest('#cc-alerts')) return;
    if (e.target.dataset.p === 'newMail') {
      $('#cc-alerts .alerts-accounts').classList.toggle('off', !e.target.checked);
      document.querySelectorAll('#cc-alerts [data-acc]').forEach((x) => { x.disabled = !e.target.checked; });
    }
    save();
  });

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('#cc-alerts [data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'close') return close();
    if (a === 'all' || a === 'none') { document.querySelectorAll('#cc-alerts [data-acc]').forEach((x) => { x.checked = a === 'all'; }); return save(); }
    b.disabled = true;
    try {
      if (a === 'on') {
        // Must come straight from your tap (iPhones require it).
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { render('Alerts weren’t allowed. You can allow them in Settings → Notifications → Control Center.'); return; }
        reg = await navigator.serviceWorker.ready;
        const { publicKey } = await api('key');
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
        prefs = { newMail: true, important: true, compliance: true, accounts: accounts.filter((x) => !x.muted).map((x) => x.id) };
        await api('subscribe', { subscription: sub.toJSON(), prefs, label: label() });
        render('Alerts are on. Sending a test alert…');
        await api('test', { endpoint: sub.endpoint }).then(() => note('Alerts are on. A test alert was sent.'), (err) => note(err.message));
      } else if (a === 'test') {
        await api('test', { endpoint: sub.endpoint });
        note('Test alert sent. It should arrive in a few seconds.');
      } else if (a === 'off') {
        await api('unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
        sub = null;
        render('Alerts are off on this device.');
      }
    } catch (err) {
      note(err.message);
    } finally {
      b.disabled = false;
    }
  });

  async function open() {
    panel().innerHTML = `${head}<p class="muted">Loading…</p>`;
    try {
      accounts = await fetch('/mail/api/accounts').then((r) => (r.ok ? r.json() : []));
      if (supported && !(isIOS && !standalone)) await current();
      render();
    } catch (e) {
      render(e.message);
    }
  }

  // ---------- the Alerts button (home screen, next to Refresh) ----------
  function addButton() {
    const refresh = document.getElementById('refreshAll');
    if (!refresh || document.getElementById('alertsBtn')) return;
    const b = document.createElement('button');
    b.id = 'alertsBtn';
    b.type = 'button';
    b.className = 'btn ghost';
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>Alerts';
    b.onclick = open;
    const wrap = document.createElement('div');
    wrap.className = 'home-actions';
    refresh.replaceWith(wrap);
    wrap.append(b, refresh);
  }
  document.addEventListener('DOMContentLoaded', addButton);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.ccAlerts = { open };
})();
